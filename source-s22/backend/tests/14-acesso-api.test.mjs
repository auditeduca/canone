// =============================================================================
// PROVAS DE RECUSA — O ACESSO E A PROVA, PELA PORTA HTTP
// -----------------------------------------------------------------------------
// O QUE ESTE ARQUIVO PROVA
//
// A superfície HTTP do Cânone tinha UM endereço (o comander). O motor da
// prova existia no banco e nos serviços, sem porta de entrada. Este arquivo
// prova a porta:
//
//   1. O link de acesso é emitido, entregue e de USO ÚNICO.
//   2. A sessão resolve o Bearer no usuário — e a conta nasce com o papel
//      de VISITANTE (o papel de assinante exige assinatura ativa).
//   3. O catálogo público não exige login e devolve o preço do banco.
//   4. A prova exige sessão E assinatura ativa: sem uma das duas, recusa.
//   5. Responder NÃO devolve o veredito: o gabarito não vaza no meio da
//      tentativa. A revelação é rota à parte, e o banco recusa antes da
//      hora.
//   6. A rota não é oráculo: pedir link para e-mail existente ou inexistente
//      dá a MESMA resposta.
//
// E a prova de que a rota funciona de verdade: a tentativa inteira, com
// gabarito, no banco real.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootDb, one, rows, recusa, criarConta, criarFonte,
  criarEdicaoRealizada, criarTrilha, criarForma, criarItemNaForma, criarGabarito
} from './helpers.mjs';

const { subirServidor } = await import('../dist/http/server.js');

