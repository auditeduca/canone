import {useMemo, useState, type Dispatch, type SetStateAction, type FormEvent} from 'react';
import {createKnowledgeItem, removeKnowledgeItem, mapOutline, type KnowledgeKind, type KnowledgeItem} from '../tools/personal-knowledge';
export const KNOWLEDGE_IDS: readonly KnowledgeKind[]=['mapas-mentais','guia-de-bolso','glossario','casos'];
const names:Record<KnowledgeKind,string>={'mapas-mentais':'Mapas Mentais','guia-de-bolso':'Guia de Bolso','glossario':'Glossário Contábil','casos':'Casos Práticos'};
const instructions:Record<KnowledgeKind,string>={
 'mapas-mentais':'Construa um mapa hierárquico com nós próprios e vínculos entre assuntos.',
 'guia-de-bolso':'Mantenha notas pessoais de consulta rápida. Nada é validado automaticamente.',
 'glossario':'Organize termos e explicações que você mesmo escreveu.',
 'casos':'Registre situações fictícias de estudo, hipóteses e observações sem julgamento automático.'
};
const input:React.CSSProperties={width:'100%',padding:12,fontSize:16,color:'var(--tx-hi)',background:'var(--ink-150)',border:'1px solid var(--line)',borderRadius:8};
export function KnowledgeModules({id,items,setItems}:{id:KnowledgeKind;items:KnowledgeItem[];setItems:Dispatch<SetStateAction<KnowledgeItem[]>>}){
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[reference,setReference]=useState(''),[parentId,setParentId]=useState(''),[filter,setFilter]=useState(''),[error,setError]=useState('');
 const relevant=items.filter(x=>x.kind===id),matches=relevant.filter(x=>(x.title+' '+x.body).toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
 const outline=useMemo(()=>id==='mapas-mentais'?mapOutline(items):[],[id,items]);
 function add(event:FormEvent){event.preventDefault();try{
  if(items.length>=80)throw Error('Limite de 80 registros nesta sessão.');
  const nextId=Math.max(0,...items.map(x=>x.id))+1;
  const parent=parentId?Number(parentId):null;
  const next=createKnowledgeItem(nextId,id,title,body,reference,parent,items);
  setItems(existing=>[...existing,next]);setTitle('');setBody('');setReference('');setParentId('');setError('');
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível adicionar o registro.')}}
 const download='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({schema:'canone.user-authored.s16',createdOffline:true,note:'Dados autorais, sem homologação',kind:id,items:relevant},null,2));
 return <div className="shell page" style={{maxWidth:1110}}>
  <a href="#/ecossistema" className="btn btn-ghost btn-sm">← Ecossistema</a>
  <header style={{marginTop:22,marginBottom:22}}><span className="label">S16 · Estúdio autoral · Não homologado</span><h1 className="display-lg" style={{marginTop:12}}>{names[id]}</h1><p className="lede" style={{marginTop:10}}>{instructions[id]}</p></header>
  <div className="card" role="note" style={{padding:20,borderColor:'var(--line-brass)',marginBottom:24}}><strong>Conteúdo do usuário.</strong> O aplicativo não afirma que as anotações são corretas, atualizadas ou compatíveis com o CFC, CPC ou legislação. Os registros permanecem apenas na memória desta aba e serão perdidos ao recarregar. Utilize Exportar JSON para preservar seu trabalho.</div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,330px),1fr))',gap:22,alignItems:'start'}}>
   <form className="card stack" onSubmit={add} style={{padding:24,gap:17}}>
    <span className="label-sm">{id==='mapas-mentais'?'Novo nó':'Novo registro'} — {names[id]}</span>
    <label className="stack" style={{gap:6}}>Título / termo<input value={title} required maxLength={160} onChange={e=>setTitle(e.target.value)} style={input}/></label>
    {id==='mapas-mentais'&&<label className="stack" style={{gap:6}}>Nó superior (opcional)<select value={parentId} onChange={e=>setParentId(e.target.value)} style={input}><option value="">Raiz</option>{relevant.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    <label className="stack" style={{gap:6}}>{id==='casos'?'Contexto fictício, hipóteses e observações':'Descrição pessoal (opcional)'}<textarea rows={5} value={body} maxLength={1500} onChange={e=>setBody(e.target.value)} style={{...input,resize:'vertical'}}/></label>
    <label className="stack" style={{gap:6}}>Fonte/referência informada por você (opcional)<input value={reference} maxLength={400} onChange={e=>setReference(e.target.value)} style={input}/></label>
    <button type="submit" className="btn btn-brass">Adicionar {id==='mapas-mentais'?'nó':'registro'}</button>
    {error&&<p role="alert" className="xs">{error}</p>}
   </form>
   <section className="card" style={{padding:24}} aria-live="polite"><div className="row wrap" style={{justifyContent:'space-between',gap:12,alignItems:'center'}}><span className="label-sm">Meu acervo desta sessão · {relevant.length}</span><a className="btn btn-ghost btn-sm" download={'canone-'+id+'-autoral.json'} href={download}>Exportar JSON</a></div>
    {id!=='mapas-mentais'&&<label className="stack" style={{gap:7,marginTop:16}}>Filtrar registros<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} style={input}/></label>}
    <div className="stack" style={{gap:12,marginTop:19}}>
      {id==='mapas-mentais'?outline.map(item=>{
       const record=items.find(x=>x.id===item.id)!;
       return <article key={item.id} className="card" style={{padding:14,marginLeft:Math.min(item.depth,5)*13,borderLeft:'3px solid var(--brass-300)'}}><div className="row wrap" style={{justifyContent:'space-between',gap:9}}><strong>{record.title}</strong><button className="btn btn-ghost btn-sm" type="button" onClick={()=>setItems(old=>removeKnowledgeItem(old,record.id))}>Excluir ramo</button></div>{record.body&&<p className="body" style={{marginTop:8,overflowWrap:'anywhere'}}>{record.body}</p>}{record.reference&&<p className="xs" style={{marginTop:9}}>Referência declarada: {record.reference}</p>}</article>;
      }):matches.map(item=><article key={item.id} className="card" style={{padding:15}}><div className="row wrap" style={{justifyContent:'space-between',gap:9}}><strong>{item.title}</strong><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setItems(old=>removeKnowledgeItem(old,item.id))}>Excluir</button></div>{item.body&&<p className="body" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:10}}>{item.body}</p>}{item.reference&&<p className="xs" style={{marginTop:9}}>Referência declarada: {item.reference}</p>}</article>)}
      {matches.length===0&&id!=='mapas-mentais'&&<p className="body">Nenhum registro correspondente.</p>}
      {id==='mapas-mentais'&&outline.length===0&&<p className="body">Adicione o primeiro nó raiz para começar seu mapa.</p>}
    </div>
   </section>
  </div>
 </div>;
}
