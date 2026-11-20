#!/usr/bin/env node
/* ============================================================================
   CÂNONE — PROVA DE FORMA DO COMANDER (ponta a ponta)
   ---------------------------------------------------------------------------
   A prova não é "a tela renderiza". A prova é: o ADMINISTRADOR age sobre o
   BANCO, pela tela, e o que ele vê é a resposta do banco.

   O roteiro:
     1. sobe o schema (PGlite) e cria um staff e um aluno;
     2. sobe o comander HTTP;
     3. compila o app com a URL do comander;
     4. serve o app e dirige o navegador de verdade (Chromium);
     5. o admin escolhe um comando, pede a PRÉVIA e confere que a prévia
        diz o que o banco faria — e que NADA foi gravado;
     6. o admin EXECUTA, e a concessão passa a existir no banco;
     7. o admin abre a GOVERNANÇA e vê a concessão, a fila e a cadeia de
        auditoria.

   Se qualquer passo não bater, a prova falha. Estado não medido é NOT_RUN.
   ========================================================================== */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGliteDb } from '../dist/db/pglite-driver.js';
import { subirServidor } from '../dist/http/server.js';
import { runMigrations } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(HERE, '..', '..');
const APP = join(RAIZ, 'app');
const TOKENS = { staff: 'token-staff-prova', admin: 'token-admin-prova' };

const passos = [];
function ok(msg) { passos.push(`  ✓ ${msg}`); console.log(`  ✓ ${msg}`); }
function falha(msg) { passos.push(`  ✗ ${msg}`); console.log(`  ✗ ${msg}`); }

// O pacote do backend não traz o app (ele é do repositório completo).
// A prova de navegador precisa dele — e PULA, declarado, em vez de
// fingir que passou.
if (!existsSync(join(APP, 'package.json'))) {
  console.log('PULADO · a prova de navegador precisa do app (../app), que não está neste pacote.');
  console.log('         No repositório completo: npm run comander:e2e');
  process.exit(0);
}

console.log('=== 1 · SCHEMA ===');
const pg = await PGlite.create({ extensions: { citext, pg_trgm, btree_gist } });
const relatorio = await runMigrations(pg, { log: () => {} });
console.log(`  ${relatorio.length} migration(s) aplicada(s)`);
const db = new PGliteDb(pg);

console.log('=== 2 · PESSOAS ===');
const mk = async (email) => {
  const r = await pg.query(
    `INSERT INTO identity.account (email, status, email_verified_at)
     VALUES ($1, 'ativo', now()) RETURNING id`, [email]);
  const id = r.rows[0].id;
  await pg.query(
    `INSERT INTO identity.user_profile (user_id, display_name) VALUES ($1, $2)`,
    [id, email.split('@')[0]]);
  return id;
};
const staff = await mk('staff-prova@test.invalid');
const aluno = await mk('aluno-prova@test.invalid');
ok(`staff ${staff.slice(0, 8)}… e aluno ${aluno.slice(0, 8)}… criados`);

console.log('=== 3 · COMANDER NO AR ===');
const servidor = await subirServidor({
  db, tokenStaff: TOKENS.staff, tokenAdmin: TOKENS.admin,
  staffUserId: staff, adminUserId: staff, porta: 0,
  // A origem do app é CONFIGURADA: sem isso, o navegador recusa a
  // chamada de outra origem — e o comander não liberaria CORS para
  // qualquer origem, por padrão.
  origem: 'http://127.0.0.1:4179',
});
const base = `http://127.0.0.1:${servidor.porta}`;
ok(`ouvindo em ${base}`);

console.log('=== 4 · APP COMPILADO CONTRA O COMANDER ===');
const distTeste = join(APP, 'dist-prova');
rmSync(distTeste, { recursive: true, force: true });
// A build vai para uma pasta SEPARADA: o dist de entrega não pode ficar
// com a URL do comander local assada dentro dele.
execFileSync('npx', ['vite', 'build', '--outDir', 'dist-prova', '--emptyOutDir'], {
  cwd: APP,
  env: { ...process.env, VITE_COMANDER_URL: base, VITE_COMANDER_TOKEN: TOKENS.staff },
  stdio: 'pipe',
});
ok('app compilado com a URL do comander');