test('acesso e prova pela porta HTTP', async (t) => {
  const db = await bootDb();
  t.after(async () => { await db.close(); });

  // O comander precisa de um usuário staff configurado.
  const staff = await criarConta(db, 'staff-acesso@test.invalid');
  const admin = await criarConta(db, 'admin-acesso@test.invalid');

  // Uma prova real, com gabarito definitivo.
  const fonte = await criarFonte(db, { key: 'fonte-acesso', quote: 'Gabarito oficial.' });
  const edicao = await criarEdicaoRealizada(db, { code: '2090.1', questionCount: 3, passingScore: 2 });
  const trilha = await criarTrilha(db, { editionId: edicao.id, questionCount: 3, passingScore: 2 });
  const forma = await criarForma(db, { trackId: trilha.id, formCode: 'T01' });
  const q1 = await criarItemNaForma(db, { formId: forma.id, ordinal: 1, key: 'acc-q01' });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 2, key: 'acc-q02' });
  await criarItemNaForma(db, { formId: forma.id, ordinal: 3, key: 'acc-q03' });
  await criarGabarito(db, {
    formId: forma.id, status: 'definitivo', sourceId: fonte.id,
    entries: [{ ordinal: 1, letter: 'C' }, { ordinal: 2, letter: 'A' }, { ordinal: 3, letter: 'B' }]
  });

  /** Os links entregues: o servidor entrega por um canal injetado. */
  const entregues = [];
  const srv = await subirServidor({
    db,
    tokenStaff: 'token-staff-teste',
    tokenAdmin: 'token-admin-teste',
    staffUserId: staff,
    adminUserId: admin,
    porta: 0,
    entregarLink: async (email, link) => { entregues.push({ email, link }); },
  });
  t.after(async () => { await srv.fechar(); });

  const base = `http://127.0.0.1:${srv.porta}`;

  async function chamar(metodo, caminho, corpo, token) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  }

  await t.test('o link de acesso é emitido, entregue e de uso único', async () => {
    const r = await chamar('POST', '/api/auth/link', { email: 'ana@exemplo.com' });
    assert.equal(r.status, 200);
    assert.equal(r.json.enviado, true);
    assert.equal(entregues.length, 1);
    assert.equal(entregues[0].email, 'ana@exemplo.com');
    assert.ok(entregues[0].link.length > 20, 'o link tem que ser um token, não um apelido');

    // O token CRU não está no banco: só o hash.
    const guardado = await one(
      db,
      `SELECT token_hash FROM identity.magic_link WHERE email = $1`,
      ['ana@exemplo.com']
    );
    assert.notEqual(guardado.token_hash, entregues[0].link, 'o banco guarda o HASH, não o link');
  });

  await t.test('a rota não é oráculo: a resposta é a mesma com e sem conta', async () => {
    const antes = entregues.length;
    const comConta = await chamar('POST', '/api/auth/link', { email: 'ana@exemplo.com' });
    const semConta = await chamar('POST', '/api/auth/link', { email: 'ninguem@exemplo.com' });
    assert.equal(comConta.status, semConta.status);
    assert.deepEqual(comConta.json, semConta.json);
    assert.equal(entregues.length, antes + 2, 'os dois links foram entregues');
  });

  await t.test('o link só serve uma vez', async () => {
    const link = entregues[0].link;
    const primeira = await chamar('POST', '/api/auth/sessao', { token: link });
    assert.equal(primeira.status, 200);
    assert.ok(primeira.json.token, 'a sessão devolve um token');

    const segunda = await chamar('POST', '/api/auth/sessao', { token: link });
    assert.equal(segunda.status, 400);
    assert.match(segunda.json.erro, /já foi usado/i);
  });

  await t.test('a conta nasce com o papel de VISITANTE — assinante exige assinatura', async () => {
    const conta = await one(
      db,
      `SELECT a.id, a.status, (SELECT count(*)::int FROM identity.user_role ur
                                  WHERE ur.user_id = a.id AND ur.role_key = 'publico') AS visitante
         FROM identity.account a WHERE a.email = 'ana@exemplo.com'`
    );
    assert.equal(conta.status, 'ativo');
    assert.equal(conta.visitante, 1, 'a conta começa como visitante');
    const assinante = await one(
      db,
      `SELECT count(*)::int AS n FROM identity.user_role ur
         JOIN identity.role r ON r.key = ur.role_key
        WHERE ur.user_id = $1 AND r.requires_subscription`,
      [conta.id]
    );
    assert.equal(assinante.n, 0, 'ninguém recebe papel que exige assinatura sem assinatura');
  });

  await t.test('o catálogo público não exige login e devolve o preço do banco', async () => {
    const r = await chamar('GET', '/api/public/catalogo');
    assert.equal(r.status, 200);
    const completo = r.json.planos.find((p) => p.key === 'completo');
    assert.ok(completo, 'o catálogo traz o plano');
    assert.equal(completo.price_cents, 1500, 'o preço é o do banco');
  });

  await t.test('a prova exige sessão E assinatura ativa', async () => {
    // 1. sem sessão
    const semSessao = await chamar('GET', '/api/subscriber/provas');
    assert.equal(semSessao.status, 401);

    // 2. com sessão, mas sem assinatura
    const link = (await chamar('POST', '/api/auth/link', { email: 'bruno@exemplo.com' })).status;
    assert.equal(link, 200);
    const linkBruno = entregues[entregues.length - 1].link;
    const sessaoBruno = await chamar('POST', '/api/auth/sessao', { token: linkBruno });
    assert.equal(sessaoBruno.status, 200);
    const tokenBruno = sessaoBruno.json.token;

    const semAssinatura = await chamar('GET', '/api/subscriber/provas', null, tokenBruno);
    assert.equal(semAssinatura.status, 400);
    assert.match(semAssinatura.json.erro, /assinatura/i, 'a recusa diz o que falta');

    // 3. com assinatura ativa, a prova aparece
    const userBruno = await one(db, `SELECT id FROM identity.account WHERE email = 'bruno@exemplo.com'`);
    await db.query(
      `INSERT INTO commerce.subscription (user_id, plan_id, status, current_period_start, current_period_end)
       SELECT $1, id, 'ativa', now(), now() + interval '30 days' FROM commerce.plan WHERE key = 'completo'`,
      [userBruno.id]
    );

    const comAssinatura = await chamar('GET', '/api/subscriber/provas', null, tokenBruno);
    assert.equal(comAssinatura.status, 200);
    assert.ok(comAssinatura.json.provas.length > 0, 'a prova aparece para quem assina');
  });

  await t.test('a tentativa inteira funciona — e o veredito NÃO vaza no meio', async () => {
    const link = await chamar('POST', '/api/auth/link', { email: 'carla@exemplo.com' });
    assert.equal(link.status, 200);
    const linkCarla = entregues[entregues.length - 1].link;
    const sessao = await chamar('POST', '/api/auth/sessao', { token: linkCarla });
    const token = sessao.json.token;
    const userCarla = await one(db, `SELECT id FROM identity.account WHERE email = 'carla@exemplo.com'`);
    await db.query(
      `INSERT INTO commerce.subscription (user_id, plan_id, status, current_period_start, current_period_end)
       SELECT $1, id, 'ativa', now(), now() + interval '30 days' FROM commerce.plan WHERE key = 'completo'`,
      [userCarla.id]
    );

    const lista = await chamar('GET', '/api/subscriber/provas', null, token);
    assert.equal(lista.status, 200);
    const alvo = lista.json.provas.find((p) => p.exam_form_id === forma.id);
    assert.ok(alvo, 'a prova da rodada está na lista');

    // Iniciar
    const inicio = await chamar('POST', `/api/subscriber/provas/${forma.id}/tentativa`, {}, token);
    assert.equal(inicio.status, 200);
    const tentativa = inicio.json.tentativa;
    assert.ok(tentativa, 'a tentativa começa');

    // Responder: a resposta é registrada e NADA mais.
    const resposta = await chamar(
      'POST',
      `/api/subscriber/tentativas/${tentativa}/respostas`,
      { ordinal: 1, opcao: 'C' },
      token
    );
    assert.equal(resposta.status, 200, `a resposta tem que ser registrada: ${JSON.stringify(resposta.json)}`);
    assert.deepEqual(resposta.json, { registrada: true });
    assert.equal(
      resposta.json.verdict,
      undefined,
      'o veredito NÃO volta antes da hora — é o que segura a simulação'
    );

    // Revelar antes de encerrar: o banco recusa.
    const antecipado = await chamar('POST', `/api/subscriber/tentativas/${tentativa}/revelar`, {}, token);
    assert.equal(antecipado.status, 400);
    assert.match(antecipado.json.erro, /terminar|conclu/i);

    const cadernoAntes = await chamar('GET', `/api/subscriber/tentativas/${tentativa}/caderno-erros`, undefined, token);
    assert.equal(cadernoAntes.status, 400, 'não revela erros antes da conclusão');
    assert.match(cadernoAntes.json.erro, /terminar|conclu/i);

    // Encerrar: agora a nota sai.
    const fim = await chamar('POST', `/api/subscriber/tentativas/${tentativa}/finalizar`, {}, token);
    assert.equal(fim.status, 200);
    assert.equal(fim.json.corretas, 1, 'a resposta certa foi contada');
    assert.equal(fim.json.erradas, 0);
    assert.equal(fim.json.respondidas, 1);

    // Revelar: agora sai, e traz a letra.
    const revelacao = await chamar('POST', `/api/subscriber/tentativas/${tentativa}/revelar`, {}, token);
    assert.equal(revelacao.status, 200);
    assert.equal(revelacao.json.respostas[0].correct_option, 'C');
    assert.equal(revelacao.json.respostas[0].chosen_option, 'C');
    const cadernoVazio = await chamar('GET', `/api/subscriber/tentativas/${tentativa}/caderno-erros`, undefined, token);
    assert.equal(cadernoVazio.status, 200);
    assert.equal(cadernoVazio.json.total_erros, 0, 'resposta certa não entra no caderno');
    assert.deepEqual(cadernoVazio.json.erros, []);
    // Outra tentativa concluída, agora com uma resposta ERRADA: o caderno
    // é derivado do mesmo gabarito final, sem tabela/projeção concorrente.
    const inicioErrada = await chamar('POST', `/api/subscriber/provas/${forma.id}/tentativa`, {}, token);
    assert.equal(inicioErrada.status, 200);
    const tentativaErrada = inicioErrada.json.tentativa;
    const registroErrado = await chamar('POST', `/api/subscriber/tentativas/${tentativaErrada}/respostas`, {ordinal:1,opcao:'A'}, token);
    assert.deepEqual(registroErrado.json, {registrada:true});
    const fimErrada = await chamar('POST', `/api/subscriber/tentativas/${tentativaErrada}/finalizar`, {}, token);
    assert.equal(fimErrada.status, 200);
    assert.equal(fimErrada.json.erradas, 1);
    const erros = await chamar('GET', `/api/subscriber/tentativas/${tentativaErrada}/caderno-erros`, undefined, token);
    assert.equal(erros.status, 200, JSON.stringify(erros.json));
    assert.equal(erros.json.total_erros, 1);
    assert.equal(erros.json.erros[0].ordinal, 1);
    assert.equal(erros.json.erros[0].chosen_option, 'A');
    assert.equal(erros.json.erros[0].correct_option, 'C');
    assert.equal(erros.json.erros[0].verdict, 'errada');
  });

  await t.test('quem não é o dono da tentativa não mexe nela', async () => {
    // Dário entra, com a mesma sessão honesta, e tenta mexer na tentativa
    // da Carla. O banco é quem recusa.
    await chamar('POST', '/api/auth/link', { email: 'dario@exemplo.com' });
    const linkDario = entregues[entregues.length - 1].link;
    const sessaoDario = await chamar('POST', '/api/auth/sessao', { token: linkDario });
    const tokenDario = sessaoDario.json.token;
    // A recusa que ESTE teste quer provar é propriedade/RLS, não a ausência
    // de assinatura. Ambos têm direito ao produto; Dário não é o dono.
    const userDario = await one(db, `SELECT id FROM identity.account WHERE email = 'dario@exemplo.com'`);
    await db.query(
      `INSERT INTO commerce.subscription (user_id, plan_id, status, current_period_start, current_period_end)
       SELECT $1, id, 'ativa', now(), now() + interval '30 days' FROM commerce.plan WHERE key = 'completo'`,
      [userDario.id]
    );

    const carla = await one(db, `SELECT id FROM identity.account WHERE email = 'carla@exemplo.com'`);
    const tentativa = await one(
      db,
      `SELECT id FROM learning.exam_attempt WHERE user_id = $1 LIMIT 1`,
      [carla.id]
    );
    assert.ok(tentativa, 'a tentativa da Carla existe');

    const furada = await chamar(
      'POST',
      `/api/subscriber/tentativas/${tentativa.id}/respostas`,
      { ordinal: 2, opcao: 'A' },
      tokenDario
    );
    assert.equal(furada.status, 400, 'a resposta alheia é recusada');
    assert.match(furada.json.erro, /tentativa|pertenc|não encontrad/i);

    // E a tentativa continua com o que tinha.
    const depois = await one(
      db,
      `SELECT count(*)::int AS n FROM learning.exam_attempt_answer WHERE attempt_id = $1`,
      [tentativa.id]
    );
    assert.equal(depois.n, 1, 'a resposta de Dário não entrou na tentativa da Carla');
    const cadernoAlheio = await chamar('GET', `/api/subscriber/tentativas/${tentativa.id}/caderno-erros`, undefined, tokenDario);
    assert.equal(cadernoAlheio.status, 400, 'assinante sem propriedade não lê caderno alheio');
    assert.match(cadernoAlheio.json.erro, /tentativa|pertenc/i);

  });


  await t.test('revogação do direito de acesso bloqueia responder, finalizar e revelar', async () => {
    await chamar('POST', '/api/auth/link', { email: 'eva-s9@exemplo.com' });
    const linkEva = entregues[entregues.length - 1].link;
    const sessaoEva = await chamar('POST', '/api/auth/sessao', { token: linkEva });
    assert.equal(sessaoEva.status, 200);
    const tokenEva = sessaoEva.json.token;
    const eva = await one(db, `SELECT id FROM identity.account WHERE email = 'eva-s9@exemplo.com'`);
    await db.query(
      `INSERT INTO commerce.subscription (user_id, plan_id, status, current_period_start, current_period_end)
       SELECT $1, id, 'ativa', now(), now() + interval '30 days' FROM commerce.plan WHERE key = 'completo'`,
      [eva.id]
    );
    const inicio = await chamar('POST', `/api/subscriber/provas/${forma.id}/tentativa`, {}, tokenEva);
    assert.equal(inicio.status, 200);
    const tentativaId = inicio.json.tentativa;
    await db.query(`UPDATE commerce.subscription SET status = 'cancelada' WHERE user_id = $1`, [eva.id]);
    const caminhos = [
      ['/api/subscriber/provas', 'GET', undefined],
      [`/api/subscriber/provas/${forma.id}/questoes`, 'GET', undefined],
      [`/api/subscriber/provas/${forma.id}/tentativa`, 'POST', {}],
      [`/api/subscriber/tentativas/${tentativaId}/respostas`, 'POST', { ordinal: 1, opcao: 'A' }],
      [`/api/subscriber/tentativas/${tentativaId}/finalizar`, 'POST', {}],
      [`/api/subscriber/tentativas/${tentativaId}/revelar`, 'POST', {}],
      [`/api/subscriber/tentativas/${tentativaId}/caderno-erros`, 'GET', undefined],
    ];
    for (const [path, method, body] of caminhos) {
      const r = await chamar(method, path, body, tokenEva);
      assert.equal(r.status, 400, `revogação deve recusar ${path}: ${JSON.stringify(r)}`);
      assert.match(r.json.erro, /assinatura ativa|concessão vigente/i);
    }
    const persisted = await one(db, `SELECT status, answered_count FROM learning.exam_attempt WHERE id = $1`, [tentativaId]);
    assert.equal(persisted.status, 'em_andamento');
    assert.equal(persisted.answered_count, 0);
  });

  await t.test('conta bloqueada não recupera sessão nem se reativa via magic-link', async () => {
    await chamar('POST', '/api/auth/link', { email: 'frida-s9@exemplo.com' });
    const link = entregues[entregues.length - 1].link;
    const sessao = await chamar('POST', '/api/auth/sessao', { token: link });
    assert.equal(sessao.status, 200);
    const conta = await one(db, `SELECT id FROM identity.account WHERE email = 'frida-s9@exemplo.com'`);
    await db.query(`UPDATE identity.account SET status = 'bloqueado' WHERE id = $1`, [conta.id]);
    const semAcesso = await chamar('GET', '/api/subscriber/provas', undefined, sessao.json.token);
    assert.equal(semAcesso.status, 401);
    await chamar('POST', '/api/auth/link', { email: 'frida-s9@exemplo.com' });
    const outroLink = entregues[entregues.length - 1].link;
    const negado = await chamar('POST', '/api/auth/sessao', { token: outroLink });
    assert.equal(negado.status, 400);
    const depois = await one(db, `SELECT status FROM identity.account WHERE id = $1`, [conta.id]);
    assert.equal(depois.status, 'bloqueado');
  });

  await t.test('origem externa não consegue acionar requisições e corpo acima de 64 KiB é rejeitado', async () => {
    const cross = await fetch(base + '/api/auth/link', {
      method:'POST', headers:{ origin:'https://intruso.invalid','content-type':'application/json' },
      body: JSON.stringify({ email:'cross@exemplo.com' }),
    });
    assert.equal(cross.status, 403);
    const huge = await fetch(base + '/api/auth/link', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ email:'a'.repeat(65_536) + '@exemplo.com' }),
    });
    assert.equal(huge.status, 413);
  });

});
