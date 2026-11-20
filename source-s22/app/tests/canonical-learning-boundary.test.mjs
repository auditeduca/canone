import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const rd=rel=>readFileSync(resolve(root,rel),'utf8');
const ui=rd('app/src/ui/learning/ExamQuestion.tsx');
const demo=rd('app/src/content/questoes.ts');
const old=rd('extras/editorial-review/questoes-s6-pendente.ts');
const phone=rd('app/src/screens/phoneScreens.tsx');
const service=rd('backend/src/areas/subscriber/provas.ts');
const api=rd('backend/src/http/api.ts');

test('question presentation accepts only public stem/options and never answer key',()=>{
 assert.match(ui,/export function ExamQuestion/);
 assert.match(ui,/onChoose:/);
 assert.doesNotMatch(ui, /\bcorrectOption\s*:/);
 assert.doesNotMatch(ui, /\bisCorrect\s*:/);
 assert.doesNotMatch(ui, /\bcorreta\s*:/);
 assert.doesNotMatch(ui,/from\s+['"]\.\.\/\.\.\/content\/questoes/);
});

test('screen reuses the one design-system question component',()=>{
 assert.match(phone,/import \{ ExamQuestion, ExamGateNotice \}/);
 assert.match(phone,/<ExamQuestion ordinal=\{1\}/);
 assert.match(phone,/QUESTÃO|QUIZ — SIMULAÇÃO DE UI/i);
 assert.match(phone,/Progresso ilustrativo/);
 assert.match(phone,/Demonstração: a revisão espaçada depende de login/);
});

test('legacy normative question samples are quarantined outside frontend',()=>{
 assert.match(old,/CFC-STRUCT-001/);
 assert.match(old,/CG-003/);
 assert.doesNotMatch(demo, /CFC-STRUCT|CG-003|NBC TA 200|CPC 00|Edital FGV/);
 assert.match(demo, /DEMO-SINTETICA-001/);
 assert.match(demo, /DEMO-SINTETICA-002/);
 assert.match(demo, /a_confirmar/);
 assert.doesNotMatch(demo, /,\s*verificacao:\s*'verificado'/);
});

test('real grading remains one server-side responsibility',()=>{
 assert.match(service,/learning\.answer_exam_attempt/);
 assert.match(service,/learning\.reveal_exam_key/);
 assert.match(api,/return \{ registrada: true \}/);
 const answerRoute=api.slice(api.indexOf("/api\\/subscriber\\/tentativas\\/([a-z0-9-]+)\\/respostas"));
 assert.ok(answerRoute.length>100);
 assert.ok(!ui.includes('reveal_exam_key'));
});

test('S7 preview remains unavailable for production persistence',()=>{
 const app=rd('app/src/App.tsx');
 assert.match(app,/Sem login operacional, publicação de questões ou pagamentos/);
 const manifest=JSON.parse(rd('backend/contracts/product/catalog.v1.json'));
 assert.equal(manifest.product_gate,'HOLD_HUMAN_NO_GO');
});
