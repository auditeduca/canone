// Compara as duas cópias do catálogo CFC; não decide qual versão é verdadeira.
export function reconcileRegulatory(masterRows, publicRows) {
  const index = rows => {
    const result=new Map();
    for (const row of rows) {
      const key=row.instrument_id;
      if(typeof key!=='string'||!key)throw new Error('MISSING_INSTRUMENT_ID');
      if(result.has(key))throw new Error(`DUPLICATE_INSTRUMENT_ID ${key}`);
      result.set(key,row);
    }
    return result;
  };
  const master=index(masterRows), publicCatalog=index(publicRows);
  const issues=[];
  let common=0;
  for (const [id,a] of master) {
    const b=publicCatalog.get(id);
    if(!b) {issues.push({id,type:'MASTER_ONLY',gate:'RECONCILE'});continue;}
    common++;
    if(String(a.canonical_status??'')!==String(b.canonical_status??''))
      issues.push({id,type:'STATUS_CONFLICT',gate:'HOLD_HUMAN'});
    if(String(a.title??'')!==String(b.title??''))
      issues.push({id,type:'TITLE_CONFLICT',gate:'HOLD_HUMAN'});
  }
  for(const id of publicCatalog.keys()) if(!master.has(id))issues.push({id,type:'PUBLIC_ONLY',gate:'HOLD_HUMAN'});
  return {master_rows:master.size,public_rows:publicCatalog.size,common,
    public_only:issues.filter(x=>x.type==='PUBLIC_ONLY').length,
    master_only:issues.filter(x=>x.type==='MASTER_ONLY').length,
    conflicts:issues.filter(x=>x.type==='STATUS_CONFLICT'||x.type==='TITLE_CONFLICT').length,
    issues,auto_promoted:0};
}
