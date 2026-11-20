import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGateway, getBearer, makeSupabaseAuthVerifier, makePgExecutor,
  GatewayError, FEATURE_KEY, SQL } from '../gateway/alpha9-core.mjs';
import { validateEnvironment, makeServer } from '../gateway/alpha9-server.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const FORM='00000000-0000-4000-8000-000000000004';
const TOKEN='aaa.bbb.ccc';
const headers={ authorization:`Bearer ${TOKEN}`, 'content-type':'application/json' };
const call=(gw,path,body,extra={})=>gw({method:'POST',path,headers,rawBody:JSON.stringify(body),...extra});
function fixture({ allowed=true, actor=A }={}) {
  const calls=[];
  const gateway=createGateway({
    verifyUser: async () => actor,
    dbExecutor: async input => { calls.push(input);if (!allowed) throw new GatewayError(403,'FEATURE_NOT_AUTHORIZED');return {id:FORM}; },
  });
  return {gateway,calls};
}
test('Bearer token format enforced before Auth server',()=>{
  assert.equal(getBearer(headers),TOKEN);
  for(const authorization of [undefined,'Bearer','Basic xxx','Bearer fake','Bearer .x.y','Bearer a.b.c.d']){
    assert.throws(()=>getBearer({authorization}),GatewayError);
  }
});
test('Supabase Auth network verification authenticates subject, not JWT payload or user metadata',async()=>{
  const requests=[];
  const verify=makeSupabaseAuthVerifier({url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'pk_test_synthetic',
    fetchImpl:async (url,options)=>{requests.push({url:String(url),...options});return {ok:true,json:async()=>({id:A,is_anonymous:false,user_metadata:{role:'admin'},app_metadata:{role:'admin'}})};}});
  assert.equal(await verify(TOKEN),A);
  assert.equal(requests[0].url,'https://abcdefghijklmnopqrst.supabase.co/auth/v1/user');
  assert.equal(requests[0].headers.Authorization,`Bearer ${TOKEN}`);
  assert.equal(requests[0].headers.apikey,'pk_test_synthetic');
  assert.equal(requests[0].redirect,'error');
  assert.equal(requests[0].cache,'no-store');
});
test('Auth verifier rejects invalid upstream response and anonymous users',async()=>{
  for(const response of [
    {ok:false,status:401}, {ok:false,status:429}, {ok:true,json:async()=>({id:B,is_anonymous:true})},
    {ok:true,json:async()=>({id:'bad-id'})},
  ]){
    const verify=makeSupabaseAuthVerifier({url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'pk',fetchImpl:async()=>response});
    await assert.rejects(verify(TOKEN),GatewayError);
  }
});
test('Auth verifier fails closed on network problems and disallowed URL',async()=>{
  assert.throws(()=>makeSupabaseAuthVerifier({url:'http://abcdefghijklmnopqrst.supabase.co',publishableKey:'pk'}));
  assert.throws(()=>makeSupabaseAuthVerifier({url:'https://evil.example',publishableKey:'pk'}));
  const verify=makeSupabaseAuthVerifier({url:'https://abcdefghijklmnopqrst.supabase.co',publishableKey:'pk',fetchImpl:async()=>{throw Error('offline');}});
  await assert.rejects(verify(TOKEN),e=>e.code==='AUTH_UNAVAILABLE');
});
test('Gateway forbids unknown routes, methods, invalid shapes and fields before database',async()=>{
  const {gateway,calls}=fixture();
  const bad=[
    call(gateway,'/nope',{}),
    call(gateway,'/api/v1/exam/start',{formId:FORM},{method:'GET'}),
    call(gateway,'/api/v1/exam/start',{formId:FORM,userId:A}),
    call(gateway,'/api/v1/exam/start',{formId:'not-uuid'}),
    call(gateway,'/api/v1/exam/answer',{attemptId:FORM,ordinal:0,option:'A'}),
    call(gateway,'/api/v1/exam/answer',{attemptId:FORM,ordinal:1,option:'Z'}),
    call(gateway,'/api/v1/exam/review',{attemptId:FORM,ordinal:10001}),
    call(gateway,'/api/v1/exam/start',{formId:FORM},{headers:{...headers,'content-type':'text/plain'}}),
    call(gateway,'/api/v1/exam/start',{formId:FORM},{headers:{'content-type':'application/json'}}),
    call(gateway,'/api/v1/exam/start',{formId:FORM},{rawBody:'{"formId":'}),
  ];
  const responses=await Promise.all(bad);
  assert.ok(responses.every(x=>x.status!==200));
  assert.equal(calls.length,0);
});
test('Gateway forwards exactly verified identity and exact feature for every action',async()=>{
  const {gateway,calls}=fixture();
  const requests=[
    ['/api/v1/exam/start',{formId:FORM},'exam_start'],
    ['/api/v1/exam/answer',{attemptId:FORM,ordinal:2,option:'C'},'exam_answer'],
    ['/api/v1/exam/finish',{attemptId:FORM},'exam_finish'],
    ['/api/v1/exam/reveal',{attemptId:FORM},'exam_reveal'],
    ['/api/v1/exam/review',{attemptId:FORM,ordinal:2},'exam_to_srs'],
  ];
  for(const [route,body,method] of requests){
    const result=await call(gateway,route,body);assert.equal(result.status,200);assert.equal(calls.at(-1).method,method);
  }
  assert.equal(calls.length,5);
  assert.ok(calls.every(c=>c.userId===A && c.featureKey===FEATURE_KEY));
});
test('Gateway denies expired entitlement and does not leak internal error text',async()=>{
  const {gateway}=fixture({allowed:false});
  const r=await call(gateway,'/api/v1/exam/start',{formId:FORM});
  assert.deepEqual(r.body,{ok:false,error:'FEATURE_NOT_AUTHORIZED'});
  const gw=createGateway({verifyUser:async()=>A,dbExecutor:async()=>{throw Error('PRIVATE DB PASSWORD BAD');}});
  const x=await call(gw,'/api/v1/exam/start',{formId:FORM});
  assert.equal(x.status,503);assert.ok(!JSON.stringify(x).includes('PASSWORD'));
});
function fakePool({allow=true,dbError=null}={}){
  const statements=[];let released=false;
  const client={
    query: async (sql,args=[])=>{
      statements.push([sql,args]);
      if(dbError && sql.startsWith('SELECT canone_ops.exam_start'))throw dbError;
      if(sql.includes('canone_ops.can_use_feature')) return {rows:[{allowed:allow}]};
      if(sql==='SELECT canone_ops.exam_start($1::uuid) AS id')return {rows:[{id:FORM}]};
      return {rows:[]};
    },release:()=>{released=true;}
  };
  return {pool:{connect:async()=>client},statements,wasReleased:()=>released};
}
test('PG executor issues role, transaction-scoped verified claim, entitlement and method allowlist',async()=>{
  const f=fakePool(),exec=makePgExecutor({pool:f.pool});
  assert.deepEqual(await exec({userId:A,featureKey:FEATURE_KEY,method:'exam_start',args:[FORM]}),{id:FORM});
  assert.deepEqual(f.statements.map(x=>x[0]),[
    'BEGIN',"SET LOCAL statement_timeout = '4500ms'","SET LOCAL lock_timeout = '2000ms'",
    'SET LOCAL ROLE service_role',"SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,true)",
    'SELECT canone_ops.can_use_feature($1::uuid,$2::text) AS allowed',SQL.exam_start,'COMMIT'
  ]);
  assert.deepEqual(f.statements[4][1],[A]);assert.deepEqual(f.statements[5][1],[A,FEATURE_KEY]);
  assert.equal(f.wasReleased(),true);
});
test('PG executor rolls back after denial and never invokes internal exam methods',async()=>{
  const f=fakePool({allow:false}),exec=makePgExecutor({pool:f.pool});
  await assert.rejects(exec({userId:A,featureKey:FEATURE_KEY,method:'exam_start',args:[FORM]}),e=>e.status===403);
  assert.ok(f.statements.some(x=>x[0]==='ROLLBACK'));
  assert.ok(!f.statements.some(x=>x[0]===SQL.exam_start));
  assert.equal(f.wasReleased(),true);
});
test('PG executor rejects SQL method injection before acquiring a connection',async()=>{
  let acquired=0;const exec=makePgExecutor({pool:{connect:async()=>{acquired++;throw Error('should not connect');}}});
  await assert.rejects(exec({userId:A,featureKey:FEATURE_KEY,method:'exam_start; DROP TABLE auth.users',args:[]}),GatewayError);
  assert.equal(acquired,0);
});
test('PG errors are redacted and rolled back',async()=>{
  const f=fakePool({dbError:{code:'23514',detail:'sensitive'}});
  const exec=makePgExecutor({pool:f.pool});
  await assert.rejects(exec({userId:A,featureKey:FEATURE_KEY,method:'exam_start',args:[FORM]}),e=>e.status===409&&e.message==='ACTION_NOT_ALLOWED');
  assert.equal(f.wasReleased(),true);
  assert.ok(f.statements.some(x=>x[0]==='ROLLBACK'));
});
test('Configuration refuses shared source, wrong DB, or missing verified TLS',()=>{
  const base={CANONE_EXPECTED_PROJECT_REF:'abcdefghijklmnopqrst',
    CANONE_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
    CANONE_PG_DSN:'postgresql://tester:synthetic@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=verify-full',
    CANONE_SUPABASE_PUBLISHABLE_KEY:'pk_test_synthetic'};
  assert.equal(validateEnvironment(base),'abcdefghijklmnopqrst');
  assert.throws(()=>validateEnvironment({...base,CANONE_EXPECTED_PROJECT_REF:'pgsybzggewhinaniybiy'}));
  assert.throws(()=>validateEnvironment({...base,CANONE_PG_DSN:base.CANONE_PG_DSN.replace('db.abcdefghijklmnopqrst','db.pgsybzggewhinaniybiy')}));
  assert.throws(()=>validateEnvironment({...base,CANONE_PG_DSN:base.CANONE_PG_DSN.replace('verify-full','disable')}));
});
test('HTTP server runs on loopback and rejects non-POST',async()=>{
  const {gateway}=fixture();const srv=await makeServer({gateway,port:0});
  try{
    const addr=srv.address();
    assert.equal(addr.address,'127.0.0.1');
    const resp=await fetch(`http://127.0.0.1:${addr.port}/api/v1/exam/start`);
    assert.equal(resp.status,405);
    assert.equal(resp.headers.get('cache-control'),'no-store');
  }finally{await new Promise(resolve=>srv.close(resolve));}
});
