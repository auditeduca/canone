#!/usr/bin/env node
/* ============================================================================
   CÂNONE — SOBE O COMANDER
   ---------------------------------------------------------------------------
   Sobe o backend da área do administrador (HTTP) sobre um PGlite — o mesmo
   Postgres 16.4 em WASM que a suíte usa. Sem Docker, sem Postgres
   instalado, sem .env.

   Variáveis de ambiente:
     CANONE_COMANDER_PORTA   porta HTTP (padrão 8787)
     CANONE_COMANDER_PGDATA  diretório de dados (padrão :memory:)
     CANONE_TOKEN_STAFF       token do nível staff
     CANONE_TOKEN_ADMIN       token do nível admin
     CANONE_STAFF_USER_ID     id do usuário staff (papel das ações)
     CANONE_ADMIN_USER_ID     id do usuário admin (papel das ações)
   ========================================================================== */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGliteDb } from '../dist/db/pglite-driver.js';
import { subirServidor } from '../dist/http/server.js';
import { runMigrations } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const env = process.env;
const dataDir = env.CANONE_COMANDER_PGDATA || ':memory:';
const porta = Number(env.CANONE_COMANDER_PORTA || 8787);

// O PGlite trata ':memory:' como um CAMINHO (e cria a pasta). O banco
// em memória de verdade é o que acontece quando dataDir não vem.
const pg = await PGlite.create({
  ...(dataDir === ':memory:' ? {} : { dataDir }),
  extensions: { citext, pg_trgm, btree_gist },
});
const crud = pg;

// As migrations passam pelo RUNNER (que tem o splitter de $$ e grava o
// checksum) — nada de aplicar SQL à mão.
const relatorio = await runMigrations(crud, { log: () => {} });
const aplicadas = relatorio.filter((r) => r.status === 'aplicada').length;
console.log(`Schema aplicado: ${aplicadas} migration(s) em ${dataDir}`);

const db = new PGliteDb(pg);

/**
 * O operador.
 *
 * O Cânone ainda não tem diretório de Staff. Os ids vêm da configuração —
 * é uma simplificação explícita, e não uma fingência de modelo: quem
 * opera é quem a configuração diz que é.
 */
const staffUserId = env.CANONE_STAFF_USER_ID;
const adminUserId = env.CANONE_ADMIN_USER_ID;
if (!staffUserId || !adminUserId) {
  console.error(
    'Faltam CANONE_STAFF_USER_ID e CANONE_ADMIN_USER_ID. O comander não sobe ' +
      'sem saber QUEM opera — fail-fast.'
  );
  process.exit(1);
}

const servidor = await subirServidor({
  db,
  tokenStaff: env.CANONE_TOKEN_STAFF || 'token-staff-local',
  tokenAdmin: env.CANONE_TOKEN_ADMIN || 'token-admin-local',
  staffUserId,
  adminUserId,
  porta,
});
console.log(`Comander no ar: http://127.0.0.1:${servidor.porta}`);
console.log('  GET  /api/comander/comandos');
console.log('  GET  /api/comander/estado');
console.log('  POST /api/comander/comandos/:id/previa');
console.log('  POST /api/comander/comandos/:id');

const encerrar = async () => {
  await servidor.fechar();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
