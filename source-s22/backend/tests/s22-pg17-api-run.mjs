/** S22 backend HTTP E2E, only in disposable PG17 via Unix socket.
 * No network service exposed; PG db is not the shared Supabase instance.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PgDb } from '../dist/db/pg-driver.js';
import { subirServidor } from '../dist/http/server.js';

const con=process.env.S22_PG17_CONN ?? '';
if (process.env.S22_DISPOSABLE_ONLY!=='1' || !con.includes('canone_s13_disposable') || !con.includes('postgresql')) {
  throw new Error('S22 REFUSED: explicit disposable PG17 connection required');
}
const email='s22-'+randomBytes(4).toString('hex')+'@example.invalid';
const db=new PgDb({connectionString:con,max:3});
const delivered=[];
let server;
try {
  const check=await db.query('SELECT current_database() AS db, current_setting(\'server_version\') AS version');
  assert.equal(check.rows[0].db,'canone_s13_disposable');
  assert.match(check.rows[0].version,/^17\./);
  server=await subirServidor({db,porta:0,tokenStaff:'s22-staff-not-real',tokenAdmin:'s22-admin-not-real',
    staffUserId:'33333333-3333-4333-8333-333333333333',adminUserId:'44444444-4444-4444-8444-444444444444',
    entregarLink:async (e,token)=>delivered.push({e,token})});
} catch(e){await db.close();throw e;}
const base=`http://127.0.0.1:${server.porta}`;
async function call(method,path,body,token){
 const res=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,body:await res.json()};
}
test.after(async()=>{await server.fechar();await db.close()});
let bearer;
test('S22 PG17: public catalogue responds from canonical schema',async()=>{
 const r=await call('GET','/api/public/catalogo');
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.ok(Array.isArray(r.body.planos));
});
test('S22 PG17: magic-link token stays server-side',async()=>{
 const r=await call('POST','/api/auth/link',{email});
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.deepEqual(r.body,{enviado:true});
 assert.equal(delivered.length,1);
 assert.ok(delivered[0].token.length>20);
});
test('S22 PG17: login token consumed exactly once',async()=>{
 assert.equal(delivered.length,1);
 const token=delivered[0].token;
 const first=await call('POST','/api/auth/sessao',{token});
 assert.equal(first.status,200,JSON.stringify(first.body));
 assert.ok(first.body.token);
 bearer=first.body.token;
 const second=await call('POST','/api/auth/sessao',{token});
 assert.equal(second.status,400,JSON.stringify(second.body));
});
test('S22 PG17: authenticated without entitlement is rejected',async()=>{
 const r=await call('GET','/api/subscriber/provas',undefined,bearer);
 assert.equal(r.status,400,JSON.stringify(r.body));
 assert.match(r.body.erro,/assinatura|concessão/i);
});
test('S22 PG17: logout revokes bearer',async()=>{
 const out=await call('POST','/api/auth/sair',{},bearer);
 assert.equal(out.status,200,JSON.stringify(out.body));
 const again=await call('GET','/api/subscriber/provas',undefined,bearer);
 assert.equal(again.status,401,JSON.stringify(again.body));
});
