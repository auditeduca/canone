import test from 'node:test';
import assert from 'node:assert/strict';
import {FORM_ID,QUESTIONS,createDemoGateway,createStudentSession,createHttpGateway} from '../frontend/student/model.mjs';
const make=()=>{const api=createDemoGateway();return {api,session:createStudentSession(api)};};
test('NS04 01 initial state does not contain answer key or score',()=>{
  const s=make().session.snapshot();assert.equal(s.phase,'idle');assert.equal(s.result,null);
  assert.equal(JSON.stringify(QUESTIONS).includes('correct_option'),false);
});
test('NS04 02 demo gateway refuses premature reveal and missing attempt',async()=>{
  const api=createDemoGateway(),start=await api.send('/api/v1/exam/start',{formId:FORM_ID});
  await assert.rejects(api.send('/api/v1/exam/reveal',{attemptId:start.id}),e=>e.code==='ACTION_NOT_ALLOWED');
  await assert.rejects(api.send('/api/v1/exam/answer',{attemptId:'bad',ordinal:1,option:'A'}),e=>e.code==='OBJECT_NOT_FOUND');
});
test('NS04 03 full student journey: start, answer, finish, reveal, review',async()=>{
  const {session}=make();await session.start();
  await session.answer(1,'B');await session.answer(2,'A');
  const before=session.snapshot();assert.equal(before.result,null);assert.equal(JSON.stringify(before).includes('correct_option'),false);
  await session.finish();assert.equal(session.snapshot().result,null);
  await session.reveal();assert.deepEqual([session.snapshot().result.correct,session.snapshot().result.total],[1,2]);
  await session.review(2);await session.review(2);assert.deepEqual(session.snapshot().reviewed,[2]);
});
test('NS04 04 fail-closed for early reveal, incomplete finish, late response',async()=>{
  const {session}=make();await session.start();
  await assert.rejects(session.reveal(),e=>e.code==='REVEAL_BEFORE_FINISH');
  await assert.rejects(session.finish(),e=>e.code==='INCOMPLETE_ATTEMPT');
  await session.answer(1,'A');await session.answer(2,'C');await session.finish();
  await assert.rejects(session.answer(1,'B'),e=>e.code==='ATTEMPT_NOT_ACTIVE');
});
test('NS04 05 independent sessions do not share attempt or answer state',async()=>{
  const a=make().session,b=make().session;
  await a.start();await b.start();await a.answer(1,'A');
  assert.deepEqual(b.snapshot().answers,{});
});
test('NS04 06 same-origin HTTP adapter uses ONLY the five POST routes and bearer contract',async()=>{
  const calls=[];const api=createHttpGateway({getToken:()=> 'aa.bb.cc',
    fetchImpl:async(path,opts)=>{calls.push({path,opts});return {ok:true,json:async()=>({ok:true,data:{id:'ok'}})};}});
  await api.send('/api/v1/exam/start',{formId:FORM_ID});
  assert.equal(calls[0].path,'/api/v1/exam/start');
  assert.equal(calls[0].opts.method,'POST');assert.equal(calls[0].opts.credentials,'same-origin');
  assert.equal(calls[0].opts.headers.authorization,'Bearer aa.bb.cc');
  await assert.rejects(api.send('/api/v1/admin/sql',{}),e=>e.code==='NOT_FOUND');
  assert.equal(calls.length,1);
});
test('NS04 07 HTTP adapter rejects missing trusted token and upstream refusal',async()=>{
  assert.throws(()=>createHttpGateway(),e=>e.code==='TRUSTED_TOKEN_PROVIDER_REQUIRED');
  const api=createHttpGateway({getToken:()=>null,fetchImpl:async()=>{throw Error('network must not run');}});
  await assert.rejects(api.send('/api/v1/exam/start',{formId:FORM_ID}),e=>e.code==='AUTH_REQUIRED');
});
