import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanSql,rewriteQualifiedIdentifiers,reviewOriginalSql,generatePortReview } from '../port-sql.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const base=resolve(here,'..');
const mapping={identity:'canone_identity',editorial:'canone_editorial',taxonomy:'canone_taxonomy',learning:'canone_learning',public:'canone_public'};

test('SQL port is conscious of comments, literals, nested comments, identifiers and dollar quote bodies',()=>{
 const input=`-- identity.account must stay literally here\n/* editorial.source /* taxonomy.module */ */\nSELECT identity.account, taxonomy.module, 'learning.item', 'it''s public.foo', "identity"."account", $$ SELECT learning.item $$;`;
 const output=rewriteQualifiedIdentifiers(input,mapping);
 assert.match(output,/SELECT canone_identity.account, canone_taxonomy.module/);
 assert.match(output,/-- identity.account must stay literally here/);
 assert.match(output,/\/\* editorial.source \/\* taxonomy.module \*\/ \*\//);
 assert.match(output,/'learning.item'/);
 assert.match(output,/"identity"\."account"/);
 assert.match(output,/\$\$ SELECT learning.item \$\$/);
 assert.equal(scanSql(output).map(x=>x.value).join(''),output);
});

test('malformed quotes and comments fail closed',()=>{
 for(const s of ["SELECT 'missing",'SELECT /* missing','SELECT $$ body','SELECT "broken']){
  assert.throws(()=>scanSql(s),/BLOCK_SQL_PORT/);
 }
});

test('untrusted SQL is not declared executable when privileged',()=>{
 const raw='CREATE EXTENSION citext; CREATE ROLE other; CREATE OR REPLACE FUNCTION learning.x() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 2 $$;';
 const r=reviewOriginalSql('evil.sql',raw,mapping);
 for(const x of ['EXTENSION_GLOBAL','ROLE_GLOBAL','PRIVILEGED_FUNCTION','DOLLAR_BODY_NOT_LEXICALLY_PORTED','FUNCTION_SECURITY_REVIEW'])assert.ok(r.hazards.includes(x));
});

test('six migrated candidates preserve source hashes and fail closed',()=>{
 const r=generatePortReview();
 assert.equal(r.count,6);
 assert.equal(r.executableCount,0);
 assert.equal(r.release,'HOLD_HUMAN_NO_GO');
 for(const [i,m] of r.migrations.entries()){
  assert.equal(m.file.slice(0,3),String(i+2).padStart(3,'0'));
  assert.equal(m.state,'HOLD_PORT_REVIEW');
  assert.equal(m.executeAllowed,false);
  assert.ok(m.hazards.includes('MIGRATION_001_ROLES_EXTENSION_DEPENDENCY'));
  const generated=readFileSync(resolve(base,'generated','REVIEW_ONLY_'+m.file),'utf8');
  assert.ok(generated.startsWith('-- GENERATED REVIEW ONLY. DO NOT EXECUTE ON SHARED SUPABASE.'));
  assert.doesNotMatch(generated,/^CREATE TABLE (?:identity|editorial|taxonomy|learning|norms)\./m);
 }
 assert.ok(r.migrations[0].hazards.includes('CITEXT_EXTENSION_UNAVAILABLE'));
 assert.ok(r.migrations[4].hazards.includes('PRIVILEGED_FUNCTION'));
});

test('generated candidates do not add grants to public/shared tenant tables',()=>{
 const r=generatePortReview();
 for(const m of r.migrations){
  const sql=readFileSync(resolve(base,'generated','REVIEW_ONLY_'+m.file),'utf8');
  assert.doesNotMatch(sql,/^\s*(?:GRANT|REVOKE)\s+[^;]*(?:TO|FROM)\s+(?:anon|authenticated|service_role)\b/gim);
  assert.doesNotMatch(sql,/^\s*(?:ALTER|UPDATE|DELETE|TRUNCATE|DROP)\s+(?:TABLE\s+)?(?:public|ce_platform|contabilidade_cfc)\./gim);
 }
});
