import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advancePreview, backPreview, choosePreview, previewAnswered, publicPreviewQuestion,
  startPreview, validateQuestions,
} from '../src/ui/learning/preview-session.ts';

const questions = [
  publicPreviewQuestion('DEMO-01', 'Pergunta simulada 1', {A:'Opção A',B:'Opção B'}),
  publicPreviewQuestion('DEMO-02', 'Pergunta simulada 2', {A:'Opção A',B:'Opção B'}),
];
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const rd=path=>readFileSync(resolve(root,path),'utf8');

test('S8 uses existing public questions without answer keys',()=>{
  const q = publicPreviewQuestion('D','Enunciado fictício',{A:'Texto 1',B:'Texto 2',correta:'NÃO'})
  assert.equal('correctOption' in q,false);
  assert.equal('isCorrect' in q,false);
  assert.equal('justificativa' in q,false);
  assert.deepEqual(Object.keys(q),['id','stem','options']);
});
test('S8 rejects empty and duplicate question ids',()=>{
  assert.throws(()=>validateQuestions([]));
  assert.throws(()=>validateQuestions([questions[0],questions[0]]));
});
test('S8 rejects duplicate and missing options',()=>{
  assert.throws(()=>validateQuestions([{id:'a',stem:'S',options:[{code:'A',text:'ok'},{code:'A',text:'x'}]}]));
  assert.throws(()=>validateQuestions([{id:'a',stem:'S',options:[{code:'A',text:'ok'}]}]));
});
test('S8 refuses to advance without selection',()=>{
  const s=startPreview(questions);
  assert.equal(advancePreview(s,questions),s);
  assert.equal(previewAnswered(s,questions),0);
});
test('S8 chooses only valid option; does not change original state',()=>{
  const s=startPreview(questions);
  assert.throws(()=>choosePreview(s,questions,'Z'));
  const chosen=choosePreview(s,questions,'B');
  assert.equal(s.selections['DEMO-01'],undefined);
  assert.equal(chosen.selections['DEMO-01'],'B');
  assert.equal(previewAnswered(chosen,questions),1);
});
test('S8 completes visual review without scoring or persistence',()=>{
  let s=startPreview(questions);
  s=choosePreview(s,questions,'A');s=advancePreview(s,questions);
  assert.equal(s.position,1);
  s=choosePreview(s,questions,'B');s=advancePreview(s,questions);
  assert.equal(s.stage,'review');
  assert.equal(previewAnswered(s,questions),2);
  assert.deepEqual(Object.keys(s),['stage','position','selections']);
  assert.equal(backPreview(s).stage,'choosing');
});
test('S8 explicit no-backend UI route reuses canonical component',()=>{
  const j=rd('app/src/screens/Jornada.tsx');
  const a=rd('app/src/App.tsx');
  const p=rd('app/src/screens/pages.tsx');
  assert.match(j,/ExamQuestion/);
  assert.match(j,/ExamProgress/);
  assert.match(j,/ExamGateNotice/);
  assert.match(a,/path === '\/jornada'/);
  assert.match(p,/#\/jornada/);
  assert.doesNotMatch(j,/fetch\(|localStorage|sessionStorage|\.correta|\.justificativa|\.gabarito|grade_answer/);
});
test('S8 keeps backend as one grading authority and unchanged NO-GO',()=>{
  const backend=rd('backend/src/areas/subscriber/provas.ts');
  const api=rd('backend/src/http/api.ts');
  const catalog=JSON.parse(rd('backend/contracts/product/catalog.v1.json'));
  assert.match(backend,/learning\.answer_exam_attempt/);
  assert.match(backend,/learning\.reveal_exam_key/);
  assert.match(api,/return \{ registrada: true \}/);
  assert.equal(catalog.product_gate,'HOLD_HUMAN_NO_GO');
});
