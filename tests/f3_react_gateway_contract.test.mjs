import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePublicForm,parseReveal,postGateway,localTestRuntime} from '../source-s22/app/src/secure-p0/gateway-client.ts';
const id='00000000-0000-4000-8000-000000000004';
const fixture={id,questions:[{ordinal:1,stem:'Exemplo fictício para contrato de UI?',options:[{code:'A',text:'Uma opção'},{code:'B',text:'Outra opção'}]}]};
test('accept public form with no answer and preserve ordinal',()=>{
  assert.equal(parsePublicForm(fixture).questions[0].ordinal,1);
  assert.equal(Object.hasOwn(parsePublicForm(fixture).questions[0],'correct_option'),false);
});
test('fail closed if question or alternative includes early answer key',()=>{
  assert.throws(()=>parsePublicForm({...fixture,questions:[{...fixture.questions[0],correct_option:'A'}]}),/INVALID_QUESTION_CONTRACT/);
  assert.throws(()=>parsePublicForm({...fixture,questions:[{...fixture.questions[0],options:[{code:'A',text:'Ok',isCorrect:true},{code:'B',text:'Ok'}]}]}),/INVALID_OPTIONS/);
});
test('fail closed if external host tries to bootstrap local runtime',()=>{
  assert.equal(localTestRuntime({location:{hostname:'canone.example'},__CANONE_P0_TEST_ONLY__:{getToken:()=>{},getForm:()=>{}}}),null);
});
test('JWT invalid before fetch and no userId field ever sent',async()=>{
  let fetched=false;
  await assert.rejects(postGateway('start',{formId:id},{getToken:async()=>'',getForm:async()=>fixture},async()=>{fetched=true;}),/AUTH_REQUIRED/);
  assert.equal(fetched,false);
});
test('same-origin HTTP contract uses only bearer and server result',async()=>{
  const calls=[];
  const runtime={getToken:async()=> 'a.b.c',getForm:async()=>fixture};
  const result=await postGateway('start',{formId:id},runtime,async(p,opts)=>{
    calls.push({p,opts});return {ok:true,json:async()=>({ok:true,data:{id}})};
  });
  assert.deepEqual(result,{id});
  assert.equal(calls[0].p,'/api/v1/exam/start');
  assert.equal(calls[0].opts.credentials,'same-origin');
  assert.equal(calls[0].opts.cache,'no-store');
  assert.deepEqual(JSON.parse(calls[0].opts.body),{formId:id});
});
test('403 entitlement is not interpreted as success',async()=>{
  await assert.rejects(postGateway('start',{formId:id},
    {getToken:async()=> 'a.b.c',getForm:async()=>fixture},
    async()=>({ok:false,json:async()=>({ok:false,error:'FEATURE_NOT_AUTHORIZED'})})),/FEATURE_NOT_AUTHORIZED/);
});
test('reveal validates answer key only after server reveal path',()=>{
  const form=parsePublicForm(fixture);
  assert.deepEqual(parseReveal({rows:[{ordinal:1,correct_option:'A'}]},form),[{ordinal:1,correct_option:'A'}]);
  assert.throws(()=>parseReveal({rows:[{ordinal:1,correct_option:'X'}]},form),/INVALID_REVEAL_CONTRACT/);
});
test('integration does not import the NS04 demo that bundles answer keys',()=>{
  const entry=readFileSync(new URL('../source-s22/app/src/secure-p0/main.tsx',import.meta.url),'utf8');
  const client=readFileSync(new URL('../source-s22/app/src/secure-p0/gateway-client.ts',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../source-s22/app/src/secure-p0/JornadaServidor.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(entry+client+ui,/frontend\/student\/model|CORRECT\s*=|QUESTOES\s+from|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE/);
  assert.match(ui,/ExamQuestion/);
});
