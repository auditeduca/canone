import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createPersonalQuestion,removePersonalQuestion,getPracticeTopics,
 startPractice,choosePractice,previousPractice,nextPractice,practiceSummary,
 exportPersonalBank,
} from '../src/tools/personal-practice.ts';
const options={A:'Primeira',B:'Segunda',C:'Terceira',D:'Quarta'};
const mk=(id=1,topic='Meu tema',stem='Qual é a opção de exemplo?',extra=[])=>
  createPersonalQuestion(id,topic,stem,options,'Fonte informada por usuário',extra);
const q1=mk();const q2=mk(2,'Outro tema','Pergunta de treinamento pessoal?');
test('S17 creates noncanonical user question with explicit provenance',()=>{
 assert.deepEqual(q1.options,options);assert.equal(q1.provenance,'user-authored-unverified');
 assert.equal(Object.hasOwn(q1,'correct'),false);assert.equal(Object.hasOwn(q1,'answerKey'),false);
});
test('S17 normalizes question content',()=>assert.equal(mk(4,'  Tema  X  ','  Pergunta   elaborada   de   teste? ').stem,'Pergunta elaborada de teste?'));
test('S17 rejects invalid or repeated IDs',()=>{assert.throws(()=>mk(0),/ID/);assert.throws(()=>mk(1,'Tema','Pergunta longa suficiente?',[q1]),/ID/)});
test('S17 rejects unsupported alternatives',()=>assert.throws(()=>createPersonalQuestion(9,'Tema','Enunciado de teste.',{...options,E:'Extra'},''),/exatamente/));
test('S17 rejects missing alternatives',()=>assert.throws(()=>createPersonalQuestion(9,'Tema','Enunciado de teste.',{A:'a',B:'b',C:'c'},''),/quatro/));
test('S17 rejects duplicate alternative text',()=>assert.throws(()=>createPersonalQuestion(9,'Tema','Enunciado de teste.',{...options,D:'primeira'},''),/diferentes/));
test('S17 rejects blank, short, and long descriptions',()=>{assert.throws(()=>mk(3,' ','Pergunta válida com 10 letras?'),/Tema/);assert.throws(()=>mk(3,'Tema','Oi?'),/Enunciado/);assert.throws(()=>mk(3,'Tema','A'.repeat(601)),/Enunciado/)});
test('S17 rejects overlong references',()=>assert.throws(()=>createPersonalQuestion(1,'Tema','Pergunta de teste?',options,'a'.repeat(401)),/Referência/));
test('S17 refuses >60 personal questions',()=>assert.throws(()=>mk(61,'Tema','Pergunta de teste?',Array.from({length:60},(_,i)=>({...q1,id:i+1}))),/60/));
test('S17 filters topics deterministically',()=>assert.deepEqual(getPracticeTopics([q1,q2, mk(3)]),['Meu tema','Outro tema']));
test('S17 removes one question and leaves others',()=>assert.deepEqual(removePersonalQuestion([q1,q2],1).map(x=>x.id),[2]));
test('S17 rejects nonexistent bank at session start',()=>assert.throws(()=>startPractice('simulados',[]),/Crie questões/));
test('S17 rejects invalid mode and count',()=>{assert.throws(()=>startPractice('duelo',[q1]),/Modo/);assert.throws(()=>startPractice('reposicao',[q1],'',21),/20/);assert.throws(()=>startPractice('reposicao',[q1],'',0),/20/)});
test('S17 supports topic-specific snapshot of items',()=>{const s=startPractice('reposicao',[q1,q2],'Outro tema');assert.deepEqual(s.items.map(x=>x.id),[2]);assert.equal(s.stage,'choosing')});
test('S17 session snapshot is detached from source question',()=>{const bank=[mk(1)];const s=startPractice('simulados',bank);bank[0].options.A='Mutação posterior';assert.equal(s.items[0].options.A,'Primeira')});
test('S17 rejects unsigned/orphaned provenance',()=>assert.throws(()=>startPractice('simulados',[{...q1,provenance:'verified'}]),/proveniência/));
test('S17 rejects duplicate IDs in corrupt bank',()=>assert.throws(()=>startPractice('simulados',[q1,{...q1}]),/duplicados/));
test('S17 rejects empty answer then permits choice and next',()=>{let s=startPractice('simulados',[q1,q2]);assert.throws(()=>nextPractice(s),/Selecione/);s=choosePractice(s,'A');assert.equal(practiceSummary(s).answered,1);s=nextPractice(s);assert.equal(s.position,1)});
test('S17 rejects invalid option',()=>assert.throws(()=>choosePractice(startPractice('simulados',[q1]),'Z'),/Alternativa/));
test('S17 completes session only with selection',()=>{let s=startPractice('simulados',[q1]);s=choosePractice(s,'D');s=nextPractice(s);assert.equal(s.stage,'review');assert.equal(practiceSummary(s).unselected,0);assert.deepEqual(s.selections,{'1':'D'})});
test('S17 can revisit choices after review',()=>{let s=startPractice('reposicao',[q1]);s=nextPractice(choosePractice(s,'A'));s=previousPractice(s);assert.equal(s.stage,'choosing');s=choosePractice(s,'C');assert.equal(s.selections['1'],'C')});
test('S17 summary does not contain scores or success rates',()=>{const s=startPractice('reposicao',[q1]);assert.deepEqual(practiceSummary(s),{answered:0,total:1,unselected:1})});
test('S17 export has no canonical grade answer',()=>{const parsed=JSON.parse(exportPersonalBank([q1]));assert.equal(parsed.schema,'canone.user-authored.questions.s17');assert.equal(parsed.items.length,1);assert.equal(Object.hasOwn(parsed.items[0],'correct'),false)});
test('S17 engine does not call network, browser storage, or automatic grade',()=>{const code=readFileSync(new URL('../src/tools/personal-practice.ts',import.meta.url),'utf8');assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|gradeAnswer\(|supabase\.from\(|setInterval\(/);});
test('S17 UI displays unverified and nonofficial safety notice',()=>{const code=readFileSync(new URL('../src/screens/PersonalPractice.tsx',import.meta.url),'utf8');assert.match(code,/sem validação normativa/);assert.match(code,/Nenhum gabarito, nota ou resultado oficial/);assert.doesNotMatch(code,/dangerouslySetInnerHTML|fetch\(|localStorage|sessionStorage/)});
test('S17 reuses canonical question presentation and existing UI',()=>{const ui=readFileSync(new URL('../src/screens/PersonalPractice.tsx',import.meta.url),'utf8');assert.match(ui,/ExamQuestion/);assert.match(ui,/ExamProgress/)});
test('S17 both routes share bank and preserve mode-specific session states',()=>{const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(main,/const \[personalQuestions, setPersonalQuestions\]/);assert.match(main,/practiceSessions/);assert.match(main,/localId === 'reposicao' \|\| localId === 'simulados'/)});
