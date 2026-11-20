import {useState,type ReactNode} from 'react';
import {ExamQuestion,ExamProgress} from '../ui/learning/ExamQuestion';
import {Nav,Footer,Disclaimer} from '../ui/Nav';
import {StudentHistory} from './StudentHistory';
import {localTestRuntime,parsePublicForm,parseCatalog,parseReveal,postGateway,isUuid,
  type PublicForm,type LocalRuntime,type ResumeRow} from './gateway-client';

type Stage='locked'|'ready'|'active'|'finished'|'revealed';
type KeyRow={ordinal:number;correct_option:string};
const MESSAGES:Record<string,string>={
  AUTH_REQUIRED:'Sessão indisponível. Nenhuma operação foi registrada.',
  FEATURE_NOT_AUTHORIZED:'Sua autorização para esta operação foi recusada pelo servidor.',
  FORBIDDEN:'Acesso à tentativa recusado pelo servidor.',
  ACTION_NOT_ALLOWED:'O servidor recusou a operação na fase atual.',
  INVALID_FORM_CONTRACT:'Formulário incompatível. Nenhuma tentativa foi aberta.',
  INVALID_QUESTION_CONTRACT:'Questões incompatíveis. Nenhuma tentativa foi aberta.',
  INVALID_OPTIONS:'Alternativas incompatíveis. Nenhuma tentativa foi aberta.',
  GATEWAY_UNAVAILABLE:'Não foi possível contactar o gateway.',
  INVALID_REVEAL_CONTRACT:'Correção incompleta ou incompatível.',
  INVALID_READ_CONTRACT:'Contrato de leitura rejeitado.',
  FORM_NOT_IN_CATALOG:'Este formulário não está disponível no catálogo autorizado.'
};
export function JornadaServidor(){
  const [runtime]=useState<LocalRuntime|null>(()=>localTestRuntime(window));
  const [stage,setStage]=useState<Stage>('locked');
  const [form,setForm]=useState<PublicForm|null>(null);
  const [attempt,setAttempt]=useState<string|null>(null);
  const [answers,setAnswers]=useState<Record<number,string>>({});
  const [selected,setSelected]=useState<string|null>(null);
  const [revealed,setRevealed]=useState<KeyRow[]>([]);
  const [reviews,setReviews]=useState<number[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const answered=form?.questions.filter(q=>Object.hasOwn(answers,q.ordinal)).length??0;
  const pending=form?.questions.find(q=>!Object.hasOwn(answers,q.ordinal))??null;
  async function run(op:()=>Promise<void>){
    if(busy)return;
    setBusy(true);setError('');
    try{await op();}catch(e){
      const code=typeof e==='object'&&e!==null&&'code' in e?String((e as {code:unknown}).code):'GATEWAY_UNAVAILABLE';
      setError(MESSAGES[code]??'A operação foi recusada: '+code);
    }finally{setBusy(false);}
  }
  async function load(){
    if(!runtime)return;
    await run(async()=>{
      const catalog=parseCatalog(await postGateway('catalog',{},runtime));
      if(!catalog.length)throw Object.assign(new Error('FORM_NOT_IN_CATALOG'),{code:'FORM_NOT_IN_CATALOG'});
      const result=parsePublicForm(await postGateway('questions',{formId:catalog[0].form_id},runtime));
      if(!catalog.some(r=>r.form_id===result.id&&r.question_count===result.questions.length))
        throw Object.assign(new Error('FORM_NOT_IN_CATALOG'),{code:'FORM_NOT_IN_CATALOG'});
      setForm(result);setStage('ready');setMessage('Formulário sintético disponibilizado em memória.');setSelected(null);
    });
  }
  async function start(){
    if(!form||!runtime||stage!=='ready')return;
    await run(async()=>{
      const result=await postGateway('start',{formId:form.id},runtime);
      if(!result||typeof result!=='object'||!('id' in result)||!isUuid(result.id))throw Object.assign(new Error('INVALID_ATTEMPT'),{code:'INVALID_ATTEMPT'});
      setAttempt(result.id);setStage('active');setMessage('Tentativa aberta pelo gateway.');
    });
  }
  function restore(data:ResumeRow){
    setAttempt(data.attempt_id);
    setAnswers(Object.fromEntries(data.answers.map(x=>[x.ordinal,x.option])));
    setSelected(null);setRevealed([]);setReviews([]);
    setStage(data.status==='concluida'?'finished':'active');
    setMessage(data.status==='concluida'?
      'Tentativa concluída recuperada. Solicite o gabarito ao servidor.':
      'Tentativa em andamento recuperada do PostgreSQL.');
  }
  async function answer(){
    if(!pending||!selected||!attempt||!runtime||stage!=='active')return;
    await run(async()=>{
      await postGateway('answer',{attemptId:attempt,ordinal:pending.ordinal,option:selected},runtime);
      setAnswers(old=>({...old,[pending.ordinal]:selected}));
      setSelected(null);setMessage('Resposta registrada pelo gateway. Sem gabarito antecipado.');
    });
  }
  async function finish(){
    if(!form||answered!==form.questions.length||!runtime||!attempt||stage!=='active')return;
    await run(async()=>{
      await postGateway('finish',{attemptId:attempt},runtime);
      setStage('finished');setMessage('Tentativa finalizada no servidor. Correção disponível para solicitar.');
    });
  }
  async function reveal(){
    if(!form||!runtime||!attempt||stage!=='finished')return;
    await run(async()=>{
      const result=parseReveal(await postGateway('reveal',{attemptId:attempt},runtime),form);
      setRevealed(result);setStage('revealed');setMessage('Gabarito recebido após encerramento da tentativa.');
    });
  }
  async function review(ordinal:number){
    if(!runtime||!attempt||stage!=='revealed'||reviews.includes(ordinal))return;
    await run(async()=>{
      await postGateway('review',{attemptId:attempt,ordinal},runtime);
      setReviews(old=>[...old,ordinal]);setMessage('Evento SRS confirmado pelo gateway.');
    });
  }
  let panel:ReactNode;
  if(!runtime){
    panel=<div className="card" role="status" style={{padding:24}}>
      <h2 className="display-md">Integração desabilitada</h2>
      <p className="body" style={{marginTop:12}}>Exige localhost e provedor de teste explícito. Não existe login gerenciado ou catálogo autenticado nesta versão.</p>
    </div>;
  }else if(stage==='locked'){
    panel=<div className="card" style={{padding:24}}>
      <h2 className="display-md">Preparar formulário local</h2>
      <p className="body" style={{marginTop:12}}>O gateway local entrega enunciados e alternativas somente após validar o acesso e os direitos sintéticos. Não há conteúdo normativo nem credencial de produção.</p>
      <button type="button" className="btn btn-brass" disabled={busy} onClick={load} style={{marginTop:22}}>Carregar formulário de teste</button>
    </div>;
  }else if(stage==='ready'){
    panel=<div className="card" style={{padding:24}}>
      <h2 className="display-md">Simulado de integração</h2>
      <p className="body" style={{marginTop:12}}>{form?.questions.length} questões sintéticas disponíveis. O serviço validará a assinatura e a permissão em cada operação.</p>
      <button type="button" className="btn btn-brass" disabled={busy} onClick={start} style={{marginTop:22}}>Iniciar tentativa no gateway</button>
    </div>;
  }else if(stage==='active'){
    panel=<div className="card" style={{padding:24}}>
      <ExamProgress answered={answered} total={form?.questions.length??0}/>
      {pending?<div style={{marginTop:24}}>
        <ExamQuestion ordinal={pending.ordinal} stem={pending.stem} options={pending.options}
          selected={selected} onChoose={setSelected} disabled={busy}
          status={<span className="xs">Sem correção antecipada</span>}/>
        <button type="button" className="btn btn-brass" style={{marginTop:24}}
          disabled={busy||!selected} onClick={answer}>Registrar resposta</button>
      </div>:<div style={{marginTop:24}}>
        <h2 className="display-md">Respostas registradas</h2>
        <p className="body" style={{marginTop:12}}>Todas as respostas foram enviadas. O gabarito só será solicitado após a conclusão.</p>
        <button type="button" className="btn btn-brass" style={{marginTop:20}} disabled={busy} onClick={finish}>Concluir tentativa</button>
      </div>}
    </div>;
  }else if(stage==='finished'){
    panel=<div className="card" style={{padding:24}}>
      <h2 className="display-md">Tentativa concluída</h2>
      <p className="body" style={{marginTop:12}}>O serviço retornou a finalização. Solicite a correção posterior.</p>
      <button type="button" className="btn btn-brass" style={{marginTop:18}} disabled={busy} onClick={reveal}>Consultar gabarito posterior</button>
    </div>;
  }else{
    const correct=revealed.filter(r=>answers[r.ordinal]===r.correct_option).length;
    panel=<section className="card" aria-label="Revisão posterior" style={{padding:24}}>
      <h2 className="display-md">Correção posterior · {correct}/{form?.questions.length}</h2>
      {form?.questions.map(q=>{
        const correctOption=revealed.find(r=>r.ordinal===q.ordinal)?.correct_option;
        return <article key={q.ordinal} className="card card-flat" style={{padding:16,marginTop:18}}>
          <h3>Questão {q.ordinal}</h3>
          <p className="body" style={{marginTop:7}}>{q.stem}</p>
          <p className="xs" style={{marginTop:8}}>Sua resposta: {answers[q.ordinal]} · Gabarito retornado pelo servidor: {correctOption}</p>
          <button type="button" className="btn btn-ghost btn-sm" style={{marginTop:12}} disabled={busy||reviews.includes(q.ordinal)}
            onClick={()=>review(q.ordinal)}>{reviews.includes(q.ordinal)?'Revisão registrada':'Registrar revisão SRS'}</button>
        </article>;
      })}
    </section>;
  }
  return <>
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <Nav path="/jornada-servidor"/>
    <div role="status" style={{padding:12,textAlign:'center',background:'var(--ink-150)',color:'var(--brass-200)'}}>
      F3-REC-06 · Conteúdo sintético entregue pelo gateway · Auth sintético somente CI · Sem conteúdo oficial · NO_GO produção
    </div>
    <main id="conteudo" className="shell page" style={{maxWidth:900}}>
      <a className="btn btn-ghost btn-sm" href="./index.html#/jornada">← Jornada histórica S22</a>
      <header style={{marginTop:28,marginBottom:26}}>
        <span className="label">Integração P0 · S22/NS-03</span>
        <h1 className="display-lg" style={{marginTop:10}}>Simulado com autoridade no servidor</h1>
        <p className="lede" style={{marginTop:12}}>Interface React e design system históricos. Os testes exigem gateway local; nenhuma resposta oficial ou gabarito está embutido nesta página.</p>
      </header>
      <div aria-live="polite" role="status" className="xs" style={{marginBottom:18}}>{message}</div>
      {error&&<p role="alert" className="disclaimer" style={{marginBottom:18}}>{error}</p>}
      {panel}
      {runtime&&form&&<StudentHistory runtime={runtime} form={form} onResume={restore}/>}
      <div style={{marginTop:32}}><Disclaimer variant="box"/></div>
    </main>
    <Footer/>
  </>;
}
