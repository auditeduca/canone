import {useEffect,useMemo,useState,type Dispatch,type FormEvent,type SetStateAction} from 'react';
import {WORKBENCH_CONFIG,WORKBENCH_IDS,makeWorkbenchEntry,updateWorkbenchEntry,removeWorkbenchEntry,workbenchSummary,exportWorkbench,gateForSource,type WorkbenchDomain,type WorkbenchEntry} from '../tools/study-workbench';
const fieldStyle:React.CSSProperties={width:'100%',padding:12,fontSize:16,color:'var(--tx-hi)',background:'var(--ink-150)',border:'1px solid var(--line)',borderRadius:8};
type Props={domain:WorkbenchDomain;entries:WorkbenchEntry[];setEntries:Dispatch<SetStateAction<WorkbenchEntry[]>>};
export function StudyWorkbenches({domain,entries,setEntries}:Props){
 const metadata=WORKBENCH_CONFIG[domain];
 const [title,setTitle]=useState('');
 const [parts,setParts]=useState<[string,string,string]>(['','','']);
 const [source,setSource]=useState('');
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [editing,setEditing]=useState<number|null>(null);
 useEffect(()=>{setTitle('');setParts(['','','']);setSource('');setError('');setSearch('');setEditing(null)},[domain]);
 const records=useMemo(()=>entries.filter(x=>x.domain===domain).filter(x=>(x.title+' '+x.fields.join(' ')+' '+x.source).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[entries,domain,search]);
 const summary=workbenchSummary(entries,domain);
 const downloadable='data:application/json;charset=utf-8,'+encodeURIComponent(exportWorkbench(entries,domain));
 const changePart=(position:number,value:string)=>setParts(old=>old.map((x,i)=>i===position?value:x) as [string,string,string]);
 const reset=()=>{setTitle('');setParts(['','','']);setSource('');setError('');setEditing(null)};
 function submit(event:FormEvent){event.preventDefault();try{
  const draft={title,fields:parts,source};
  if(editing!==null){setEntries(updateWorkbenchEntry(entries,editing,domain,draft));}else{
   const id=Math.max(0,...entries.map(e=>e.id))+1;
   setEntries([...entries,makeWorkbenchEntry(id,domain,draft,entries)]);
  }
  reset();
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar o registro.')}}
 function edit(item:WorkbenchEntry){setEditing(item.id);setTitle(item.title);setParts([...item.fields]);setSource(item.source);setError('')}
 function erase(item:WorkbenchEntry){try{setEntries(old=>removeWorkbenchEntry(old,item.id,domain));if(editing===item.id)reset()}catch(e){setError(e instanceof Error?e.message:'Falha ao excluir.')}}
 return <div className="shell page" style={{maxWidth:1140}}>
  <a href="#/ecossistema" className="btn btn-ghost btn-sm">← Ecossistema</a>
  <header style={{margin:'24px 0'}}><span className="label">S18 · Estúdio pessoal · Conteúdo não homologado</span><h1 className="display-lg" style={{marginTop:12}}>{metadata.name}</h1><p className="lede" style={{marginTop:12}}>{metadata.description}</p></header>
  <div className="card" role="note" style={{padding:20,borderColor:'var(--line-brass)',marginBottom:24}}>
   <strong>Uso exclusivamente didático.</strong> Nenhuma referência declarada foi consultada ou validada pelo aplicativo. Nenhum resultado é norma, parecer, laudo, demonstração oficial ou evidência de auditoria. As fichas ficam somente na memória desta aba e desaparecem ao recarregar. Exporte-as para conservar o trabalho.
  </div>
  <div className="row wrap" style={{gap:10,marginBottom:24}}>
   {WORKBENCH_IDS.map(id=><a key={id} className={'btn btn-sm '+(domain===id?'btn-brass':'btn-ghost')} href={'#/modulo/'+id}>{WORKBENCH_CONFIG[id].name.split(' — ')[0]}</a>)}
  </div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:22,alignItems:'start'}}>
   <form onSubmit={submit} className="card stack" style={{gap:16,padding:24}} aria-label="Editor de ficha de estudo">
    <h2 className="label-sm">{editing===null?'Nova ficha pessoal':'Editar ficha #'+editing} · {summary.total}/25</h2>
    <label className="stack" style={{gap:7}}>Título (3–120 caracteres)<input required minLength={3} maxLength={120} style={fieldStyle} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    {metadata.fields.map((label,i)=><label key={label} className="stack" style={{gap:7}}>{label} {i!==2&&'(obrigatório)'}<textarea required={i!==2} rows={i===2?3:4} maxLength={900} placeholder={metadata.prompts[i]} style={{...fieldStyle,resize:'vertical'}} value={parts[i]} onChange={e=>changePart(i,e.target.value)}/></label>)}
    <label className="stack" style={{gap:7}}>Fonte declarada por você (opcional e não verificada)<textarea rows={2} maxLength={400} style={fieldStyle} placeholder="Identifique o documento e a edição que você pretende conferir" value={source} onChange={e=>setSource(e.target.value)}/></label>
    <p className="xs">{source.trim()?'Referência declarada, mas não verificada.':'Sem fonte: HOLD_SOURCE. A ficha não constitui conteúdo aprovado.'}</p>
    <div className="row wrap" style={{gap:10}}><button type="submit" className="btn btn-brass">{editing===null?'Adicionar ficha':'Salvar alteração'}</button><button type="button" onClick={reset} className="btn btn-ghost btn-sm">Limpar</button></div>
    {error&&<p role="alert" className="xs" style={{overflowWrap:'anywhere'}}>{error}</p>}
   </form>
   <section className="card" style={{padding:24}} aria-live="polite">
    <div className="row wrap" style={{justifyContent:'space-between',gap:12,alignItems:'center'}}><span className="label-sm">Fichas nesta sessão</span><a className="btn btn-ghost btn-sm" download={'canone-'+domain+'-s18-autoral.json'} href={downloadable}>Exportar JSON</a></div>
    <div className="row wrap" style={{gap:9,margin:'16px 0'}}><span className="xs">{summary.total} fichas</span><span className="xs">· {summary.missing} sem fonte</span><span className="xs">· {summary.declared} fontes declaradas</span><span className="xs">· 0 homologadas</span></div>
    <label className="stack" style={{gap:6}}>Pesquisar nesta sessão<input type="search" style={fieldStyle} value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <div className="stack" style={{gap:14,marginTop:20}}>
     {!records.length&&<p className="body">Nenhuma ficha encontrada. Crie uma ficha pessoal para começar.</p>}
     {records.map((item)=><article className="card card-flat" key={item.id} style={{padding:18}}>
      <div className="row wrap" style={{justifyContent:'space-between',gap:10,alignItems:'center'}}><h3 style={{overflowWrap:'anywhere'}}>{item.title}</h3><span className="xs">{gateForSource(item.source)==='HOLD_SOURCE'?'HOLD_SOURCE':'FONTE DECLARADA · NÃO VERIFICADA'}</span></div>
      <div className="stack" style={{gap:12,marginTop:18}}>{metadata.fields.map((label,index)=><div key={label}><span className="label-sm">{label}</span><p className="body" style={{whiteSpace:'pre-wrap',marginTop:6,overflowWrap:'anywhere'}}>{item.fields[index]||'Não informado'}</p></div>)}</div>
      {item.source&&<p className="xs" style={{marginTop:14,overflowWrap:'anywhere'}}>Referência informada pelo usuário: {item.source}</p>}
      <div className="row wrap" style={{gap:10,marginTop:20}}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>edit(item)}>Editar</button><button type="button" className="btn btn-ghost btn-sm" onClick={()=>erase(item)}>Excluir</button></div>
     </article>)}
    </div>
   </section>
  </div>
  <p className="xs" style={{marginTop:28}}>A homologação humana de textos normativos, a proveniência documental original, o controle de versões e a aprovação de conteúdo continuam fora desta prévia.</p>
 </div>;
}
