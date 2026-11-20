/** NS-04: demo-only student journey. Browser code never imports private SQL or server secrets.
 * The offline answer key is NOT a security boundary; real authorization stays server-side.
 */
export const FORM_ID = '00000000-0000-4000-8000-000000000004';
export const QUESTIONS = Object.freeze([
  Object.freeze({ordinal:1,subject:'Contabilidade geral',title:'Registro de aquisição',
    prompt:'Uma organização compra material de escritório à vista. Qual conta normalmente aumenta no reconhecimento inicial?',
    choices:Object.freeze({A:'Receita de vendas',B:'Material de consumo (ativo, se ainda não utilizado)',C:'Capital social',D:'Empréstimos a pagar',E:'Despesas financeiras'})}),
  Object.freeze({ordinal:2,subject:'Raciocínio contábil',title:'Equação patrimonial',
    prompt:'Em uma situação fictícia, o ativo é 150 unidades e o passivo é 60 unidades. Qual é o patrimônio líquido?',
    choices:Object.freeze({A:'210 unidades',B:'60 unidades',C:'90 unidades',D:'150 unidades',E:'30 unidades'})})
]);
const CORRECT = Object.freeze({1:'B',2:'C'}); // Synthetic key: never use bundled keys in production.
const ROUTES = Object.freeze({
  start:'/api/v1/exam/start',answer:'/api/v1/exam/answer',finish:'/api/v1/exam/finish',
  reveal:'/api/v1/exam/reveal',review:'/api/v1/exam/review'
});
const OPTIONS = Object.freeze(['A','B','C','D','E']);
const error = code => Object.assign(new Error(code), {code});
export function createDemoGateway() {
  const attempts = new Map();
  let serial = 0;
  async function send(path, body) {
    if (!Object.values(ROUTES).includes(path)) throw error('NOT_FOUND');
    if (path === ROUTES.start) {
      if (body?.formId !== FORM_ID) throw error('INVALID_ID');
      const id = '00000000-0000-4000-8000-' + String(++serial).padStart(12,'0');
      attempts.set(id, {answers:new Map(),closed:false,reviews:new Map()});
      return {id};
    }
    const attempt = attempts.get(body?.attemptId);
    if (!attempt) throw error('OBJECT_NOT_FOUND');
    if (path === ROUTES.answer) {
      if (attempt.closed) throw error('ACTION_NOT_ALLOWED');
      if (!QUESTIONS.some(q=>q.ordinal===body.ordinal) || !OPTIONS.includes(body.option)) throw error('INVALID_FIELDS');
      attempt.answers.set(body.ordinal,body.option);
      return {accepted:true};
    }
    if (path === ROUTES.finish) {
      if (attempt.closed || attempt.answers.size !== QUESTIONS.length) throw error('ACTION_NOT_ALLOWED');
      attempt.closed = true;
      return {finished:true};
    }
    if (!attempt.closed) throw error('ACTION_NOT_ALLOWED');
    if (path === ROUTES.reveal) {
      return {rows:QUESTIONS.map(q=>({ordinal:q.ordinal,correct_option:CORRECT[q.ordinal]}))};
    }
    if (path === ROUTES.review) {
      if (!QUESTIONS.some(q=>q.ordinal===body.ordinal)) throw error('INVALID_ORDINAL');
      if (!attempt.reviews.has(body.ordinal)) attempt.reviews.set(body.ordinal, 'srs-'+body.ordinal);
      return {id:attempt.reviews.get(body.ordinal)};
    }
    throw error('NOT_FOUND');
  }
  return {send};
}
/** Same-origin HTTP adapter for a future *trusted* local gateway bootstrap.
 * No localStorage, URL token, cross-origin API, or browser-side database access.
 */
export function createHttpGateway({getToken,fetchImpl=globalThis.fetch}={}) {
  if (typeof getToken !== 'function' || typeof fetchImpl !== 'function') throw error('TRUSTED_TOKEN_PROVIDER_REQUIRED');
  return {async send(path,body) {
    if (!Object.values(ROUTES).includes(path)) throw error('NOT_FOUND');
    const jwt = await getToken();
    if (typeof jwt !== 'string' || jwt.length>8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
      throw error('AUTH_REQUIRED');
    const response = await fetchImpl(path,{method:'POST',headers:{'content-type':'application/json',
      authorization:'Bearer '+jwt},body:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});
    let payload;
    try {payload = await response.json();} catch {throw error('INVALID_GATEWAY_RESPONSE');}
    if (!response.ok || payload?.ok !== true) throw error(typeof payload?.error==='string'?payload.error:'GATEWAY_UNAVAILABLE');
    return payload.data;
  }};
}
export function createStudentSession(gateway) {
  if (!gateway || typeof gateway.send !== 'function') throw error('GATEWAY_REQUIRED');
  let phase='idle', attemptId=null, outcome=null, keyRows=null;
  const answers=new Map(), reviews=new Map();
  const snapshot=()=>({
    phase,attemptId,answers:Object.fromEntries(answers),reviewed:[...reviews.keys()],
    result:phase==='revealed'?{
      rows:keyRows.map(r=>({ordinal:r.ordinal,correct_option:r.correct_option})),
      correct:keyRows.filter(r=>answers.get(r.ordinal)===r.correct_option).length,total:QUESTIONS.length
    }:null, outcome
  });
  return {
    snapshot,
    async start() {
      if (phase!=='idle') throw error('ATTEMPT_ALREADY_STARTED');
      const x=await gateway.send(ROUTES.start,{formId:FORM_ID});
      if (!/^[0-9a-f-]{36}$/i.test(x?.id??'')) throw error('INVALID_ATTEMPT_RESPONSE');
      attemptId=x.id;phase='active';return snapshot();
    },
    async answer(ordinal,option) {
      if (phase!=='active') throw error('ATTEMPT_NOT_ACTIVE');
      if (!QUESTIONS.some(q=>q.ordinal===ordinal) || !OPTIONS.includes(option)) throw error('INVALID_FIELDS');
      await gateway.send(ROUTES.answer,{attemptId,ordinal,option});
      answers.set(ordinal,option);return snapshot();
    },
    async finish() {
      if (phase!=='active' || answers.size!==QUESTIONS.length) throw error('INCOMPLETE_ATTEMPT');
      outcome=await gateway.send(ROUTES.finish,{attemptId});phase='finished';return snapshot();
    },
    async reveal() {
      if (phase!=='finished' && phase!=='revealed') throw error('REVEAL_BEFORE_FINISH');
      if (phase==='revealed') return snapshot();
      const x=await gateway.send(ROUTES.reveal,{attemptId});
      if (!Array.isArray(x?.rows) || x.rows.length!==QUESTIONS.length ||
          x.rows.some(r=>!QUESTIONS.some(q=>q.ordinal===r.ordinal) || !OPTIONS.includes(r.correct_option)))
        throw error('INVALID_REVEAL_RESPONSE');
      keyRows=x.rows.map(r=>({ordinal:r.ordinal,correct_option:r.correct_option}));
      phase='revealed';return snapshot();
    },
    async review(ordinal) {
      if (phase!=='revealed') throw error('REVIEW_REQUIRES_CORRECTION');
      if (!QUESTIONS.some(q=>q.ordinal===ordinal)) throw error('INVALID_ORDINAL');
      const result=await gateway.send(ROUTES.review,{attemptId,ordinal});
      reviews.set(ordinal,result?.id??null);return snapshot();
    }
  };
}