const tipos = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const appServer = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(distTeste, p === '/' ? 'index.html' : p);
  if (!existsSync(f) || f.endsWith('/')) f = join(distTeste, 'index.html');
  res.writeHead(200, { 'content-type': tipos[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => appServer.listen(4179, r));
ok('app servido em http://127.0.0.1:4179');

console.log('=== 5 · O ADMINISTRADOR AGE (Chromium) ===');
const { chromium } = await import(join(APP, 'node_modules/playwright/index.mjs'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const errosConsole = [];
page.on('pageerror', (e) => errosConsole.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text().slice(0, 200)); });

await page.goto('http://127.0.0.1:4179/#/comander', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// 5.1 · o app reconheceu o backend
const status = await page.locator('.cmd-status').innerText();
if (status.includes('Conectado')) ok('a tela reconhece o comander conectado');
else falha(`a tela não reconheceu o backend: ${status.replace(/\n/g, ' ')}`);

// 5.2 · escolhe o comando e preenche
await page.locator('.cmd-item', { hasText: 'Conceder acesso ao progresso' }).first().click();
await page.waitForTimeout(200);
await page.locator('input.cmd-input').first().fill(aluno);
await page.locator('input.cmd-input').nth(1).fill('Chamado de suporte aberto pelo aluno sobre o gabarito.');

// 5.3 · a PRÉVIA
await page.getByRole('button', { name: 'Pré-visualizar' }).click();
await page.waitForTimeout(700);
const previaTxt = await page.locator('.cmd-resultado').innerText().catch(() => '');
if (previaTxt.includes('Concessão criada')) ok('a prévia diz o que o banco faria');
else falha(`a prévia não mostrou o efeito: ${previaTxt.replace(/\n/g, ' ')}`);

// 5.4 · a prévia NÃO gravou
const antes = await pg.query(`SELECT count(*)::int AS n FROM admin.support_access_grant`);
if (antes.rows[0].n === 0) ok('a prévia não gravou nada (execução desfeita)');
else falha(`a prévia gravou ${antes.rows[0].n} registro(s)`);

// 5.5 · a EXECUÇÃO
await page.getByRole('button', { name: 'Executar' }).click();
await page.waitForTimeout(800);
const depois = await pg.query(
  `SELECT count(*)::int AS n, min(reason) AS motivo FROM admin.support_access_grant`);
if (depois.rows[0].n === 1) ok('a execução gravou a concessão no banco');
else falha(`a execução não gravou: ${depois.rows[0].n}`);

// 5.6 · a GOVERNANÇA
await page.getByRole('tab', { name: 'Governança' }).click();
await page.waitForTimeout(900);
const gov = await page.locator('.cmd-gov').innerText().catch(() => '');
if (gov.includes('íntegra')) ok('a governança mostra a cadeia de auditoria íntegra');
else falha(`a governança não mostrou a cadeia: ${gov.slice(0, 160).replace(/\n/g, ' ')}`);
if (gov.includes('Chamado de suporte')) ok('a governança mostra a concessão recém-criada');
else falha('a governança não mostrou a concessão');
await page.screenshot({ path: join(RAIZ, 'output', 'telas', 'governanca-e2e.png'), fullPage: false });

// 5.7 · a recusa do banco aparece na tela
await page.getByRole('tab', { name: 'Comander' }).click();
await page.waitForTimeout(300);
await page.locator('input.cmd-input').nth(1).fill('curto');
await page.getByRole('button', { name: 'Pré-visualizar' }).click();
await page.waitForTimeout(700);
const recusaTxt = await page.locator('.cmd-resultado').innerText().catch(() => '');
const recusaEhErro = await page.locator('.cmd-resultado-erro').count();
if (recusaEhErro > 0 && recusaTxt.length > 0) {
  ok(`a recusa do banco aparece na tela, com a mensagem dele (${recusaTxt.replace(/\n/g, ' ').slice(0, 80)})`);
} else {
  falha(`a recusa do banco não apareceu: ${recusaTxt.replace(/\n/g, ' ')}`);
}

if (errosConsole.length === 0) ok('nenhum erro de console');
else falha(`erros de console: ${errosConsole.join(' | ')}`);

await page.screenshot({ path: join(RAIZ, 'output', 'telas', 'comander-e2e.png'), fullPage: false });
await browser.close();
appServer.close();
await servidor.fechar();
await db.close();
rmSync(distTeste, { recursive: true, force: true });

const fracoes = passos.filter((p) => p.startsWith('  ✗')).length;
console.log('\n=== RESULTADO ===');
for (const p of passos) console.log(p);
console.log(fracoes === 0 ? '\n✓ O comander funciona de ponta a ponta.' : `\n✗ ${fracoes} passo(s) falharam.`);
process.exit(fracoes === 0 ? 0 : 1);
