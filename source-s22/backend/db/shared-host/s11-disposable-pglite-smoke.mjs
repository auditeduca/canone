#!/usr/bin/env node
/** S11 disposable QA, not a migration runner for production.
 * ONLY PGlite in-memory. Never reads credentials nor connects to network/db.
 */
import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import {readFileSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scanSql,rewriteQualifiedIdentifiers} from './port-sql.mjs';
import {generateS11} from './s11-review-all.mjs';
const HERE=dirname(fileURLToPath(import.meta.url));
if(process.env.S11_ALLOW_DISPOSABLE_PGLITE!=='1')throw Error('S11_HOLD: explicit isolated QA switch required');
if(process.env.DATABASE_URL || process.env.PGHOST || process.env.SUPABASE_DB_URL)throw Error('S11_HOLD: external database credentials must not be present');
const manifest=JSON.parse(readFileSync(join(HERE,'S5_NAMESPACE_MANIFEST.json'),'utf8'));
const map=Object.fromEntries(manifest.schemas.map(s=>[s.old,s.new]));
const report=generateS11({write:true});
if(report.isolatedQaCandidateCount!==4||report.liveExecutableCount!==0)throw Error('S11_HOLD: unexpected QA scope');
// Only transient PGlite: isolated schema mirror, global citext available in PGlite QA only.
const db=new PGlite({extensions:{citext}});
const assert=(x,m)=>{if(!x)throw Error('S11_QA_FAIL '+m);};
const tables={};
try{
 await db.exec('CREATE EXTENSION IF NOT EXISTS citext');
 await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN');
 await db.exec('CREATE TABLE public.s11_sentinel (id integer PRIMARY KEY, marker text NOT NULL); INSERT INTO public.s11_sentinel VALUES (1,\'foreign schema untouched\')');
 for(const s of manifest.schemas){await db.exec(`CREATE SCHEMA ${s.new}; REVOKE ALL ON SCHEMA ${s.new} FROM PUBLIC, anon, authenticated, service_role;`)}
 for(let n=2;n<=5;n++){
  const file=manifest.original_migrations[n-1].file;
  const original=readFileSync(resolve(HERE,'../migrations',file),'utf8');
  const scan=scanSql(original);
  assert(!scan.some(x=>x.type==='dollar'),'procedural SQL blocked '+file);
  const row=report.report[n-1];
  assert(row.isolationQaCandidate && !row.hazards.some(h=>['SECURITY_DEFINER_REVIEW','GRANT_OR_REVOKE_REVIEW','SHARED_OR_EXTERNAL_DDL','CREATE_ROLE_GLOBAL','NON_CODE_SQL_BODY_NEEDS_SEMANTIC_PORT'].includes(h)),'unsafe QA migration ' + file);
  const projected=rewriteQualifiedIdentifiers(original,map);
  assert(!/\b(?:identity|editorial|taxonomy|norms)\s*\./.test(scanSql(projected).filter(x=>x.type==='code').map(x=>x.value).join('')),'unmapped code '+file);
  await db.exec('BEGIN');
  try{
   // This subset contains no dollar-quoted function bodies or dynamic SQL.
   // PGlite exec runs the SQL text in the isolated database as PostgreSQL statements.
   await db.exec(projected);
   await db.exec('COMMIT');
  }catch(e){await db.exec('ROLLBACK');throw new Error(`S11_PGLITE_MIGRATION_${n}_FAIL: ${e.message}`)}
  const check=await db.query('SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_type=$2',[map[n===2?'identity':n===3?'editorial':n===4?'taxonomy':'norms'],'BASE TABLE']);
  tables[file]=check.rows[0].n;
  console.log(`S11_ISOLATED_PGLITE_PASS ${file} tables_in_primary_schema=${check.rows[0].n}`);
 }
 const schemaCheck=await db.query(`SELECT COUNT(*)::int AS n FROM pg_namespace WHERE left(nspname,7)='canone_'`);
 assert(schemaCheck.rows[0].n===14,'schema count '+schemaCheck.rows[0].n);
 const live=await db.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema LIKE 'canone_%' AND table_type='BASE TABLE'");
 assert(live.rows[0].n===37,'expected 37 structural tables, got '+live.rows[0].n);
 const sentinel=await db.query('SELECT marker FROM public.s11_sentinel WHERE id=1');
 assert(sentinel.rows[0]?.marker==='foreign schema untouched','external schema touched');
 const access=await db.query(`SELECT count(*)::int AS n FROM pg_namespace WHERE left(nspname,7)='canone_' AND (has_schema_privilege('anon',oid,'USAGE') OR has_schema_privilege('authenticated',oid,'USAGE') OR has_schema_privilege('service_role',oid,'USAGE'))`);
 assert(access.rows[0].n===0,'schema exposed');
 const policies=await db.query("SELECT COUNT(*)::int AS enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE left(n.nspname,7)='canone_' AND c.relkind='r' AND c.relrowsecurity");
 assert(policies.rows[0].enabled===0,'early phase should not claim RLS is ready');
 const out={status:'QA_ONLY_PASS',engine:'disposable-PGlite-no-external-credentials',migrations:['002','003','004','005'],schemas:14,tables:live.rows[0].n,earlyRlsEnabled:policies.rows[0].enabled,exposedSchemas:access.rows[0].n,externalSchemaSentinel:'unchanged',release:'HOLD_HUMAN_NO_GO',tablePerPrimarySchema:tables};
 console.log('S11_PGLITE_QA_EVIDENCE '+JSON.stringify(out));
}finally{await db.close()}
