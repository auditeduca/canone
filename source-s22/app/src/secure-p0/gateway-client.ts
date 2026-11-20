/**
 * F3-REC-03: LOCAL-TEST-ONLY browser-to-gateway contract for existing Cânone React UI.
 * No answer key, private SQL, persistent token, or Supabase credentials in this module.
 * Production remains NO_GO: authenticated form delivery does not exist yet.
 */
export type PublicOption={code:string;text:string};
export type PublicQuestion={ordinal:number;stem:string;options:PublicOption[]};
export type PublicForm={id:string;questions:PublicQuestion[]};
export type LocalRuntime={getToken:()=>Promise<string>;getForm:()=>Promise<unknown>};
type Route='start'|'answer'|'finish'|'reveal'|'review'|'catalog'|'history'|'resume';
const ROUTES:Record<Route,string>={
  catalog:'/api/v1/exam/catalog',history:'/api/v1/exam/history',resume:'/api/v1/exam/resume',
  start:'/api/v1/exam/start',answer:'/api/v1/exam/answer',
  finish:'/api/v1/exam/finish',reveal:'/api/v1/exam/reveal',review:'/api/v1/exam/review'
};
const KEY=/^[A-E]$/;
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const isUuid=(id:unknown):id is string=>typeof id==='string'&&ID.test(id);
const keys=(obj:object,known:readonly string[])=>
  Object.keys(obj).length===known.length&&Object.keys(obj).every(k=>known.includes(k));
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const invalid=(code:string)=>Object.assign(new Error(code),{code});
export function parsePublicForm(value:unknown):PublicForm {
  if(!record(value)||!keys(value,['id','questions'])||!isUuid(value.id)||
      !Array.isArray(value.questions)||value.questions.length<1||value.questions.length>100)
    throw invalid('INVALID_FORM_CONTRACT');
  const seen=new Set<number>();
  const questions:PublicQuestion[]=value.questions.map((raw:unknown)=>{
    if(!record(raw)||!keys(raw,['ordinal','stem','options'])||
        !Number.isInteger(raw.ordinal)||Number(raw.ordinal)<1||Number(raw.ordinal)>1000||
        typeof raw.stem!=='string'||raw.stem.trim().length<3||raw.stem.length>2000||
        !Array.isArray(raw.options)||raw.options.length<2||raw.options.length>5)
      throw invalid('INVALID_QUESTION_CONTRACT');
    const ordinal=Number(raw.ordinal);
    if(seen.has(ordinal))throw invalid('DUPLICATE_QUESTION');
    seen.add(ordinal);
    const codes=new Set<string>();
    const options:PublicOption[]=raw.options.map((opt:unknown)=>{
      if(!record(opt)||!keys(opt,['code','text'])||typeof opt.code!=='string'||
        !KEY.test(opt.code)||codes.has(opt.code)||typeof opt.text!=='string'||
        !opt.text.trim()||opt.text.length>500)throw invalid('INVALID_OPTIONS');
      codes.add(opt.code);
      return {code:opt.code,text:opt.text};
    });
    return {ordinal,stem:raw.stem,options};
  });
  return {id:value.id,questions:questions.sort((a,b)=>a.ordinal-b.ordinal)};
}
/** Never auto-bootstrap from a real deployment or from URL/query tokens. */
export function localTestRuntime(win:Window&{__CANONE_P0_TEST_ONLY__?:unknown}):LocalRuntime|null{
  if(!['127.0.0.1','localhost','::1'].includes(win.location.hostname))return null;
  const r=win.__CANONE_P0_TEST_ONLY__;
  if(!record(r)||typeof r.getToken!=='function'||typeof r.getForm!=='function')return null;
  return r as unknown as LocalRuntime;
}
export async function postGateway(
  action:Route,body:Record<string,unknown>,runtime:LocalRuntime,
  fetchImpl:typeof fetch=fetch
):Promise<unknown> {
  if(!Object.hasOwn(ROUTES,action))throw invalid('UNKNOWN_ACTION');
  if(!runtime||typeof runtime.getToken!=='function')throw invalid('AUTH_REQUIRED');
  const jwt=await runtime.getToken();
  if(typeof jwt!=='string'||jwt.length>8192||!JWT.test(jwt))throw invalid('AUTH_REQUIRED');
  let response:Response;
  try{
    response=await fetchImpl(ROUTES[action],{method:'POST',headers:{
      'content-type':'application/json',authorization:'Bearer '+jwt
    },credentials:'same-origin',cache:'no-store',body:JSON.stringify(body)});
  }catch{throw invalid('GATEWAY_UNAVAILABLE');}
  let payload:unknown;
  try{payload=await response.json();}catch{throw invalid('INVALID_GATEWAY_RESPONSE');}
  if(!record(payload)||typeof payload.ok!=='boolean')throw invalid('INVALID_GATEWAY_RESPONSE');
  if(!response.ok||payload.ok!==true){
    const code=typeof payload.error==='string'&&/^[A-Z_]{3,50}$/.test(payload.error)?payload.error:'GATEWAY_UNAVAILABLE';
    throw invalid(code);
  }
  return payload.data;
}
export function parseReveal(value:unknown,form:PublicForm):{ordinal:number;correct_option:string}[]{
  if(!record(value)||!Array.isArray(value.rows)||value.rows.length!==form.questions.length)
    throw invalid('INVALID_REVEAL_CONTRACT');
  const used=new Set<number>();
  return value.rows.map((entry:unknown)=>{
    if(!record(entry)||!Number.isInteger(entry.ordinal)||typeof entry.correct_option!=='string'||
       !KEY.test(entry.correct_option)||used.has(Number(entry.ordinal))||
       !form.questions.some(q=>q.ordinal===entry.ordinal&&q.options.some(o=>o.code===entry.correct_option)))
      throw invalid('INVALID_REVEAL_CONTRACT');
    used.add(Number(entry.ordinal));
    return {ordinal:Number(entry.ordinal),correct_option:entry.correct_option};
  });
}

