#!/usr/bin/env node
// Operação explícita: sem --live não usa rede; sem --write não altera artefatos.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildArtifacts,readInputs,stable} from './engine.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const args=new Set(process.argv.slice(2));
const snapshotFile=path.join(root,'snapshots','supabase-audit-educa-observed.v1.json');
const output=path.join(root,'generated');
const live=args.has('--live');
const write=args.has('--write');
const check=args.has('--check');
if(write&&check)throw Error('Selecione --write OU --check');
if(live&&write&&!args.has('--approve-snapshot-refresh'))throw Error('HOLD_HUMAN: --live --write exige --approve-snapshot-refresh; não é promoção de dados');
if(!write&&!check){console.log('DRY_RUN; use --check ou --write. --live compara catálogo remoto em READ_ONLY.');process.exit(0);}
let inputs=readInputs(root,snapshotFile);
if(live){
  // A biblioteca pg-structure é plugável. Dados lidos por introspecção; NÃO lê linhas de aluno.
  // Instalar apenas em job aprovado e usar usuário PostgreSQL limitado a SELECT de catálogo.
  const connectionString=process.env.CANONE_SOURCE_DATABASE_URL;
  if(!connectionString)throw Error('HOLD: CANONE_SOURCE_DATABASE_URL ausente');
  if(!connectionString.includes(inputs.snapshot.project_ref))throw Error('HOLD: projeto origem não confere');
  let pgStructure;
  try{({default:pgStructure}=await import('pg-structure'));}catch{throw Error('Dependência pg-structure@7.15.3 não instalada. Instale no job introspector isolado.');}
  const url=new URL(connectionString);
  const db=await pgStructure({host:url.hostname,port:Number(url.port||5432),database:decodeURIComponent(url.pathname.slice(1)),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true}}, {includeSchemas:['account_palm','contabilidade_cfc','public','cko_master','cko_governance']});
  const requested=new Set(inputs.snapshot.tables.map(t=>t.id));
  const liveTables=[];const fks=[];
  const liveEntities=['account_palm','contabilidade_cfc','public','cko_master','cko_governance']
    .flatMap(name=>{const schema=db.schemas.get(name);return schema?[...schema.tables.map(table=>({table,kind:'TABLE'})),...schema.views.map(table=>({table,kind:'VIEW'}))]:[];});
  for(const {table,kind:actualKind} of liveEntities){
    const id=`${table.schema.name}.${table.name}`;
    if(!requested.has(id))continue;
    const kind=inputs.snapshot.tables.find(t=>t.id===id)?.object_kind;
    if(kind!==actualKind)throw Error(`BLOCKED_OBJECT_KIND_DRIFT ${id}: expected ${kind}, actual ${actualKind}`);
    const original=inputs.snapshot.tables.find(t=>t.id===id);
    liveTables.push({id,schema:table.schema.name,name:table.name,row_count:null,object_kind:actualKind,
      view_base:original.view_base,view_security_invoker:original.view_security_invoker,logical_identity:original.logical_identity||[],
      primary_key:actualKind==='VIEW'?[]:table.primaryKey?.columns?.map(c=>c.name)??[],
      columns:table.columns.map(c=>({name:c.name,type:c.type.name,nullable:!c.notNull,comment:c.comment??''})),
      introspection_level:'live_pg_structure'});
    for(const fk of table.foreignKeys||[]){
      if(!['account_palm','contabilidade_cfc'].includes(table.schema.name))continue;
      fks.push({id:`${id}.${fk.name}`,kind:'FOREIGN_KEY',from:id,from_columns:fk.columns.map(c=>c.name),to:`${fk.referencedTable.schema.name}.${fk.referencedTable.name}`,to_columns:fk.referencedColumns.map(c=>c.name),validated:true});
    }
  }
  const physicalSnapshot=inputs.snapshot.relationships.filter(r=>r.kind==='FOREIGN_KEY');
  const expectedSet=new Set(physicalSnapshot.map(r=>`${r.from}(${r.from_columns})=>${r.to}(${r.to_columns})`));
  const actualSet=new Set(fks.map(r=>`${r.from}(${r.from_columns})=>${r.to}(${r.to_columns})`));
  const missing=[...expectedSet].filter(x=>!actualSet.has(x));
  const added=[...actualSet].filter(x=>!expectedSet.has(x));
  if(missing.length||added.length){
    console.error(JSON.stringify({status:'BLOCKED_SCHEMA_DRIFT',missing,added},null,2));process.exit(3);
  }
  const current=new Map(liveTables.map(t=>[t.id,t]));
  const missingTables=[...requested].filter(id=>!current.has(id));
  if(missingTables.length){console.error('BLOCKED_MISSING_TABLES:',missingTables.join(','));process.exit(3);}
  for(const t of inputs.snapshot.tables){
    // Tabelas observadas parcialmente ganham campos reais da biblioteca.
    // Comparação de colunas previamente observadas bloqueia remoção.
    const live=current.get(t.id);
    for(const col of t.columns)if(!live.columns.some(c=>c.name===col.name))throw Error(`BLOCKED_REMOVED_COLUMN ${t.id}.${col.name}`);
    if(t.primary_key?.length && JSON.stringify(t.primary_key)!==JSON.stringify(live.primary_key))throw Error(`BLOCKED_PK_DRIFT ${t.id}`);
    if(t.introspection_level==='live_pg_structure' && JSON.stringify(t.columns.map(c=>[c.name,c.type,c.nullable]))!==JSON.stringify(live.columns.map(c=>[c.name,c.type,c.nullable])))throw Error(`BLOCKED_COLUMN_DRIFT ${t.id}`);
  }
  // A lib de modelo não substitui a auditoria de privilégio/view no catálogo.
  // Segunda conferência READ_ONLY com driver pg para convalidated e reloptions.
  const {Client}=await import('pg');
  const client=new Client({connectionString,application_name:'canone-metadata-readonly'});
  await client.connect();
  try{
    await client.query('BEGIN TRANSACTION READ ONLY');
    const checkViews=await client.query(`
      SELECT n.nspname || '.' || c.relname AS id,
             COALESCE('security_invoker=true' = ANY(c.reloptions),false) AS security_invoker,
             pg_get_viewdef(c.oid,true) AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='v' AND n.nspname='account_palm'
    `);
    const observedViews=new Map(checkViews.rows.map(row=>[row.id,row]));
    for(const view of inputs.snapshot.tables.filter(t=>t.object_kind==='VIEW')) {
      const row=observedViews.get(view.id);
      if(!row||row.security_invoker!==true)throw Error(`BLOCKED_VIEW_SECURITY_INVOKER ${view.id}`);
      const baseName=view.view_base.split('.').at(-1);
      if(!row.definition.includes(baseName))throw Error(`BLOCKED_VIEW_BASE_DRIFT ${view.id}`);
    }
    const unvalidated=await client.query(`
      SELECT n.nspname || '.' || c.relname || ':' || con.conname AS identifier
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE con.contype='f' AND n.nspname IN ('account_palm','contabilidade_cfc')
        AND con.convalidated IS NOT TRUE
    `);
    if(unvalidated.rows.length)throw Error('BLOCKED_UNVALIDATED_FK '+unvalidated.rows.map(row=>row.identifier).join(','));
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
  finally{await client.end().catch(()=>{});}
  // Em modo --check compara o catálogo vivo com a baseline sem reescrever a baseline:
  // artefatos gerados são comparados ao snapshot versionado (idênticos byte a byte).
  // Em --write --approve-snapshot-refresh um PR aprova o novo catálogo completo.
  if(write){
    inputs={...inputs,snapshot:{...inputs.snapshot,scope:'LIVE_PHYSICAL_METADATA_ONLY',tables:liveTables,relationships:[...fks,...inputs.snapshot.relationships.filter(r=>r.kind!=='FOREIGN_KEY')]}};
  }
}
const files=buildArtifacts(inputs.snapshot,inputs.contract,inputs.targetTables);
await mkdir(output,{recursive:true});
let drift=[];
for(const [name,body] of Object.entries(files)) {
  const filepath=path.join(output,name);
  if(check){const existing=await readFile(filepath,'utf8').catch(()=>null);if(existing!==body)drift.push(name);}
  if(write)await writeFile(filepath,body);
}
if(check&&drift.length){console.error('BLOCKED_METADATA_DRIFT:',drift.join(', '));process.exit(4);}
if(write&&live)await writeFile(snapshotFile,stable(inputs.snapshot));
console.log(JSON.stringify({status:check?'PASS_NO_DRIFT':'GENERATED',mode:live?'LIVE_INTROSPECTION':'RECORDED_OBSERVATION',artifacts:Object.keys(files).length,foreign_keys:inputs.snapshot.relationships.filter(r=>r.kind==='FOREIGN_KEY').length,release:'HOLD_HUMAN'}));
