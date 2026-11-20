import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,makePgExecutor,SQL,FEATURE_KEY} from '../gateway/alpha10-core.mjs';
const A='33333333-3333-4333-8333-333333333333',FORM='00000000-0000-4000-8000-000000000004';
const AUTH={authorization:'Bearer a.b.c','content-type':'application/json'};
const respond=(gw,path,body,extra={})=>gw({method:'POST',headers:AUTH,path,rawBody:JSON.stringify(body),...extra});
test('three read-only routes are allowlisted, require exact body and verified subject',async()=>{
  const calls=[];const gw=createGateway({verifyUser:async()=>A,dbExecutor:async req=>{calls.push(req);return {rows:[]};}});
  for(const [path,body,method] of [['catalog',{},'exam_catalog'],['history',{},'exam_history'],['resume',{attemptId:FORM},'exam_resume']]){
    const x=await respond(gw,'/api/v1/exam/'+path,body);
    assert.equal(x.status,200);assert.equal(calls.at(-1).method,method);
    assert.deepEqual(calls.at(-1).args,path==='resume'?[FORM]:[]);
    assert.equal(calls.at(-1).userId,A);assert.equal(calls.at(-1).featureKey,FEATURE_KEY);
  }
  for(const [path,body] of [['catalog',{userId:A}],['history',{limit:500}],['resume',{attemptId:FORM,userId:A}]]){
    const x=await respond(gw,'/api/v1/exam/'+path,body);assert.equal(x.status,400);
  }
  assert.equal(calls.length,3);
  const bad=await respond(gw,'/api/v1/exam/history',{},{headers:{'content-type':'application/json'}});
  assert.equal(bad.status,401);
});
test('query methods invoke private functions, never raw tables and never answer keys',()=>{
  for(const key of ['exam_catalog','exam_history','exam_resume']){
    assert.match(SQL[key],/^SELECT \* FROM canone_ops\.exam_/);
    assert.doesNotMatch(SQL[key],/(answer_key|correct_option|password|item_option)/i);
  }
});
test('PG result and absent resume are filtered/denied, entitlement remains mandatory',async()=>{
  const statements=[];const pool={connect:async()=>({query:async (sql,args=[])=>{
    statements.push([sql,args]);
    if(sql.includes('can_use_feature'))return {rows:[{allowed:true}]};
    if(sql===SQL.exam_catalog)return {rows:[{form_id:FORM,form_label:'Synthetic',question_count:2}]};
    if(sql===SQL.exam_history)return {rows:[{attempt_id:FORM,correct_count:null,status:'em_andamento'}]};
    if(sql===SQL.exam_resume)return {rows:[]};
    return {rows:[]};
  },release:()=>{}})};
  const exec=makePgExecutor({pool});
  assert.equal((await exec({userId:A,featureKey:FEATURE_KEY,method:'exam_catalog',args:[]})).rows.length,1);
  assert.equal((await exec({userId:A,featureKey:FEATURE_KEY,method:'exam_history',args:[]})).rows[0].correct_count,null);
  await assert.rejects(exec({userId:A,featureKey:FEATURE_KEY,method:'exam_resume',args:[FORM]}),
    err=>err.status===404&&err.code==='OBJECT_NOT_FOUND');
  assert.ok(statements.every(([sql])=>!sql.includes('SELECT * FROM canone_learning.')));
});
