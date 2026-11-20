import {FORM_ID, QUESTIONS, createDemoGateway, createHttpGateway, createStudentSession} from './model.mjs';
const $ = id => document.getElementById(id);
const NAV = [...document.querySelectorAll('[data-nav]')];
const sections=[...document.querySelectorAll('[data-section]')];
const local = ['localhost','127.0.0.1','::1'].includes(location.hostname);
const demo = local && new URLSearchParams(location.search).get('demo')==='1';
const trusted = !demo && local && typeof window.__CANONE_STUDENT_RUNTIME__?.getToken==='function';
const gateway = demo?createDemoGateway():trusted?createHttpGateway({getToken:window.__CANONE_STUDENT_RUNTIME__.getToken}):null;
const session=gateway?createStudentSession(gateway):null;
let current=0, busy=false;
const TEXT={
  AUTH_REQUIRED:'Sessão não autenticada.',FEATURE_NOT_AUTHORIZED:'Benefício não autorizado.',
  ACTION_NOT_ALLOWED:'Operação não permitida.',GATEWAY_UNAVAILABLE:'Gateway indisponível.',
  INCOMPLETE_ATTEMPT:'Responda todas as questões antes de concluir.'
};
function message(text) {const toast=$('toast');toast.textContent=text;toast.hidden=false;}
function show(section) {
  sections.forEach(el=>el.hidden=el.dataset.section!==section);
  NAV.forEach(btn=>{if(btn.dataset.nav===section)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
  document.querySelector('#main h1')?.focus?.();
}
function el(tag,cls,text) {const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function progress() {
  const s=session?.snapshot();
  const answered=Object.keys(s?.answers??{}).length;
  $('metric-answered').textContent=answered+'/'+QUESTIONS.length;
  $('metric-score').textContent=s?.result? s.result.correct+'/'+s.result.total:'—';
  $('metric-reviews').textContent=String(s?.reviewed.length??0);
  $('exam-count').textContent=answered+' de '+QUESTIONS.length;
  $('exam-progress').setAttribute('aria-valuenow',String(answered));
  $('progress-fill').style.width=(answered/QUESTIONS.length*100)+'%';
}
function renderQuestion() {
  const s=session.snapshot(), area=$('question-area');area.replaceChildren();
  $('answer-button').hidden=true;$('finish-button').hidden=true;$('reveal-button').hidden=true;
  if(s.phase==='active'){
    const unanswered=QUESTIONS.findIndex(q=>!(q.ordinal in s.answers));
    if(unanswered>=0) current=unanswered;
    if(unanswered===-1) {
      $('exam-step').textContent='Respostas registradas';
      area.append(el('h2',null,'Você respondeu às duas questões.'),el('p',null,'Conclua a tentativa para habilitar a correção.'));
      $('finish-button').hidden=false;progress();return;
    }
    const q=QUESTIONS[current];$('exam-step').textContent='Questão '+(current+1);
    area.append(el('p','question-subject',q.subject),el('h2','question-title',q.title),el('p','question-prompt',q.prompt));
    const field=el('fieldset','options'), legend=el('legend',null,'Selecione uma alternativa');
    field.append(legend);
    for (const [option,text] of Object.entries(q.choices)) {
      const label=el('label','option'),radio=el('input');
      radio.type='radio';radio.name='choice';radio.value=option;
      label.append(radio,el('span',null,option+' · '+text));field.append(label);
    }
    area.append(field);$('answer-button').hidden=false;
  } else if(s.phase==='finished'){
    $('exam-step').textContent='Tentativa concluída';
    area.append(el('h2',null,'Tentativa registrada.'),el('p',null,'A correção só é solicitada após o encerramento.'));
    $('reveal-button').hidden=false;
  } else if(s.phase==='revealed'){
    $('exam-step').textContent='Correção disponível';
    area.append(el('h2',null,'Você acertou '+s.result.correct+' de '+s.result.total+' questões.'),el('p',null,'Acesse Revisão SRS para consultar e revisar cada item.'));
  }
  progress();
}
function renderReviews() {
  const area=$('review-content');area.replaceChildren();
  const s=session?.snapshot();
  if(!s?.result){area.append(el('p',null,'Conclua e corrija o simulado antes de registrar revisões.'));return;}
  for(const q of QUESTIONS) {
    const correct=s.result.rows.find(r=>r.ordinal===q.ordinal)?.correct_option;
    const picked=s.answers[q.ordinal], good=picked===correct, saved=s.reviewed.includes(q.ordinal);
    const card=el('article','review-card');
    card.append(el('h3',null,'Questão '+q.ordinal+' · '+q.title),
      el('p',good?'correct':'incorrect',good?'Resposta correta':'Revisar resposta'),
      el('p',null,'Sua escolha: '+picked+' · Gabarito demonstrativo: '+correct));
    const button=el('button','secondary',saved?'Revisão registrada':'Registrar revisão SRS');
    button.type='button';button.disabled=saved;button.addEventListener('click',()=>run(async()=>{
      await session.review(q.ordinal);progress();renderReviews();message('Revisão registrada nesta sessão.');
    }));
    card.append(button);area.append(card);
  }
}
async function run(operation) {
  if(busy)return;busy=true;
  document.querySelectorAll('button').forEach(btn=>{if(btn.id!=='back-home')btn.disabled=true;});
  try {await operation();}catch(err){message(TEXT[err.code]||'Falha de operação: '+String(err.code||'indisponível'));}
  finally {busy=false; document.querySelectorAll('button').forEach(btn=>{if(!btn.hasAttribute('data-locked'))btn.disabled=false;});
    if(session?.snapshot().phase==='revealed')renderReviews();
  }
}
async function start() {
  if(!session){message('Interface desabilitada. Execute apenas em localhost com ?demo=1.');return;}
  show('exam');
  await run(async()=>{await session.start();renderQuestion();message('Tentativa iniciada.');});
}
$('start-from-home').addEventListener('click',start);
$('back-home').addEventListener('click',()=>show('home'));
$('answer-button').addEventListener('click',()=>run(async()=>{
  const picked=document.querySelector('input[name=choice]:checked')?.value;
  if(!picked){message('Selecione uma alternativa.');return;}
  await session.answer(QUESTIONS[current].ordinal,picked);renderQuestion();message('Resposta registrada.');
}));
$('finish-button').addEventListener('click',()=>run(async()=>{await session.finish();renderQuestion();message('Tentativa concluída.');}));
$('reveal-button').addEventListener('click',()=>run(async()=>{await session.reveal();renderQuestion();renderReviews();message('Correção disponível.');}));
NAV.forEach(btn=>btn.addEventListener('click',()=>{show(btn.dataset.nav);if(btn.dataset.nav==='review')renderReviews();}));
if(!session){$('start-from-home').disabled=true;$('start-from-home').setAttribute('data-locked','');message('Protótipo local: abra localhost com ?demo=1, sem autenticação real.');}
progress();
