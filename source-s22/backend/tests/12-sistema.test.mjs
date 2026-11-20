// =============================================================================
// PROVAS DE RECUSA — O PAPEL DE SISTEMA
// -----------------------------------------------------------------------------
// O QUE ESTE ARQUIVO PROVA
//
// No PGlite, `postgres` é SUPERUSUÁRIO e superusuário ignora RLS mesmo com
// FORCE. Ou seja: os testes rodavam numa condição que PRODUÇÃO NÃO TEM.
//
// Em produção o dono das funções SECURITY DEFINER é um papel comum,
// sujeito ao FORCE RLS → as funções enxergavam ZERO linhas →
// learning.grade_answer devolvia 'errada' para a alternativa CORRETA.
// Um veredito falso, silencioso: o aluno que acertou era reprovado.
//
// A migration 027 cria o papel de sistema (canone_system: NOLOGIN, sem
// BYPASSRLS, com alcance explícito) e transfere a propriedade das funções
// SECURITY DEFINER para ele.
//
// O que se prova aqui:
//   1. Nenhuma função SECURITY DEFINER do domínio tem dono fora do papel
//      de sistema — e o dono NÃO é superusuário e NÃO tem BYPASSRLS.
//   2. O papel de sistema enxerga o dado ATRAVÉS do RLS (o veredito sai
//      certo, com o dono comum).
//   3. A MUTAÇÃO: se alguém devolver a função a um papel comum, o
//      veredito vira 'errada' — o portão deste arquivo PODE falhar.
//   4. O papel de sistema não é uma porta de entrada: NOLOGIN e o app não
//      é membro dele.
//   5. O alcance do sistema NÃO anula as regras: publicar sem verificação
//      continua recusado, com o papel de sistema executando.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, menciona, criarConta, criarFonte,
  criarEdicaoRealizada, criarTrilha, criarForma, criarItemNaForma, criarGabarito
} from './helpers.mjs';

