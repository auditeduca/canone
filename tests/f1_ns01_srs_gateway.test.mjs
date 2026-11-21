import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,makePgExecutor,SQL,FEATURE_KEY} from '../gateway/alpha12-core.mjs';
const UID='33333333-3333-4333-8333-333333333333';
const SUBJECT='66666666-0000-4000-8000-000000000001';
const send=(gateway,body,extra={})=>gateway({method:'POST',path:'/api/v1/srs/due',
  headers:{'content-type':'application/json',authorization:'Bearer a.b.c'},
  rawBody:JSON.stringify(body),...extra});
test('strict owner-only SRS route: body, method and identity',async()=>{
 const calls=[];
 const gw=createGateway({verifyUser:async()=>UID,dbExecutor:async x=>{calls.push(x);return {rows:[]}}});
 assert.equal((await send(gw,{subjectId:null,limit:50})).status,200);
 assert.deepEqual(calls[0],{userId:UID,featureKey:FEATURE_KEY,method:'srs_due_private_ci',args:[null,50]});
 assert.equal((await send(gw,{subjectId:SUBJECT,limit:1})).status,200);
 assert.deepEqual(calls[1].args,[SUBJECT,1]);
 for(const body of [
  {subjectId:null,limit:0},{subjectId:null,limit:101},{subjectId:null,limit:null},
  {subjectId:null,limit:1.1},{subjectId:null,limit:'5'},
  {subjectId:'bad',limit:1},{limit:1},{subjectId:null},
  {subjectId:null,limit:50,userId:UID},{subjectId:null,limit:50,includeKey:true}
 ]) assert.equal((await send(gw,body)).status,400);
 assert.equal(calls.length,2);
 assert.equal((await send(gw,{subjectId:null,limit:50},
   {headers:{'content-type':'application/json'}})).status,401);
 assert.equal((await send(gw,{subjectId:null,limit:50},{method:'GET'})).status,405);
});
test('PG executor uses private SRS SQL and never projects correct answers',async()=>{
 assert.equal(SQL.srs_due_private_ci,'SELECT * FROM canone_ops.srs_due_private_ci($1::uuid,$2::integer)');
 assert.doesNotMatch(SQL.srs_due_private_ci,/answer_key|correct_option|is_correct|SELECT \*/i);
 const statements=[];
 const mock={connect:async()=>({query:async(s,args=[])=>{
  statements.push({s,args});
  if(s.includes('can_use_feature'))return {rows:[{allowed:true}]};
  if(s===SQL.srs_due_private_ci)return {rows:[{item_id:SUBJECT,subject_id:SUBJECT,state:'revisao'}]};
  return {rows:[]};
 },release(){}})};
 const out=await makePgExecutor({pool:mock})({userId:UID,featureKey:FEATURE_KEY,
   method:'srs_due_private_ci',args:[SUBJECT,10]});
 assert.equal(out.rows.length,1);
 assert.ok(statements.some(x=>x.s==='SET LOCAL ROLE service_role'));
 assert.ok(statements.some(x=>x.s==='COMMIT'));
});
