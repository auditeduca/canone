/**
 * NS-03: REAL Node HTTP -> makePgExecutor -> PostgreSQL 17 (ephemeral).
 * Auth is intentionally SYNTHETIC and in-process. This is NOT Supabase Auth E2E.
 * Hard refusal unless executed in the GitHub Actions PostgreSQL service job.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { createGateway, makePgExecutor, makeSupabaseAuthVerifier } from '../gateway/alpha9-core.mjs';
import { makeServer } from '../gateway/alpha9-server.mjs';
import { syntheticAuthFetch, syntheticToken, tamperedToken } from './fixtures/ns02-local-auth.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const FORM = '00000000-0000-4000-8000-000000000004';
const GUARD = /^(?:[a-f0-9]{12}|[a-f0-9]{64})$/;
const forbidden = ['DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY', 'CANONE_PG_DSN', 'CANONE_SUPABASE_URL'];
const port = Number(process.env.CANONE_CI_PG17_PORT);
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.CANONE_CI_PG17_ONLY !== 'yes' ||
    process.env.CANONE_SYNTHETIC_TEST_ONLY !== '1' ||
    !GUARD.test(process.env.CANONE_CI_PG17_CONTAINER ?? '') ||
    !Number.isInteger(port) || port < 1024 || port > 65535 ||
    forbidden.some(key => process.env[key])) {
  throw Error('REFUSE_NS03_OUTSIDE_EPHEMERAL_GITHUB_CI');
}

// Reuse the exact pinned lockfile dependency from S22; do not download any unpinned pg package.
const requireFromBackend = createRequire(new URL('../source-s22/backend/package.json', import.meta.url));
const { Pool } = requireFromBackend('pg');
const settings = {host:'127.0.0.1', port, database:'canone_alpha7_ci',
  ssl:false, connectionTimeoutMillis:3000, idleTimeoutMillis:1000};
const admin = new Pool({...settings, user:'postgres', password:'synthetic_ci_only_not_real', max:2});
const gatewayPool = new Pool({...settings, user:'canone_gateway_ci', password:'canone_ci_ephemeral_only', max:1});
let server, base;
const tokenA = syntheticToken(A);
const tokenB = syntheticToken(B);
const post = async (path, jwt, data) => {
  const res = await fetch(base + path, {
    method:'POST', headers:{'content-type':'application/json',...(jwt?{authorization:'Bearer '+jwt}:{})},
    body:JSON.stringify(data)
  });
  const body=await res.json();
  assert.equal(body.ok, res.status===200, 'HTTP/body contract must be consistent');
  return {status:res.status,body};
};
const must = (res, status, code) => {
  assert.equal(res.status,status,JSON.stringify(res.body));
  if(code)assert.equal(res.body.error,code);
};
const subscriptionStatus = async (status) => {
  await admin.query("UPDATE canone_commerce.subscription SET status=$1, trial_ends_at=NULL, current_period_start=now()-interval '1 day', current_period_end=now()+interval '15 days' WHERE user_id=$2",[status,A]);
};
const adminGrant = async (revoke) => {
  await admin.query("UPDATE canone_commerce.entitlement SET revoked_at=CASE WHEN $1::boolean THEN now() ELSE NULL END WHERE user_id=$2 AND feature_key='cfc.exam' AND source='admin'",[revoke,B]);
};

before(async () => {
  // The shell test must have provisioned the non-superuser login and seed account.
  const role = await admin.query("SELECT rolcanlogin, rolsuper FROM pg_roles WHERE rolname='canone_gateway_ci'");
  assert.deepEqual(role.rows,[{rolcanlogin:true,rolsuper:false}], 'PG gateway must never connect as superuser');
  const users = await admin.query('SELECT count(*)::integer AS n FROM auth.users WHERE id=ANY($1::uuid[])',[[A,B]]);
  assert.equal(users.rows[0].n,2,'Both synthetic users must have FK backing');
  const verifyUser=makeSupabaseAuthVerifier({url:'https://ns02-test-project.supabase.co/',
    publishableKey:'fake_publishable_key_only_for_ns02',fetchImpl:syntheticAuthFetch});
  server=await makeServer({gateway:createGateway({verifyUser,dbExecutor:makePgExecutor({pool:gatewayPool})}),
    host:'127.0.0.1',port:0});
  base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
  if(server)await new Promise((res,rej)=>server.close(err=>err?rej(err):res()));
  await gatewayPool.end();
  await admin.end();
});

await test('NS03 real HTTP -> real PG17 with independent tenant permissions', async(t)=> {
  let attemptA, attemptB;
  await t.test('01 refuses missing JWT before consulting DB',async()=>{
    must(await post('/api/v1/exam/start',null,{formId:FORM}),401,'AUTH_REQUIRED');
  });
  await t.test('02 refuses forged signature at test Auth boundary',async()=>{
    must(await post('/api/v1/exam/start',tamperedToken(A),{formId:FORM}),401,'INVALID_TOKEN');
  });
  await t.test('03 denies user A with cancelled subscription from real PG17 gate',async()=>{
    await subscriptionStatus('cancelada');
    must(await post('/api/v1/exam/start',tokenA,{formId:FORM}),403,'FEATURE_NOT_AUTHORIZED');
  });
  await t.test('04 allows active paid subscription and inserts real attempt in PG17',async()=>{
    await subscriptionStatus('ativa');
    const res=await post('/api/v1/exam/start',tokenA,{formId:FORM});
    must(res,200); attemptA=res.body.data.id;
    assert.match(attemptA,/^[0-9a-f-]{36}$/i);
    const db=await admin.query('SELECT user_id::text FROM canone_learning.exam_attempt WHERE id=$1',[attemptA]);
    assert.equal(db.rows[0]?.user_id,A);
    assert(!JSON.stringify(res.body).includes('correct_option'));
  });
  await t.test('05 rejects reveal before finish without exposing key',async()=>{
    const res=await post('/api/v1/exam/reveal',tokenA,{attemptId:attemptA});
    assert.notEqual(res.status,200,JSON.stringify(res.body));
    assert(!JSON.stringify(res).includes('correct_option'));
  });
  await t.test('06 B cannot operate A attempt, even with a valid grant',async()=>{
    const startB=await post('/api/v1/exam/start',tokenB,{formId:FORM});
    must(startB,200);attemptB=startB.body.data.id;
    must(await post('/api/v1/exam/answer',tokenB,{attemptId:attemptA,ordinal:1,option:'B'}),403,'FORBIDDEN');
  });
  await t.test('07 answer retries update PG17 counts and hide verdict',async()=>{
    const wrong=await post('/api/v1/exam/answer',tokenA,{attemptId:attemptA,ordinal:1,option:'C'});
    must(wrong,200);assert.deepEqual(wrong.body.data,{accepted:true});
    const correct=await post('/api/v1/exam/answer',tokenA,{attemptId:attemptA,ordinal:1,option:'A'});
    must(correct,200);assert(!JSON.stringify(correct).includes('correct_option'));
    const second=await post('/api/v1/exam/answer',tokenA,{attemptId:attemptA,ordinal:2,option:'B'});
    must(second,200);
    const db=await admin.query('SELECT answered_count,correct_count,wrong_count FROM canone_learning.exam_attempt WHERE id=$1',[attemptA]);
    assert.deepEqual(db.rows,[{answered_count:2,correct_count:2,wrong_count:0}]);
  });
  await t.test('08 forced SQL failure rolls back without session claim leaking',async()=>{
    const bad=await post('/api/v1/exam/answer',tokenA,{attemptId:attemptA,ordinal:99,option:'B'});
    assert.notEqual(bad.status,200,JSON.stringify(bad));
    const db=await admin.query('SELECT answered_count FROM canone_learning.exam_attempt WHERE id=$1',[attemptA]);
    assert.equal(db.rows[0].answered_count,2);
    const same=await gatewayPool.query("SELECT current_user, current_setting('request.jwt.claim.sub',true) AS sub");
    assert.equal(same.rows[0].current_user,'canone_gateway_ci');
    assert([null,''].includes(same.rows[0].sub),JSON.stringify(same.rows[0]));
  });
  await t.test('09 subscription revoke denies actions on existing A attempt',async()=>{
    await subscriptionStatus('cancelada');
    must(await post('/api/v1/exam/finish',tokenA,{attemptId:attemptA}),403,'FEATURE_NOT_AUTHORIZED');
    await subscriptionStatus('ativa');
  });
  await t.test('10 finish is idempotent and reveal allowed only after finish',async()=>{
    const first=await post('/api/v1/exam/finish',tokenA,{attemptId:attemptA});
    must(first,200); assert.equal(first.body.data.answered_count,2);
    const again=await post('/api/v1/exam/finish',tokenA,{attemptId:attemptA});
    must(again,200); assert.deepEqual(first.body.data,again.body.data);
    const reveal=await post('/api/v1/exam/reveal',tokenA,{attemptId:attemptA});
    must(reveal,200);assert.equal(reveal.body.data.rows.length,2);
    assert.deepEqual(reveal.body.data.rows.map(x=>x.correct_option),['A','B']);
    must(await post('/api/v1/exam/answer',tokenA,{attemptId:attemptA,ordinal:2,option:'C'}),409,'ACTION_NOT_ALLOWED');
  });
  await t.test('11 simultaneous duplicate SRS HTTP requests persist one real receipt',async()=>{
    const [one,two]=await Promise.all([
      post('/api/v1/exam/review',tokenA,{attemptId:attemptA,ordinal:1}),
      post('/api/v1/exam/review',tokenA,{attemptId:attemptA,ordinal:1})]);
    must(one,200);must(two,200);assert.equal(one.body.data.id,two.body.data.id);
    const db=await admin.query('SELECT count(*)::integer AS n FROM canone_learning.exam_review_receipt WHERE attempt_id=$1',[attemptA]);
    assert.equal(db.rows[0].n,1);
  });
  await t.test('12 revoking B admin grant instantly denies new B requests',async()=>{
    await adminGrant(true);
    must(await post('/api/v1/exam/finish',tokenB,{attemptId:attemptB}),403,'FEATURE_NOT_AUTHORIZED');
  });
  await t.test('13 PG pool session has returned to unprivileged role after use',async()=>{
    const state=await gatewayPool.query("SELECT current_user, current_setting('request.jwt.claim.sub',true) AS sub");
    assert.equal(state.rows[0].current_user,'canone_gateway_ci');
    assert([null,''].includes(state.rows[0].sub));
    // A dedicated backend login alone cannot directly read gabaritos.
    await assert.rejects(gatewayPool.query('SELECT * FROM canone_learning.answer_key_entry LIMIT 1'),
      e=>e?.code==='42501');
  });
});
