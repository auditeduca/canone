import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sql=readFileSync(resolve(dir,'001_canone_shared_host_namespace_v1.sql'),'utf8');
const manifest=JSON.parse(readFileSync(resolve(dir,'S5_NAMESPACE_MANIFEST.json'),'utf8'));
const forbidden=[/\bCREATE\s+EXTENSION\b/i,/\bCREATE\s+ROLE\b/i,/\bGRANT\s+\S+\s+TO\s+(?:anon|authenticated|service_role)\b/i,/\b(?:ALTER|DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)\s+(?:public|contabilidade_cfc|ce_platform)\b/i,/\bINSERT\s+INTO\s+(?!canone_control\.)/i,/\bCREATE\s+TABLE\s+(?!canone_control\.)/i];
test('only owned namespaces are declared',()=>{
 assert.equal(manifest.schemas.length,14);
 for(const s of manifest.schemas){assert.match(s.new,/^canone_[a-z_]+$/);assert.ok(sql.includes(`CREATE SCHEMA ${s.new};`));assert.ok(sql.includes(`REVOKE ALL ON SCHEMA ${s.new} FROM PUBLIC, anon, authenticated, service_role;`));}
});
test('no global DDL and no grants to app roles',()=>{for(const re of forbidden)assert.equal(re.test(sql),false,String(re))});
test('all four control tables fail-closed with forced RLS',()=>{
 for(const t of ['schema_map','migration_catalog','release_gate','external_source_binding']){
 assert.ok(sql.includes(`ALTER TABLE canone_control.${t} ENABLE ROW LEVEL SECURITY;`));
 assert.ok(sql.includes(`ALTER TABLE canone_control.${t} FORCE ROW LEVEL SECURITY;`));
 assert.ok(sql.includes(`REVOKE ALL ON canone_control.${t} FROM PUBLIC, anon, authenticated, service_role;`));
 }
 assert.doesNotMatch(sql,/\bCREATE POLICY\b/i);
});
test('original 30 migrations hash-match and none marked applied',()=>{
 assert.equal(manifest.original_migrations.length,30);
 for(const [i,m] of manifest.original_migrations.entries()){
  assert.equal(Number(m.file.slice(0,3)),i+1);
  assert.equal(m.status,'NOT_APPLIED');
  const raw=readFileSync(resolve(dir,'../migrations',m.file));
  assert.equal(createHash('sha256').update(raw).digest('hex'),m.sha256);
  assert.ok(sql.includes(m.sha256));
 }
});
test('DDL hash and source target preserved',()=>{
 assert.equal(createHash('sha256').update(sql).digest('hex'),manifest.ddl_sha256);
 assert.equal(manifest.target_project_id,'pgsybzggewhinaniybiy');
 assert.equal(manifest.release,'HOLD_HUMAN_NO_GO');
});
