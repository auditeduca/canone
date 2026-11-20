import {useState} from 'react';
import {parseHistory,parseResume,postGateway,type HistoryRow,type ResumeRow,
  type LocalRuntime,type PublicForm} from './gateway-client';
export function StudentHistory({runtime,form,onResume}:{
  runtime:LocalRuntime;form:PublicForm;onResume:(x:ResumeRow)=>void;
}){
  const [rows,setRows]=useState<HistoryRow[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  async function list(){
    if(pending)return;setPending(true);setError('');
    try{
      const result=parseHistory(await postGateway('history',{},runtime));
      setRows(result);setLoaded(true);
    }catch{setError('Histórico indisponível ou não autorizado.');}
    finally{setPending(false);}
  }
  async function resume(id:string){
    if(pending)return;setPending(true);setError('');
    try{
      const data=parseResume(await postGateway('resume',{attemptId:id},runtime),form);
      onResume(data);
    }catch{setError('Tentativa indisponível ou não pertence a esta sessão.');}
    finally{setPending(false);}
  }
  return <section className="card" aria-label="Histórico persistido" style={{marginTop:24,padding:18}}>
    <div className="between wrap" style={{gap:14}}>
      <div>
        <h2 className="label">Minhas tentativas</h2>
        <p className="xs" style={{marginTop:6}}>Leitura restrita e persistida no PostgreSQL de teste.</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending}
        onClick={list}>Consultar histórico</button>
    </div>
    {error&&<p role="alert" className="xs" style={{marginTop:12}}>{error}</p>}
    {loaded&&rows.length===0&&<p className="body" style={{marginTop:14}}>Nenhuma tentativa encontrada.</p>}
    {loaded&&rows.map(row=><div key={row.attempt_id} className="between wrap" style={{
      paddingBlock:13,borderTop:'1px solid var(--line)',gap:12}}>
      <div>
        <strong className="body">{row.status==='em_andamento'?'Em andamento':row.status==='concluida'?'Concluída':'Abandonada'}</strong>
        <p className="xs" style={{marginTop:4}}>
          {row.answered_count}/{row.question_count} respostas
          {row.correct_count!==null?' · '+row.correct_count+' acertos (após conclusão)':''}
        </p>
      </div>
      {row.status!=='abandonada'&&row.form_id===form.id&&<button type="button"
        className="btn btn-ghost btn-sm" disabled={pending}
        onClick={()=>resume(row.attempt_id)}>
        {row.status==='em_andamento'?'Retomar tentativa':'Consultar tentativa'}
      </button>}
    </div>)}
  </section>;
}
