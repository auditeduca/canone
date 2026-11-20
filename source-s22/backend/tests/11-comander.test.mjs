// =============================================================================
// PROVAS DE RECUSA — COMANDER E GOVERNANÇA
// -----------------------------------------------------------------------------
// O COMANDER é a área do administrador como console de comandos. O que se
// prova aqui:
//
//   1. A PRÉVIA É A MESMA EXECUÇÃO, DESFEITA. A prévia não é simulação do
//      navegador: ela roda o comando no banco e desfaz. Depois de uma
//      prévia, nada mudou — e a prévia já disse, com a mensagem DO BANCO,
//      o que aconteceria.
//   2. A RECUSA É DO BANCO. O comander não tem regra própria: se o banco
//      recusa (motivo curto, prazo longo, prova desalinhada), a recusa
//      aparece com a mensagem do banco.
//   3. O CONTRATO É GERADO DO CÓDIGO. O app não escreve o catálogo de
//      comandos: o arquivo do app é gerado do backend e o teste confere
//      que está em dia (contrato escrito à mão mente).
//   4. A GOVERNANÇA MOSTRA O QUE ESTÁ RUIM. A cadeia de auditoria é
//      verificada recalculando o hash, não comparando com o que está
//      gravado.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootDb, one, rows, recusa, menciona, criarConta, criarFonte, criarQuestao,
  criarVerificacao, criarEdicaoRealizada, criarTrilha, criarForma,
  criarItemNaForma, criarGabarito
} from './helpers.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizBackend = resolve(aqui, '..');
const appContrato = resolve(raizBackend, '../app/src/api/contrato-comander.ts');

/* -------------------------------------------------------------------------- */
/* O COMANDER (importado do código compilado — é o mesmo que roda)           */
/* -------------------------------------------------------------------------- */
const { catalogo, comandoPorId, previsualizar, executar } = await import(
  resolve(raizBackend, 'dist/areas/admin/comander.js')
);
const { subirServidor } = await import(resolve(raizBackend, 'dist/http/server.js'));

