/** Real localhost HTTP path with synthetic Auth and database doubles.
 * Tests the *gateway contract* only; never claims real Supabase Auth or RLS E2E.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createGateway, makeSupabaseAuthVerifier } from '../gateway/alpha9-core.mjs';
import { makeServer } from '../gateway/alpha9-server.mjs';
import { syntheticAuthFetch, syntheticToken, tamperedToken, syntheticDbExecutor,
         STUDENT_A, STUDENT_B, FIXTURE_FORM } from './fixtures/ns02-local-auth.mjs';

let server, base, db;
let aToken, bToken;
const endpoint=(path)=>base+path;
const post=async(path,token,body)=>{
  const response=await fetch(endpoint(path),{
    method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
    body:JSON.stringify(body)
  });
  return {status:response.status,body:await response.json()};
};

before(async()=>{
  assert.equal(process.env.CANONE_SYNTHETIC_TEST_ONLY,'1','Never run fixture without explicit local-test flag');
  db=syntheticDbExecutor();
  const verifyUser=makeSupabaseAuthVerifier({url:'https://ns02-test-project.supabase.co/',
    publishableKey:'fake_publishable_key_only_for_ns02', fetchImpl:syntheticAuthFetch});
  const gateway=createGateway({verifyUser,dbExecutor:db.execute.bind(db)});
  server=await makeServer({gateway,host:'127.0.0.1',port:0});
  base='http://127.0.0.1:'+server.address().port;
  aToken=syntheticToken(STUDENT_A);
  bToken=syntheticToken(STUDENT_B);
});
after(async()=>{ if(server)await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())); });

test('01 rejects missing token over real HTTP',async()=>{
  const x=await post('/api/v1/exam/start',null,{formId:FIXTURE_FORM});
  assert.deepEqual([x.status,x.body.error],[401,'AUTH_REQUIRED']);
});
test('02 rejects signed-looking but forged token over real HTTP',async()=>{
  const x=await post('/api/v1/exam/start',tamperedToken(STUDENT_A),{formId:FIXTURE_FORM});
  assert.deepEqual([x.status,x.body.error],[401,'INVALID_TOKEN']);
});
test('03 rejects expired validly signed synthetic token',async()=>{
  const x=await post('/api/v1/exam/start',syntheticToken(STUDENT_A,{ttl:-10}),{formId:FIXTURE_FORM});
  assert.deepEqual([x.status,x.body.error],[401,'INVALID_TOKEN']);
});
test('04 ignores user_metadata claims as proof of subscription',async()=>{
  db.subscribed.delete(STUDENT_A);
  const token=syntheticToken(STUDENT_A,{user_metadata:{is_admin:true,plan:'active'}});
  const x=await post('/api/v1/exam/start',token,{formId:FIXTURE_FORM});
  assert.deepEqual([x.status,x.body.error],[403,'FEATURE_NOT_AUTHORIZED']);
  db.subscribed.add(STUDENT_A);
});
test('05 rejects body-supplied userId impersonation',async()=>{
  const x=await post('/api/v1/exam/start',aToken,{formId:FIXTURE_FORM,userId:STUDENT_B});
  assert.deepEqual([x.status,x.body.error],[400,'INVALID_FIELDS']);
});
test('06 invalid JSON and methods do not bypass authentication',async()=>{
  const x=await fetch(endpoint('/api/v1/exam/start'),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+aToken},body:'{'});
  assert.equal(x.status,400);
  const y=await fetch(endpoint('/api/v1/exam/start'),{method:'GET',headers:{authorization:'Bearer '+aToken}});
  assert.equal(y.status,405);
});
test('07 valid local identity starts an attempt without revealing a key',async()=>{
  const x=await post('/api/v1/exam/start',aToken,{formId:FIXTURE_FORM});
  assert.equal(x.status,200); assert.equal(typeof x.body.data.id,'string');
  const leaked=await post('/api/v1/exam/reveal',aToken,{attemptId:x.body.data.id});
  assert.equal(leaked.status,409);
});
test('08 B subscription does not allow access to A attempt (IDOR)',async()=>{
  const x=await post('/api/v1/exam/start',aToken,{formId:FIXTURE_FORM});
  const id=x.body.data.id;
  const stolen=await post('/api/v1/exam/answer',bToken,{attemptId:id,ordinal:1,option:'C'});
  assert.deepEqual([stolen.status,stolen.body.error],[403,'FORBIDDEN']);
});
test('09 full HTTP journey: answer, finish, reveal and SRS, with no pre-finish key leak',async()=>{
  const start=await post('/api/v1/exam/start',aToken,{formId:FIXTURE_FORM});
  const id=start.body.data.id;
  const answer=await post('/api/v1/exam/answer',aToken,{attemptId:id,ordinal:1,option:'C'});
  assert.deepEqual(answer.body.data,{accepted:true});
  assert.equal(JSON.stringify(answer).includes('correct_option'),false);
  const finish=await post('/api/v1/exam/finish',aToken,{attemptId:id});
  assert.equal(finish.status,200);
  const reveal=await post('/api/v1/exam/reveal',aToken,{attemptId:id});
  assert.deepEqual(reveal.body.data.rows,[{ordinal:1,correct_option:'C'}]);
  const [a,b]=await Promise.all([
    post('/api/v1/exam/review',aToken,{attemptId:id,ordinal:1}),
    post('/api/v1/exam/review',aToken,{attemptId:id,ordinal:1})]);
  assert.deepEqual(a.body.data,b.body.data);
  assert.equal(db.reviewEventCount(),1);
  const late=await post('/api/v1/exam/answer',aToken,{attemptId:id,ordinal:1,option:'A'});
  assert.equal(late.status,409);
});
test('10 revoked subscription prevents further actions on existing attempt',async()=>{
  const start=await post('/api/v1/exam/start',aToken,{formId:FIXTURE_FORM});
  db.subscribed.delete(STUDENT_A);
  const x=await post('/api/v1/exam/finish',aToken,{attemptId:start.body.data.id});
  assert.deepEqual([x.status,x.body.error],[403,'FEATURE_NOT_AUTHORIZED']);
  db.subscribed.add(STUDENT_A);
});
test('11 method whitelist rejects arbitrary SQL endpoint',async()=>{
  const x=await post('/api/v1/admin/execute',aToken,{});
  assert.deepEqual([x.status,x.body.error],[404,'NOT_FOUND']);
});
test('12 correct subject is used for all actual synthetic DB executions',()=>{
  assert(db.actions.length>0);
  assert(db.actions.every(x=>x.featureKey==='cfc.exam' && [STUDENT_A,STUDENT_B].includes(x.userId)));
});