export type CatalogRow={form_id:string;form_label:string;question_count:number};
export type HistoryRow={attempt_id:string;form_id:string;status:string;started_at:string;
  finished_at:string|null;answered_count:number;correct_count:number|null;question_count:number};
export type ResumeRow={attempt_id:string;form_id:string;status:'em_andamento'|'concluida';
  answers:Array<{ordinal:number;option:string}>};
const integer=(x:unknown):number=>{
  const n=typeof x==='string'&&/^[0-9]+$/.test(x)?Number(x):x;
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>1000)throw invalid('INVALID_READ_CONTRACT');
  return n;
};
export function parseCatalog(value:unknown):CatalogRow[]{
  if(!record(value)||!keys(value,['rows'])||!Array.isArray(value.rows)||value.rows.length>20)
    throw invalid('INVALID_READ_CONTRACT');
  return value.rows.map((r:unknown)=>{
    if(!record(r)||!keys(r,['form_id','form_label','question_count'])||!isUuid(r.form_id)||
        typeof r.form_label!=='string'||!r.form_label.trim())throw invalid('INVALID_READ_CONTRACT');
    const count=integer(r.question_count);
    if(count<1)throw invalid('INVALID_READ_CONTRACT');
    return {form_id:r.form_id,form_label:r.form_label,question_count:count};
  });
}
export function parseHistory(value:unknown):HistoryRow[]{
  if(!record(value)||!keys(value,['rows'])||!Array.isArray(value.rows)||value.rows.length>20)
    throw invalid('INVALID_READ_CONTRACT');
  return value.rows.map((r:unknown)=>{
    if(!record(r)||!keys(r,['attempt_id','form_id','status','started_at','finished_at',
      'answered_count','correct_count','question_count'])||
      !isUuid(r.attempt_id)||!isUuid(r.form_id)||
      !['em_andamento','concluida','abandonada'].includes(String(r.status))||
      typeof r.started_at!=='string'||r.started_at.length>64||
      (r.finished_at!==null&&typeof r.finished_at!=='string')||
      (r.correct_count!==null&&typeof r.correct_count!=='number'))
      throw invalid('INVALID_READ_CONTRACT');
    const answered=integer(r.answered_count),count=integer(r.question_count);
    if(answered>count||(r.status!=='concluida'&&r.correct_count!==null))
      throw invalid('INVALID_READ_CONTRACT');
    const correct=r.correct_count===null?null:integer(r.correct_count);
    return {attempt_id:r.attempt_id,form_id:r.form_id,status:String(r.status),
      started_at:r.started_at,finished_at:r.finished_at,
      answered_count:answered,correct_count:correct,question_count:count};
  });
}
export function parseResume(value:unknown,form:PublicForm):ResumeRow{
  if(!record(value)||!keys(value,['attempt_id','form_id','status','started_at','finished_at',
     'answered_count','question_count','answers'])||
    !isUuid(value.attempt_id)||value.form_id!==form.id||
    !['em_andamento','concluida'].includes(String(value.status))||
    !Array.isArray(value.answers)||value.answers.length>form.questions.length||
    integer(value.question_count)!==form.questions.length||
    integer(value.answered_count)!==value.answers.length)
    throw invalid('INVALID_RESUME_CONTRACT');
  const used=new Set<number>();
  const answers=value.answers.map((a:unknown)=>{
    if(!record(a)||!keys(a,['ordinal','option'])||typeof a.ordinal!=='number'||
      !Number.isInteger(a.ordinal)||typeof a.option!=='string'||
      used.has(a.ordinal)||!form.questions.some(q=>q.ordinal===a.ordinal&&
        q.options.some(o=>o.code===a.option)))throw invalid('INVALID_RESUME_CONTRACT');
    used.add(a.ordinal);
    return {ordinal:a.ordinal,option:a.option};
  });
  return {attempt_id:value.attempt_id,form_id:form.id,status:value.status as ResumeRow['status'],answers};
}