test('comander e governança', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  const staff = await criarConta(db, 'staff-comander@test.invalid');
  const aluno = await criarConta(db, 'aluno-comander@test.invalid');
  const ctx = { userId: staff, requestId: null };

  await t.test('o contrato do app é GERADO do código — e está em dia', async (st) => {
    if (!existsSync(appContrato)) {
      // O pacote do backend não traz o app. O drift do contrato NÃO é
      // verificável aqui — e isso é PULO, não PASS: quem leia o resultado
      // precisa ver que a prova não rodou.
      st.skip(
        'o app não está neste pacote — o drift do contrato só é verificável no ' +
        'repositório completo (npm run contrato:comander)'
      );
      return;
    }
    assert.ok(existsSync(appContrato), 'o app precisa do contrato gerado');
    const fonte = readFileSync(appContrato, 'utf8');
    assert.ok(fonte.includes('ARQUIVO GERADO. NÃO EDITE.'), 'o arquivo tem que dizer que é gerado');
    for (const c of catalogo()) {
      assert.ok(
        fonte.includes(`"${c.id}"`),
        `o comando ${c.id} sumiu do contrato do app — regenere (npm run contrato:comander)`
      );
    }
    // A direção é uma só: o código é a fonte, o app recebe.
    const codigo = readFileSync(resolve(raizBackend, 'src/areas/admin/comander.ts'), 'utf8');
    for (const c of catalogo()) {
      assert.ok(codigo.includes(`'${c.id}'`), `o comando ${c.id} não está no código do backend`);
    }
  });

  await t.test('a PRÉVIA é a mesma execução, desfeita: nada muda', async () => {
    const cmd = comandoPorId('conceder_acesso');
    const antes = await rows(db, `SELECT count(*)::int AS n FROM admin.support_access_grant`);
    const r = await previsualizar(db, cmd, {
      subjectUserId: aluno,
      motivo: 'Pedido do aluno sobre o gabarito da prova 2026.1',
      horasValidade: '24',
    }, ctx);
    assert.ok(r.ok, `a prévia deveria passar: ${JSON.stringify(r.recusa)}`);
    assert.ok(r.resumo.linhas.some((l) => l.includes('Concessão criada')), 'a prévia diz o que vai acontecer');
    const depois = await rows(db, `SELECT count(*)::int AS n FROM admin.support_access_grant`);
    assert.equal(depois[0].n, antes[0].n, 'a prévia NÃO pode escrever nada');
  });

  await t.test('a recusa é DO BANCO, e a prévia já a mostra', async () => {
    const cmd = comandoPorId('conceder_acesso');
    const r = await previsualizar(db, cmd, {
      subjectUserId: aluno,
      motivo: 'curto',                 // o banco exige 10 caracteres
      horasValidade: '24',
    }, ctx);
    assert.equal(r.ok, false, 'o banco recusa motivo curto');
    assert.ok(r.recusa.mensagem.length > 0, 'a recusa traz a mensagem do banco');
    const n = await one(db, `SELECT count(*)::int AS n FROM admin.support_access_grant`);
    assert.equal(n.n, 0, 'nada foi escrito');
  });

  await t.test('a EXECUÇÃO escreve — e só ela', async () => {
    const cmd = comandoPorId('conceder_acesso');
    const r = await executar(db, cmd, {
      subjectUserId: aluno,
      motivo: 'Pedido do aluno sobre o gabarito da prova 2026.1',
      horasValidade: '24',
    }, ctx);
    assert.ok(r.ok, `a execução deveria passar: ${JSON.stringify(r.recusa)}`);
    const g = await one(db, `SELECT count(*)::int AS n FROM admin.support_access_grant`);
    assert.equal(g.n, 1, 'a concessão foi criada');
  });

  await t.test('a leitura do progresso exige concessão válida (a porta é o banco)', async () => {
    const cmd = comandoPorId('ler_progresso');
    const semConcessao = await previsualizar(db, cmd, {
      subjectUserId: aluno,
      grantId: '00000000-0000-4000-8000-000000000000',
    }, ctx);
    assert.equal(semConcessao.ok, false, 'sem concessão não há leitura');

    const g = await one(db, `SELECT id FROM admin.support_access_grant LIMIT 1`);
    const comConcessao = await previsualizar(db, cmd, { subjectUserId: aluno, grantId: g.id }, ctx);
    assert.ok(comConcessao.ok, `com concessão a leitura passa: ${JSON.stringify(comConcessao.recusa)}`);
  });

  await t.test('selar o gabarito: a prévia do selo incompleto é recusada pelo banco', async () => {
    const fonte = await criarFonte(db, { key: 'fonte-comander', quote: 'Gabarito oficial.' });
    const edicao = await criarEdicaoRealizada(db, { code: '2095.1', questionCount: 3, passingScore: 2 });
    const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
    const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'cmd-q01' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'cmd-q02' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'cmd-q03' });
    // Gabarito PRELIMINAR (o que a importação cria antes de o definitivo sair).
    // Ele tem SÓ a primeira posição: é assim que uma extração incompleta
    // aparece — e é o caso em que o selo tem de ser recusado.
    await criarGabarito(db, {
      formId: forma.id, status: 'preliminar', sourceId: fonte.id,
      entries: [{ ordinal: 1, letter: 'C' }]
    });
    const key = await one(db, `SELECT id FROM learning.answer_key WHERE exam_form_id=$1`, [forma.id]);

    // Letra que não existe entre as alternativas: o banco recusa (prova desalinhada).
    const cmd = comandoPorId('selar_gabarito');
    const ruim = await previsualizar(db, cmd, {
      answerKeyId: key.id,
      entradas: JSON.stringify([
        { posicao: 1, letra: 'C' }, { posicao: 2, letra: 'A' }, { posicao: 3, letra: 'E' }
      ]),
    }, ctx);
    assert.equal(ruim.ok, false, 'letra inexistente é recusada');
    const msg = ruim.recusa?.mensagem ?? '';
    assert.ok(
      msg.includes('DESALINHADA') || msg.includes('não existe'),
      `a mensagem tem que apontar o desalinhamento: ${msg}`
    );

    // Faltando as posições 2 e 3: a completude é conferida no COMMIT — e a
    // prévia roda o COMMIT (SET CONSTRAINTS ALL IMMEDIATE), então também
    // é recusada. Uma prévia que não disparasse a regra deferida seria
    // uma prévia que mente.
    const incompleto = await previsualizar(db, cmd, {
      answerKeyId: key.id,
      entradas: JSON.stringify([{ posicao: 1, letra: 'C' }]),
    }, ctx);
    assert.equal(incompleto.ok, false, 'gabarito incompleto não é selado');

    // Completo e alinhado: passa, e a prévia não sela nada.
    const bom = await previsualizar(db, cmd, {
      answerKeyId: key.id,
      entradas: JSON.stringify([
        { posicao: 1, letra: 'C' }, { posicao: 2, letra: 'A' }, { posicao: 3, letra: 'B' }
      ]),
    }, ctx);
    assert.ok(bom.ok, `o selo completo deveria passar: ${JSON.stringify(bom.recusa)}`);
    const aindaPreliminar = await one(db, `SELECT status FROM learning.answer_key WHERE id=$1`, [key.id]);
    assert.equal(aindaPreliminar.status, 'preliminar', 'a prévia não sela');
  });

  await t.test('anular questão publicada é recusado pelo banco', async () => {
    const fonte = await criarFonte(db, { key: 'fonte-comander-2', quote: 'Gabarito oficial.' });
    const edicao = await criarEdicaoRealizada(db, { code: '2095.2', questionCount: 3, passingScore: 2 });
    const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
    const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'cmd2-q01' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'cmd2-q02' });
    await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'cmd2-q03' });
    await criarGabarito(db, {
      formId: forma.id, status: 'definitivo', sourceId: fonte.id,
      entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'A' }, { ordinal: 3, letter: 'B' }]
    });
    const key = await one(db, `SELECT id FROM learning.answer_key WHERE exam_form_id=$1`, [forma.id]);

    // Publica a questão da posição 1.
    const item = await one(db, `SELECT item_id FROM learning.exam_form_item WHERE exam_form_id=$1 AND ordinal=1`, [forma.id]);
    const conteudo = await one(db, `SELECT content_item_id FROM learning.item WHERE id=$1`, [item.item_id]);
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [conteudo.content_item_id]);
    await criarVerificacao(db, {
      contentItemId: conteudo.content_item_id, sourceId: fonte.id,
      quote: 'Trecho literal da prova.', autor: staff
    });
    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [conteudo.content_item_id]);
    await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [conteudo.content_item_id]);

    const cmd = comandoPorId('anular_questao');
    const r = await previsualizar(db, cmd, {
      answerKeyId: key.id, posicao: '1', motivo: 'Erro de gabarito publicado pelo CFC.'
    }, ctx);
    assert.equal(r.ok, false, 'anular posição de gabarito DEFINITIVO é recusado');
    assert.ok(
      (r.recusa?.mensagem ?? '').includes('imutável'),
      `a mensagem tem que dizer que o gabarito é imutável: ${r.recusa?.mensagem}`
    );

    // Na fase PRELIMINAR, a anulação existe — mas é recusada se a questão
    // já foi publicada: quem praticou precisa ver a retração.
    const fonte2 = await criarFonte(db, { key: 'fonte-comander-3', quote: 'Gabarito oficial.' });
    const edicao2 = await criarEdicaoRealizada(db, { code: '2095.3', questionCount: 3, passingScore: 2 });
    const trilha2 = await criarTrilha(db, { editionId: edicao2.id, questionCount: 3, passingScore: 2 });
    const forma2 = await criarForma(db, { trackId: trilha2.id, formCode: 'T01' });
    await criarItemNaForma(db, { formId: forma2.id, ordinal: 1, key: 'cmd3-q01' });
    await criarItemNaForma(db, { formId: forma2.id, ordinal: 2, key: 'cmd3-q02' });
    await criarItemNaForma(db, { formId: forma2.id, ordinal: 3, key: 'cmd3-q03' });
    await criarGabarito(db, {
      formId: forma2.id, status: 'preliminar', sourceId: fonte2.id,
      entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'A' }, { ordinal: 3, letter: 'B' }]
    });
    const key2 = await one(db, `SELECT id FROM learning.answer_key WHERE exam_form_id=$1`, [forma2.id]);
    const item2 = await one(db, `SELECT item_id FROM learning.exam_form_item WHERE exam_form_id=$1 AND ordinal=1`, [forma2.id]);
    const conteudo2 = await one(db, `SELECT content_item_id FROM learning.item WHERE id=$1`, [item2.item_id]);
    await db.exec(`UPDATE editorial.content_item SET state='em_revisao' WHERE id=$1`, [conteudo2.content_item_id]);
    await criarVerificacao(db, {
      contentItemId: conteudo2.content_item_id, sourceId: fonte2.id,
      quote: 'Trecho literal da prova.', autor: staff
    });
    await db.exec(`UPDATE editorial.content_item SET state='verificado' WHERE id=$1`, [conteudo2.content_item_id]);
    await db.exec(`UPDATE editorial.content_item SET state='publicado' WHERE id=$1`, [conteudo2.content_item_id]);

    const r2 = await previsualizar(db, cmd, {
      answerKeyId: key2.id, posicao: '1', motivo: 'Erro de gabarito publicado pelo CFC.'
    }, ctx);
    assert.equal(r2.ok, false, 'anular questão publicada é recusado');
    assert.ok(
      (r2.recusa?.mensagem ?? '').includes('publicad'),
      `a mensagem tem que dizer que a questão está publicada: ${r2.recusa?.mensagem}`
    );
  });

  await t.test('a GOVERNANÇA mostra o que está aberto e verifica a cadeia', async () => {
    const { governancaEstado } = await import(resolve(raizBackend, 'dist/areas/admin/estado.js'));
    const fila = await governancaEstado.fila(db);
    assert.ok(Array.isArray(fila), 'a fila é uma lista');
    const concessoes = await governancaEstado.concessoes(db);
    assert.ok(concessoes.length >= 1, 'as concessões aparecem');
    assert.ok('vigente' in concessoes[0] && 'expirada' in concessoes[0], 'o banco diz se a concessão está vigente');
    const cadeia = await governancaEstado.cadeia(db);
    assert.equal(cadeia.integra, true, `a cadeia de auditoria tem que estar íntegra: ${JSON.stringify(cadeia.amostra)}`);
  });

  await t.test('o HTTP responde: catálogo, prévia, execução e 401 sem token', async () => {
    const servidor = await subirServidor({
      db,
      tokenStaff: 'token-staff-de-teste',
      tokenAdmin: 'token-admin-de-teste',
      staffUserId: staff,
      adminUserId: staff,
      porta: 0,
    });
    t.after(async () => { await servidor.fechar(); });
    const base = `http://127.0.0.1:${servidor.porta}`;

    const semToken = await fetch(`${base}/api/comander/comandos`);
    assert.equal(semToken.status, 200, 'o catálogo é público: ele não tem dado de ninguém');

    const cat = await (await fetch(`${base}/api/comander/comandos`)).json();
    assert.equal(cat.comandos.length, catalogo().length, 'o servidor serve o catálogo do código');

    const estado401 = await fetch(`${base}/api/comander/estado`);
    assert.equal(estado401.status, 401, 'sem token, o estado é recusado');

    const comToken = { authorization: 'Bearer token-staff-de-teste', 'content-type': 'application/json' };
    const previa = await (
      await fetch(`${base}/api/comander/comandos/conceder_acesso/previa`, {
        method: 'POST',
        headers: comToken,
        body: JSON.stringify({
          entrada: { subjectUserId: aluno, motivo: 'Chamado de suporte aberto pelo aluno.', horasValidade: '12' },
        }),
      })
    ).json();
    assert.equal(previa.ok, true, `a prévia pelo HTTP deveria passar: ${JSON.stringify(previa)}`);

    const exec = await (
      await fetch(`${base}/api/comander/comandos/conceder_acesso`, {
        method: 'POST',
        headers: comToken,
        body: JSON.stringify({
          entrada: { subjectUserId: aluno, motivo: 'Chamado de suporte aberto pelo aluno.', horasValidade: '12' },
        }),
      })
    ).json();
    assert.equal(exec.ok, true, `a execução pelo HTTP deveria passar: ${JSON.stringify(exec)}`);

    const inexistente = await fetch(`${base}/api/comander/comandos/nao_existe/previa`, {
      method: 'POST', headers: comToken, body: JSON.stringify({ entrada: {} }),
    });
    assert.equal(inexistente.status, 400, 'comando desconhecido é erro');
  });
});
