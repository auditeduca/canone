/** Test-only HTTP -> Node gateway -> real disposable PG17 SRS contract. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CANONE_CI_PG17_ONLY!=='yes'||
   process.env.CANONE_SYNTHETIC_TEST_ONLY!=='1'||!/^\/tmp\/canone-p0-token-[A-Za-z0-9._-]+$/.test(process.env.CANONE_CI_P0_TOKEN_FILE??''))
 throw Error('REFUSE_REMOTE_OR_NON_SYNTHETIC_SRS');
const keys=JSON.parse(readFileSync(process.env.CANONE_CI_P0_TOKEN_FILE,'utf8'));
const base='http://127.0.0.1:8788/api/v1/srs/due';
async function call(token,body,{method='POST'}={}){
 const r=await fetch(base,{method,headers:{
  'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
  body:method==='POST'?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(4000)});
 return {status:r.status,body:await r.json()};
}
const allow=await call(keys.owner,{subjectId:null,limit:25});
assert.equal(allow.status,200,JSON.stringify(allow));
assert.equal(allow.body.ok,true);
assert.ok(Array.isArray(allow.body.data.rows));
assert.ok(allow.body.data.rows.every(x=>!('correct_option' in x)&&!('is_correct' in x)&&!('user_id' in x)));
assert.equal((await call(keys.peer,{subjectId:null,limit:5})).status,200);
assert.equal((await call(keys.unlicensed,{subjectId:null,limit:25})).status,403);
assert.equal((await call(null,{subjectId:null,limit:25})).status,401);
assert.equal((await call(keys.owner,{subjectId:null,limit:25,userId:'44444444-4444-4444-8444-444444444444'})).status,400);
assert.equal((await call(keys.owner,{subjectId:null,limit:0})).status,400);
assert.equal((await call(keys.owner,{subjectId:null,limit:101})).status,400);
assert.equal((await call(keys.owner,{subjectId:'invalid',limit:2})).status,400);
assert.equal((await call(keys.owner,{subjectId:null,limit:2},{method:'GET'})).status,405);
console.log('PASS_F1_NS01_SRS_REAL_HTTP no_userid_in_request=1 no_answers=1 unlicensed_denied=1');
