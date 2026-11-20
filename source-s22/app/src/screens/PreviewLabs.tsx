import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction, type ChangeEvent } from 'react';
import { ExamQuestion, ExamProgress } from '../ui/learning/ExamQuestion';
import { getPracticeTopics, PRACTICE_CODES, type PersonalQuestion, type PracticeCode } from '../tools/personal-practice';
import { LAB_IDS, startDuel, respondDuel, duelSummary, startAdaptive, reviewAdaptive, adaptiveSummary, addNote,removeNote,exportLocalNotes,exportSessionSnapshot,
  type LabId,type Duel,type Adaptive,type Note,type MediaKind } from '../tools/preview-labs';
export { LAB_IDS };
const field:React.CSSProperties={width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:8,background:'var(--ink-150)',color:'var(--tx-hi)',fontSize:16};
const titles:Record<LabId,string>={'duelo':'Duelo local de escolhas','simulado-adaptativo':'Revisão guiada por autopercepção','podcast':'Podcast — narração local','videodulas':'Videoaulas — mídia do dispositivo','offline':'Cânone Offline — pacote de estudo'};
function Download({data,filename,label}:{data:string;filename:string;label:string}){
 const href=useMemo(()=>`data:application/json;charset=utf-8,${encodeURIComponent(data)}`,[data]);
 return <a className="btn btn-ghost btn-sm" href={href} download={filename}>{label}</a>;
}
function Header({id}:{id:LabId}){
 return <header style={{marginTop:24,marginBottom:24}}><span className="label">S19 • Laboratório restrito e autoral</span><h1 className="display-lg" style={{marginTop:12}}>{titles[id]}</h1><div className="card" role="note" style={{padding:18,marginTop:20,borderColor:'var(--line-brass)'}}>Sem fonte homologada, nota, correção, resultado oficial, classificação de desempenho, conta, sincronização ou upload. Registros somente nesta aba. Os conteúdos e respostas são criados por você.</div></header>;
}
function DuelLab({bank,duel,setDuel}:{bank:PersonalQuestion[];duel:Duel|null;setDuel:Dispatch<SetStateAction<Duel|null>>}){
 const [error,setError]=useState('');const question=duel?duel.items[duel.index]:null;
 const summary=duel?duelSummary(duel):null;
 function begin(){try{setDuel(startDuel(bank));setError('')}catch(e){setError(e instanceof Error?e.message:'Erro na sessão')}}
 function answer(code:string){if(!duel)return;try{setDuel(respondDuel(duel,duel.turn,code as PracticeCode));setError('')}catch(e){setError(e instanceof Error?e.message:'Erro no turno')}}
 return <div className="stack" style={{gap:18}}>
  <p className="lede">Duas pessoas escolhem alternativas na mesma tela, em turnos A e B. O relatório mostra diferenças de escolha, nunca vencedor ou acertos.</p>
  <div className="row wrap" style={{gap:10}}><a className="btn btn-ghost btn-sm" href="#/modulo/reposicao">Cadastrar questões autorais</a><button type="button" className="btn btn-brass" onClick={begin}>Iniciar ou reiniciar duelo</button></div>
  {error&&<p role="alert">{error}</p>}
  {duel&&<div className="card" style={{padding:24}}><ExamProgress answered={summary?.completed??0} total={summary?.total??0}/>
   {question?<><p className="label-sm" style={{margin:'18px 0 12px'}}>Vez do participante {duel.turn} · questão {duel.index+1} de {duel.questionIds.length}</p><ExamQuestion ordinal={duel.index+1} stem={question.stem} options={PRACTICE_CODES.map(code=>({code,text:question.options[code]}))} selected={duel.responses[String(question.id)]?.[duel.turn]||null} onChoose={answer}/><p className="xs" style={{marginTop:16}}>Para reduzir influência, o segundo participante deve aguardar sua vez. As escolhas do primeiro não são exibidas antes do fim da questão.</p></>:
   <><h2 className="display-md" style={{marginTop:20}}>Sessão encerrada</h2><p style={{marginTop:15}}>Questões concluídas: {summary?.completed}/{summary?.total}. Alternativas diferentes: {summary?.divergent}.</p><p className="xs" style={{marginTop:10}}>Sem avaliação de acertos, empate, vencedor ou classificação.</p></>}
  </div>}
 </div>;
}
function AdaptiveLab({bank,session,setSession}:{bank:PersonalQuestion[];session:Adaptive|null;setSession:Dispatch<SetStateAction<Adaptive|null>>}){
 const [topic,setTopic]=useState(''),[error,setError]=useState('');const question=session?session.items.find(q=>q.id===session.pending[0]):null;
 const stats=session?adaptiveSummary(session):null;
 function start(){try{setSession(startAdaptive(bank,topic));setError('')}catch(e){setError(e instanceof Error?e.message:'Erro de revisão')}}
 function decide(decision:'rever'|'seguir'){if(!session||!question)return;try{setSession(reviewAdaptive(session,question.id,decision));setError('')}catch(e){setError(e instanceof Error?e.message:'Erro de revisão')}}
 return <div className="stack" style={{gap:18}}><p className="lede">Revisão guiada pelo tema e pelo julgamento pessoal de confiança. Não estima proficiência ou adapta dificuldade por acerto.</p>
 <div className="card" style={{padding:20}}><label className="stack" style={{gap:8}}>Tema do banco pessoal<select style={field} value={topic} onChange={e=>setTopic(e.target.value)}><option value="">Todos os temas</option>{getPracticeTopics(bank).map(t=><option value={t} key={t}>{t}</option>)}</select></label><div className="row wrap" style={{gap:10,marginTop:18}}><button className="btn btn-brass" onClick={start} type="button">Iniciar revisão</button><a className="btn btn-ghost btn-sm" href="#/modulo/reposicao">Cadastrar questões autorais</a></div></div>
 {error&&<p role="alert">{error}</p>}
 {session&&<div className="card" style={{padding:24}}><p className="label-sm">Revisadas {stats?.reviewed} · pendentes {stats?.pending} · marcadas para rever {stats?.revisit}</p>
 {question?<><h2 style={{fontSize:18,margin:'20px 0 12px'}}>{question.stem}</h2><p className="xs">Questão escrita pelo usuário · sem gabarito nem classificação</p><div className="stack" style={{gap:8,marginTop:15}}>{PRACTICE_CODES.map(c=><p className="card card-flat" key={c} style={{padding:12}}>{c}. {question.options[c]}</p>)}</div><div className="row wrap" style={{gap:10,marginTop:20}}><button type="button" className="btn btn-ghost" onClick={()=>decide('rever')}>Preciso rever</button><button type="button" className="btn btn-brass" onClick={()=>decide('seguir')}>Sinto confiança para seguir</button></div></>:<p style={{marginTop:20}}>Revisão local concluída. {stats?.revisit} item(ns) sinalizado(s) para revisão futura. Inicie outra sessão para repetir o tema.</p>}</div>}
 </div>;
}
function NotesLab({kind,notes,setNotes}:{kind:MediaKind;notes:Note[];setNotes:Dispatch<SetStateAction<Note[]>>}){
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[error,setError]=useState('');
 const own=notes.filter(n=>n.kind===kind);
 const [selected,setSelected]=useState<number|null>(null);
 const chosen=own.find(n=>n.id===selected)||null;
 const [audioState,setAudioState]=useState('');const [videoUrl,setVideoUrl]=useState<string|null>(null);const [videoName,setVideoName]=useState('');
 useEffect(()=>()=>{if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel()},[]);
 useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl)},[videoUrl]);
 function add(e:FormEvent){e.preventDefault();try{const next=addNote(notes,kind,title,body);setNotes(next);setSelected(next[next.length-1].id);setTitle('');setBody('');setError('')}catch(e){setError(e instanceof Error?e.message:'Entrada inválida')}}
 function erase(note:Note){try{setNotes(removeNote(notes,kind,note.id));if(selected===note.id)setSelected(null);setError('')}catch(e){setError(e instanceof Error?e.message:'Erro')}}
 function speak(){if(!chosen){setAudioState('Escolha um roteiro de sua autoria.');return;}if(typeof window==='undefined'||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setAudioState('Síntese de voz indisponível neste navegador.');return;}
   window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(chosen.body);u.lang='pt-BR';u.rate=0.9;u.onend=()=>setAudioState('Reprodução encerrada.');u.onerror=()=>setAudioState('A reprodução não pôde ser concluída.');window.speechSynthesis.speak(u);setAudioState('Reproduzindo texto autoral pelo dispositivo.');}
 function loadVideo(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!f.type.startsWith('video/')||f.size>200*1024*1024||f.size<=0){setError('Selecione vídeo local válido com até 200 MB.');return;}setVideoUrl(URL.createObjectURL(f));setVideoName(f.name);setError('')}
 let exported='';try{exported=exportLocalNotes(notes,kind)}catch{exported=''}
 return <div className="stack" style={{gap:22}}><p className="lede">{kind==='podcast'?'Escreva um roteiro próprio e escute-o com a voz sintetizada do navegador, quando disponível. Não cria arquivos MP3.':kind==='videodulas'?'Assista a um vídeo escolhido do dispositivo e registre um roteiro de aula. O arquivo não é enviado.':'Crie notas para exportação e confira o estado de conexão. Não há service worker, cache offline garantido ou sincronização.'}</p>
  {kind==='videodulas'&&<div className="card" style={{padding:20}}><label className="stack" style={{gap:9}}>Vídeo existente no seu dispositivo<input type="file" accept="video/*" onChange={loadVideo}/></label>{videoUrl&&<><p className="xs" style={{marginTop:10}}>{videoName} · reproduzido localmente</p><video controls playsInline src={videoUrl} style={{width:'100%',maxHeight:380,marginTop:14}} aria-label="Vídeo local selecionado"/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setVideoUrl(null);setVideoName('')}}>Descarregar vídeo</button></>}</div>}
  {kind==='offline'&&<p className="xs">As notas existem só enquanto a aba permanece aberta. Baixe seu JSON antes de sair e mantenha cópia no dispositivo.</p>}
  <div className="split-2" style={{gap:22,alignItems:'start'}}><form className="card stack" onSubmit={add} style={{padding:24,gap:14}}><span className="label-sm">{kind==='podcast'?'Roteiro autoral':kind==='videodulas'?'Anotações e roteiro':'Nota para exportação'}</span><label className="stack" style={{gap:6}}>Título<input style={field} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} /></label><label className="stack" style={{gap:6}}>Texto próprio<textarea rows={7} style={field} value={body} maxLength={3000} onChange={e=>setBody(e.target.value)}/></label><button className="btn btn-brass">Adicionar à sessão</button>{error&&<p role="alert">{error}</p>}</form>
  <section className="card stack" style={{padding:24,gap:12}}><span className="label-sm">Material nesta sessão ({own.length})</span>{exported&&<Download label="Exportar notas JSON" data={exported} filename={'canone-'+kind+'-s19.json'}/>}{own.map(n=><div className="card card-flat" style={{padding:12}} key={n.id}><button className="btn btn-ghost btn-sm" type="button" onClick={()=>setSelected(n.id)}>{n.title}</button><button className="btn btn-ghost btn-sm" type="button" onClick={()=>erase(n)}>Excluir</button></div>)}{chosen&&<div style={{marginTop:10}}><h3>{chosen.title}</h3><p className="body" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:10}}>{chosen.body}</p>{kind==='podcast'&&<div className="row wrap" style={{gap:10,marginTop:12}}><button className="btn btn-brass btn-sm" type="button" onClick={speak}>Ouvir narração</button><button className="btn btn-ghost btn-sm" type="button" onClick={()=>{window.speechSynthesis?.cancel();setAudioState('Reprodução interrompida.')}}>Parar</button></div>}{audioState&&<p className="xs" role="status">{audioState}</p>}</div>}</section></div>
 </div>;
}
function OfflineLab({notes,setNotes,bank}:{notes:Note[];setNotes:Dispatch<SetStateAction<Note[]>>;bank:PersonalQuestion[]}){
 const [online,setOnline]=useState(typeof navigator!=='undefined'?navigator.onLine:true);const [error,setError]=useState('');
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[]);
 let snapshot='';try{snapshot=exportSessionSnapshot({bank,notes})}catch(e){snapshot='';}
 return <div className="stack" style={{gap:20}}><div className="card" style={{padding:20}}><p className="label-sm">Conectividade reportada pelo navegador: {online?'online':'offline'}</p><p className="xs" style={{marginTop:8}}>O sinal não comprova acesso ao servidor. Abrir uma nova página offline exige recursos previamente disponíveis no cache do navegador, sem garantia nesta prévia.</p><div className="row wrap" style={{gap:10,marginTop:14}}>{snapshot?<Download label="Exportar questões e notas autorais (JSON)" data={snapshot} filename="canone-backup-s19-preview.json"/>:<button className="btn btn-ghost btn-sm" onClick={()=>setError('Pacote de dados excede os limites ou contém registro inválido.')} type="button">Verificar exportação</button>}</div>{error&&<p role="alert">{error}</p>}</div><NotesLab kind="offline" notes={notes} setNotes={setNotes}/></div>;
}
export function PreviewLabs({id,bank,duel,setDuel,adaptive,setAdaptive,notes,setNotes}:{id:LabId;bank:PersonalQuestion[];duel:Duel|null;setDuel:Dispatch<SetStateAction<Duel|null>>;adaptive:Adaptive|null;setAdaptive:Dispatch<SetStateAction<Adaptive|null>>;notes:Note[];setNotes:Dispatch<SetStateAction<Note[]>>}){
 return <div className="shell page" style={{maxWidth:1100}}><a className="btn btn-ghost btn-sm" href="#/ecossistema">← Ecossistema</a><Header id={id}/>
 {id==='duelo'?<DuelLab bank={bank} duel={duel} setDuel={setDuel}/>:id==='simulado-adaptativo'?<AdaptiveLab bank={bank} session={adaptive} setSession={setAdaptive}/>:id==='offline'?<OfflineLab notes={notes} setNotes={setNotes} bank={bank}/>:<NotesLab kind={id} notes={notes} setNotes={setNotes}/>}
 <p className="xs" style={{marginTop:28}}>S19: instrumentos didáticos autorais de prévia. O motor canônico de tentativas, gabaritos, proveniência oficial, perfil e PWA completo exige integração e homologação.</p></div>;
}
