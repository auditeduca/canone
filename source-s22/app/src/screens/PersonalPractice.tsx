import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  PRACTICE_CODES, createPersonalQuestion, removePersonalQuestion, getPracticeTopics,
  startPractice, choosePractice, previousPractice, nextPractice, practiceSummary,
  exportPersonalBank, type PracticeMode, type PracticeCode, type PracticeSession,
  type PersonalQuestion,
} from '../tools/personal-practice';
import { ExamProgress, ExamQuestion } from '../ui/learning/ExamQuestion';

const input: React.CSSProperties = {width:'100%',padding:12,fontSize:16,color:'var(--tx-hi)',background:'var(--ink-150)',border:'1px solid var(--line)',borderRadius:8};
const names: Record<PracticeMode,string> = {reposicao:'Banco pessoal de questões',simulados:'Simulado autoral de demonstração'};
export function PersonalPractice({mode,bank,setBank,session,setSession}: {
  mode:PracticeMode;
  bank:PersonalQuestion[];
  setBank:Dispatch<SetStateAction<PersonalQuestion[]>>;
  session:PracticeSession|null;
  setSession:Dispatch<SetStateAction<PracticeSession|null>>;
}) {
  const [topic,setTopic]=useState('Tema de estudo');
  const [stem,setStem]=useState('');
  const [options,setOptions]=useState<Record<PracticeCode,string>>({A:'',B:'',C:'',D:''});
  const [sourceNote,setSourceNote]=useState('');
  const [filter,setFilter]=useState('');
  const [limit,setLimit]=useState('10');
  const [error,setError]=useState('');
  const current = session?.stage==='choosing' ? session.items[session.position] : null;
  const summary = session ? practiceSummary(session) : null;
  const topics=getPracticeTopics(bank);
  const view=useMemo(()=>bank.filter(q=>(!filter||q.topic===filter)),[bank,filter]);
  function add(event:FormEvent){event.preventDefault();try{
    const id=Math.max(0,...bank.map(q=>q.id))+1;
    const next=createPersonalQuestion(id,topic,stem,options,sourceNote,bank);
    setBank(old=>[...old,next]);setStem('');setOptions({A:'',B:'',C:'',D:''});setError('');
  }catch(e){setError(e instanceof Error?e.message:'Questão inválida.')}}
  function begin(){try{setSession(startPractice(mode,bank,filter,Number(limit)));setError('')}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar.')}}
  const exported='data:application/json;charset=utf-8,'+encodeURIComponent(exportPersonalBank(bank));
  return <div className="shell page" style={{maxWidth:1100}}>
    <a href="#/ecossistema" className="btn btn-ghost btn-sm">← Ecossistema</a>
    <header style={{margin:'24px 0'}}><span className="label">S17 · Prática autoral local · Sem autoridade de exame</span>
      <h1 className="display-lg" style={{marginTop:12}}>{names[mode]}</h1>
      <p className="lede" style={{marginTop:12}}>Escreva suas próprias questões com quatro alternativas e teste o fluxo de seleção e revisão. Nenhum gabarito, nota ou resultado oficial é gerado.</p>
    </header>
    <div className="card" role="note" style={{padding:20,marginBottom:24,borderColor:'var(--line-brass)'}}>
      <strong>Gate de conteúdo e segurança.</strong> Todas as questões e referências são de autoria do usuário, sem validação normativa; nenhuma alternativa é classificada como correta. Os dados ficam apenas na memória desta aba e desaparecem ao recarregar. Sem conta, cookies, envio a servidores ou publicidade do conteúdo.
    </div>
    <div className="row wrap" style={{gap:10,marginBottom:22}}>
      <a href="#/modulo/reposicao" className={'btn btn-sm '+(mode==='reposicao'?'btn-brass':'btn-ghost')}>Banco pessoal</a>
      <a href="#/modulo/simulados" className={'btn btn-sm '+(mode==='simulados'?'btn-brass':'btn-ghost')}>Simulado local</a>
      <a href="#/jornada" className="btn btn-ghost btn-sm">Jornada sintética anterior</a>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:22,alignItems:'start'}}>
      <div className="stack" style={{gap:18}}>
        <form className="card stack" onSubmit={add} style={{padding:24,gap:16}}>
          <h2 className="label-sm">Cadastrar questão pessoal · máximo 60</h2>
          <label className="stack" style={{gap:6}}>Tema<input required maxLength={100} value={topic} onChange={e=>setTopic(e.target.value)} style={input}/></label>
          <label className="stack" style={{gap:6}}>Enunciado<textarea required rows={4} maxLength={600} value={stem} onChange={e=>setStem(e.target.value)} style={input}/></label>
          {PRACTICE_CODES.map(code=><label className="stack" style={{gap:6}} key={code}>Alternativa {code}
            <input required maxLength={240} value={options[code]} onChange={e=>setOptions(old=>({...old,[code]:e.target.value}))} style={input}/>
          </label>)}
          <label className="stack" style={{gap:6}}>Referência informada por você (opcional, não verificada)
            <input maxLength={400} value={sourceNote} onChange={e=>setSourceNote(e.target.value)} style={input}/></label>
          <button type="submit" className="btn btn-brass">Adicionar ao banco pessoal</button>
          {error&&<p role="alert" className="xs">{error}</p>}
        </form>
        <section className="card" style={{padding:23}}>
          <div className="row wrap between" style={{gap:12,alignItems:'center'}}>
            <span className="label-sm">Acervo autoral · {bank.length}</span>
            <a className="btn btn-ghost btn-sm" href={exported} download="canone-questoes-autorais-s17.json">Exportar JSON</a>
          </div>
          <div className="stack" style={{gap:12,marginTop:14}}>
            {bank.length===0&&<p className="body">Adicione uma questão sua para iniciar. Nenhuma questão oficial está incluída.</p>}
            {bank.map(q=><article key={q.id} className="card card-flat" style={{padding:14}}>
              <strong>{q.topic}</strong><p className="body" style={{margin:'8px 0',overflowWrap:'anywhere'}}>{q.stem}</p>
              {q.sourceNote&&<p className="xs">Referência declarada (não verificada): {q.sourceNote}</p>}
              <button className="btn btn-ghost btn-sm" type="button" onClick={()=>setBank(old=>removePersonalQuestion(old,q.id))}>Excluir questão</button>
            </article>)}
          </div>
        </section>
      </div>
      <section className="card" style={{padding:24}} aria-label="Sessão de prática local">
        <span className="label-sm">Prática local · {mode==='simulados'?'sequência de questões':'revisão livre'}</span>
        <div className="stack" style={{gap:16,marginTop:18}}>
          <label className="stack" style={{gap:6}}>Tema<select value={filter} onChange={e=>setFilter(e.target.value)} style={input}>
            <option value="">Todos os temas</option>{topics.map(t=><option value={t} key={t}>{t}</option>)}
          </select></label>
          <label className="stack" style={{gap:6}}>Máximo de questões por sessão (1–20)
            <input inputMode="numeric" value={limit} onChange={e=>setLimit(e.target.value)} style={input}/></label>
          <p className="xs">{view.length} questões pessoais disponíveis neste filtro. Seleção determinística por cadastro, sem adaptação ou classificação.</p>
          <button type="button" className="btn btn-brass" onClick={begin}>Iniciar / reiniciar sessão</button>
        </div>
        {!session&&<p className="body" style={{marginTop:24}}>Sua sessão aparecerá aqui após cadastrar questões e iniciar.</p>}
        {session&&<div style={{marginTop:24}}>
          <p className="xs" role="status">{summary?.answered} de {summary?.total} escolhas · sem correção nem nota</p>
          <div style={{margin:'16px 0'}}><ExamProgress answered={summary?.answered??0} total={summary?.total??0}/></div>
          {session.stage==='review'?<>
            <h2 className="display-md">Revisão de escolhas</h2>
            <p className="body" style={{margin:'12px 0'}}>Este é um resumo pessoal, não é uma avaliação, ranking ou certificado.</p>
            <div className="stack" style={{gap:12}}>{session.items.map((q,i)=><article className="card card-flat" style={{padding:14}} key={q.id}>
              <span className="label-sm">Questão {i+1} · {q.topic}</span><p style={{marginTop:8}}>{q.stem}</p>
              <p className="xs" style={{marginTop:8}}>Alternativa marcada: {session.selections[String(q.id)]??'Nenhuma'}</p>
            </article>)}</div>
            <button className="btn btn-ghost" type="button" style={{marginTop:20}} onClick={()=>setSession(old=>old?previousPractice(old):old)}>Revisar escolhas</button>
          </>:current?<>
            <ExamQuestion ordinal={session.position+1} stem={current.stem}
              options={PRACTICE_CODES.map(code=>({code,text:current.options[code]}))}
              selected={session.selections[String(current.id)]??null}
              status={<span className="xs">Questão pessoal · sem gabarito</span>}
              onChoose={code=>{try{setSession(old=>old?choosePractice(old,code as PracticeCode):old)}catch(e){setError(String(e))}}}/>
            <div className="row wrap" style={{gap:10,marginTop:22}}>
              <button className="btn btn-ghost" type="button" disabled={session.position===0} onClick={()=>setSession(old=>old?previousPractice(old):old)}>Voltar</button>
              <button className="btn btn-brass" type="button" disabled={!session.selections[String(current.id)]}
                onClick={()=>setSession(old=>old?nextPractice(old):old)}>{session.position===session.items.length-1?'Revisar respostas':'Próxima questão'}</button>
            </div>
          </>:null}
        </div>}
      </section>
    </div>
    <p className="xs" style={{marginTop:24}}>Duelo entre dispositivos em tempo real, adaptação por proficiência, gabarito, progressão e resultado oficial seguem bloqueados. A S19 oferece apenas demonstrações locais baseadas em questões autorais.</p>
  </div>;
}
