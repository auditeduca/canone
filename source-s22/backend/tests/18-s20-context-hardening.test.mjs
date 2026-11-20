/* S20: execute the actual TypeScript request-context implementation in isolation.
 * npm test in the backend installs the declared devDependency `typescript`.
 * Never connects to PostgreSQL or to user credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function loadTs(rel, dependencies={}) {
  const source=readFileSync(resolve(root,rel),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const wrapper=vm.runInNewContext('(function(require,module,exports){'+output+'\n})',{console});
  wrapper(id=>{if(Object.hasOwn(dependencies,id)) return dependencies[id]; throw Error('Unreviewed import: '+id);},mod,mod.exports);
  return mod.exports;
}
const roles=loadTs('src/db/roles.ts');
const context=loadTs('src/db/rls-context.ts',{'./roles.js':roles});
const uuidA='11111111-1111-4111-8111-111111111111';
const uuidR='33333333-3333-4333-8333-333333333333';
function fakeDb() {
  const calls=[];
  const tx={exec:async sql=>{calls.push(sql)},query:async()=>({rows:[],rowCount:0})};
  const db={transaction:async fn=>{calls.push('BEGIN');try{const res=await fn(tx);calls.push('COMMIT');return res;}catch(err){calls.push('ROLLBACK');throw err;}}};
  return {db,calls};
}
test('S20 withArea validates a userId supplied by trusted auth, selects the expected role and request id',async()=>{
 const {db,calls}=fakeDb();const value=await context.withArea(db,{area:'assinante',userId:uuidA,requestId:uuidR},async()=> 'ok');
 assert.equal(value,'ok');assert.deepEqual(calls,['BEGIN','SET LOCAL ROLE canone_subscriber',"SET LOCAL app.current_area = 'assinante'",`SET LOCAL app.current_user_id = '${uuidA}'`,`SET LOCAL app.request_id = '${uuidR}'`,'COMMIT']);
});
test('S20 anonymous public request explicitly clears user and request ID',async()=>{
 const {db,calls}=fakeDb();await context.withArea(db,{area:'publica'},async()=>undefined);
 assert.deepEqual(calls,['BEGIN','SET LOCAL ROLE canone_public',"SET LOCAL app.current_area = 'publica'","SET LOCAL app.current_user_id = ''","SET LOCAL app.request_id = ''",'COMMIT']);
});
test('S20 access route never inherits previous request ID',async()=>{
 const {db,calls}=fakeDb();await context.withArea(db,{area:'acesso'},async()=>undefined);
 assert.ok(calls.includes('SET LOCAL ROLE canone_auth'));
 assert.ok(calls.includes("SET LOCAL app.request_id = ''"));
});
test('S20 withSystem resets user and request ID without choosing a privileged client role',async()=>{
 const {db,calls}=fakeDb();await context.withSystem(db,async()=>undefined);
 assert.deepEqual(calls,['BEGIN',"SET LOCAL app.current_area = 'sistema'","SET LOCAL app.current_user_id = ''","SET LOCAL app.request_id = ''",'COMMIT']);
});
test('S20 malformed userId rolls back before changing SQL role',async()=>{
 const {db,calls}=fakeDb();await assert.rejects(()=>context.withArea(db,{area:'assinante',userId:"' OR true --"},async()=>undefined),/uuid/);
 assert.deepEqual(calls,['BEGIN','ROLLBACK']);
});
test('S20 invalid role cannot enter interpolated SQL',async()=>{
 const {db,calls}=fakeDb();await assert.rejects(()=>context.withArea(db,{area:'malicious; DROP TABLE accounts;'},async()=>undefined),/Área desconhecida/);
 assert.deepEqual(calls,['BEGIN','ROLLBACK']);
});
test('S20 callback failure rolls back SET LOCAL context',async()=>{
 const {db,calls}=fakeDb();await assert.rejects(()=>context.withArea(db,{area:'assinante',userId:uuidA},async()=>{throw Error('unit-failure')}),/unit-failure/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.ok(calls.includes("SET LOCAL app.request_id = ''"));
});
test('S20 HTTP derives subscriber identity from a token-backed server session, never a request-body userId',()=>{
 const server=readFileSync(resolve(root,'src/http/server.ts'),'utf8');
 const api=readFileSync(resolve(root,'src/http/api.ts'),'utf8');
 assert.match(server,/acesso\.usuarioDaSessao\(tx, token\)/);
 assert.match(server,/if \(usuario\) sessao = \{ userId: usuario, token \}/);
 assert.match(api,/const userId = ctx\.sessao\?\.userId/);
 assert.doesNotMatch(api,/const userId = campo\(ctx\.corpo,\s*['"]userId/);
});

test('S20 invalid requestId cannot affect SQL context',async()=>{
 const {db,calls}=fakeDb();await assert.rejects(()=>context.withArea(db,{area:'assinante',userId:uuidA,requestId:"not-a-uuid"},async()=>undefined),/uuid/);
 assert.deepEqual(calls,['BEGIN','ROLLBACK']);
});
test('S20 system callback failure leaves no committed context',async()=>{
 const {db,calls}=fakeDb();await assert.rejects(()=>context.withSystem(db,async()=>{throw Error('system-failed')}),/system-failed/);
 assert.ok(calls.includes("SET LOCAL app.request_id = ''"));
 assert.equal(calls.at(-1),'ROLLBACK');
});