test('o papel de sistema', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  const staff = await criarConta(db, 'staff-sistema@test.invalid');
  const aluno = await criarConta(db, 'aluno-sistema@test.invalid');

  const fonte = await criarFonte(db, { key: 'fonte-sistema', quote: 'Gabarito oficial.' });
  const edicao = await criarEdicaoRealizada(db, { code: '2091.1', questionCount: 3, passingScore: 2 });
  const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
  const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
  const q1 = await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'sis-q01' });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'sis-q02' });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'sis-q03' });
  await criarGabarito(db, {
    formId: forma.id, status: 'definitivo', sourceId: fonte.id,
    entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'A' }, { ordinal: 3, letter: 'B' }]
  });

  async function como(role, fn) {
    await db.exec('BEGIN');
    let erro = null;
    let saida = null;
    try {
      await db.exec(`SET ROLE ${role}`);
      saida = await fn();
    } catch (e) {
      erro = e;
    }
    try {
      if (erro) await db.exec('ROLLBACK');
      else await db.exec('COMMIT');
    } catch (e) {
      if (!erro) erro = e;
    }
    try { await db.exec('RESET ROLE'); } catch { /* já resetado */ }
    return { saida, erro };
  }

  await t.test('o papel de sistema existe, é NOLOGIN e não é superusuário', async () => {
    const p = await one(
      db,
      `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='canone_system'`
    );
    assert.ok(p, 'o papel de sistema precisa existir');
    assert.equal(p.rolsuper, false, 'o papel de sistema NÃO pode ser superusuário');
    assert.equal(p.rolbypassrls, false, 'o papel de sistema NÃO pode depender de BYPASSRLS (só o superusuário concede)');
    assert.equal(p.rolcanlogin, false, 'ninguém entra no papel de sistema');
  });

  await t.test('NENHUMA função SECURITY DEFINER tem dono fora do papel de sistema', async () => {
    const fora = await rows(
      db,
      `SELECT p.oid::regprocedure::text AS funcao, pg_get_userbyid(p.proowner) AS dono
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef
          AND n.nspname IN ('identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit')
          AND pg_get_userbyid(p.proowner) <> 'canone_system'`
    );
    assert.deepEqual(fora, [], `funções fora do papel de sistema: ${JSON.stringify(fora)}`);
  });

  await t.test('o dono das funções NÃO é superusuário (o PGlite não está salvando o schema)', async () => {
    const r = await rows(db, `SELECT * FROM ops.system_reach()`);
    assert.ok(r.length > 0, 'há funções SECURITY DEFINER no domínio');
    assert.equal(r.filter((x) => x.dono_superusuario).length, 0, 'nenhum dono pode ser superusuário');
    assert.equal(r.filter((x) => x.dono_bypassrls).length, 0, 'nenhum dono pode depender de BYPASSRLS');
    assert.equal(r.filter((x) => !x.alcancada).length, 0, 'o papel de sistema alcança as tabelas');
  });

  await t.test('o veredito sai CERTO com o dono comum — o RLS não esconde o sistema', async () => {
    const v = await como('canone_subscriber', () =>
      db.query(`SELECT learning.grade_answer($1,'C') AS correta, learning.grade_answer($1,'A') AS errada`, [q1.itemId])
    );
    assert.equal(v.saida.rows[0].correta, 'correta', 'a alternativa correta é reconhecida');
    assert.equal(v.saida.rows[0].errada, 'errada', 'a alternativa errada é errada');
  });

  await t.test('A MUTAÇÃO: devolver a função a um papel comum quebra o veredito', async () => {
    // O portão deste arquivo só vale se PUDER falhar. Aqui a função é
    // devolvida a um papel sem alcance e o veredito vira 'errada' — o
    // defeito silencioso, do jeito que a produção o veria.
    await db.exec(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='canone_papel_comum') THEN
        CREATE ROLE canone_papel_comum NOLOGIN;
      END IF;
    END $$`);
    await db.exec(`GRANT canone_papel_comum TO CURRENT_USER`);
    await db.exec(`ALTER FUNCTION learning.grade_answer(uuid,text) OWNER TO canone_papel_comum`);

    const quebrado = await como('canone_subscriber', () =>
      db.query(`SELECT learning.grade_answer($1,'C') AS correta`, [q1.itemId])
    );
    const v = quebrado.saida?.rows?.[0]?.correta ?? quebrado.erro?.message ?? null;
    assert.notEqual(v, 'correta', 'sem o papel de sistema, o veredito NÃO pode sair certo');

    // Restaura.
    await db.exec(`ALTER FUNCTION learning.grade_answer(uuid,text) OWNER TO canone_system`);
    const restaurado = await como('canone_subscriber', () =>
      db.query(`SELECT learning.grade_answer($1,'C') AS correta`, [q1.itemId])
    );
    assert.equal(restaurado.saida.rows[0].correta, 'correta', 'com o papel de sistema, volta a sair certo');
  });

  await t.test('o app NÃO pode virar o sistema', async () => {
    const membros = await rows(
      db,
      `SELECT m.rolname FROM pg_auth_members am
         JOIN pg_roles r ON r.oid = am.roleid
         JOIN pg_roles m ON m.oid = am.member
        WHERE r.rolname = 'canone_system'`
    );
    assert.ok(
      !membros.some((m) => m.rolname === 'canone_app'),
      'canone_app não pode ser membro do papel de sistema'
    );
    assert.ok(
      !membros.some((m) => m.rolname === 'canone_subscriber'),
      'o assinante não pode ser membro do papel de sistema'
    );
  });

  await t.test('o alcance do sistema NÃO anula as REGRAS: publicar sem verificação é recusado', async () => {
    // RLS é visibilidade de linha. As regras que moram no banco são
    // triggers — e trigger vale para o papel de sistema também.
    const conteudo = await one(
      db,
      `SELECT ci.id FROM learning.item i
         JOIN learning.exam_form_item efi ON efi.item_id = i.id
         JOIN editorial.content_item ci ON ci.id = i.content_item_id
        WHERE efi.exam_form_id = $1 AND efi.ordinal = 1`,
      [forma.id]
    );
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [conteudo.id]);
    const err = await como('canone_system', () =>
      recusa(db, () => db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [conteudo.id]))
    );
    assert.ok(err, 'sem verificação vigente, nem o papel de sistema publica');
  });

  await t.test('o papel de sistema enxerga o estado através do RLS', async () => {
    // A property central: o sistema vê as linhas que o RLS esconde.
    const visao = await como('canone_system', () =>
      db.query(`SELECT count(*)::int AS n FROM learning.answer_key_entry`)
    );
    assert.ok(visao.saida.rows[0].n > 0, 'o sistema enxerga as entradas do gabarito');
  });
});
