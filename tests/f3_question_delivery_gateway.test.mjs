import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,makePgExecutor,SQL,FEATURE_KEY} from '../gateway/alpha11-core.mjs';
const UID='33333333-3333-4333-8333-333333333333';
const FORM='00000000-0000-4000-8000-000000000004';
const request=(gw,body,overrides={})=>gw({method:'POST',path:'/api/v1/exam/questions',
  headers:{authorization:'Bearer a.b.c','content-type':'application/json'},
  rawBody:JSON.stringify(body),...overrides});
test('questions endpoint only accepts verified actor and a single formId',async()=>{
 const calls=[];const gw=createGateway({verifyUser:async()=>UID,dbExecutor:async info=>{
  calls.push(info);return {id:FORM,questions:[]};
 }});
 assert.equal((await request(gw,{formId:FORM})).status,200);
 assert.deepEqual(calls[0],{userId:UID,featureKey:FEATURE_KEY,method:'exam_questions',args:[FORM]});
 for(const body of [{formId:FORM,userId:UID},{formId:FORM,license:'ok'}, {},{formId:'invalid'}])
  assert.equal((await request(gw,body)).status,400);
 assert.equal(calls.length,1);
 assert.equal((await request(gw,{formId:FORM},{headers:{'content-type':'application/json'}})).status,401);
});
test('read projection uses private function; gateway never reads answer_key directly',()=>{
 assert.equal(SQL.exam_questions,'SELECT canone_ops.exam_questions($1::uuid) AS form');
 assert.doesNotMatch(SQL.exam_questions,/(SELECT.+answer_key|is_correct|correct_option)/i);
});
test('postgres query returns only form envelope and honors entitlement',async()=>{
 const statements=[];const mock={connect:async()=>({query:async (s,args=[])=>{
  statements.push(s);
  if(s.includes('can_use_feature'))return {rows:[{allowed:true}]};
  if(s===SQL.exam_questions)return {rows:[{form:{id:FORM,questions:[]}}]};
  return {rows:[]};
 },release() {}})};
 const result=await makePgExecutor({pool:mock})({userId:UID,featureKey:FEATURE_KEY,
   method:'exam_questions',args:[FORM]});
 assert.deepEqual(result,{id:FORM,questions:[]});
 assert.ok(statements.includes('SET LOCAL ROLE service_role'));
 assert.ok(statements.includes('COMMIT'));
});
