#!/usr/bin/env node
// Recupera conteúdo privado, comprovando os 3 SHA-256 em sequência. Não publica.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,inspectTriadIndex,archiveVerifiedTriad,makePrivateStorageFetcher,indexSchema} from './storage-triad.mjs';
import {selectPilotRows,verifyPilotArchives,pilotPlan,checkSourceIndex} from './pilot-gate.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2),arg=k=>{const n=args.indexOf(k);return n<0?null:args[n+1]};
const execute=args.includes('--execute');
if(!execute){console.log('DRY_RUN: --execute --index <private-index.json> [--limit 1..5 | --all (requires verified pilot)]');process.exit(0);}
if(!arg('--index'))throw Error('INDEX_REQUIRED');
const index=JSON.parse(await readFile(arg('--index'),'utf8'));
checkSourceIndex(index,{expectedCount:249});
const all=args.includes('--all');
const limit=all?index.rows.length:Number(arg('--limit')||'5');
if(!Number.isSafeInteger(limit)||limit<1||(!all && limit>5)||limit>index.rows.length)
  throw Error('PILOT_LIMIT_INVALID__ALL_REQUIRES_ATTESTATION');
const fetchObject=makePrivateStorageFetcher({projectRef:index.source_project_ref,
 apiKey:process.env.CANONE_SOURCE_STORAGE_API_KEY,accessToken:process.env.CANONE_SOURCE_STORAGE_READ_TOKEN});
const root=resolve(process.env.CANONE_PRIVATE_ARCHIVE_DIR||join(here,'../../.local-bridge/recovered'));
await mkdir(root,{recursive:true,mode:0o700});
if(all)await verifyPilotArchives(index,root,{size:5,expectedCount:249});
const selected=all?index.rows:selectPilotRows(index.rows,{size:limit});
const results=[];
for(const row of selected){
 try{
  const v=await archiveVerifiedTriad(row,{fetchObject,root});
  results.push({instrument_id:row.instrument_id,status:'BYTES_VERIFIED__HOLD_HUMAN',hashes:v.artifacts.map(a=>a.sha256)});
 }catch(e){results.push({instrument_id:row.instrument_id,status:'BLOCKED',code:String(e.message).slice(0,100)});}
}
const completed=results.filter(r=>r.status==='BYTES_VERIFIED__HOLD_HUMAN').length;
const summary={schema:'canone.storage-recovery.v2',source_project_ref:index.source_project_ref,source_index_sha256:index.index_sha256,total_in_index:index.rows.length,
 attempted:limit,byte_verified:completed,blocked:limit-completed,rights_approved:0,semantic_claims_approved:0,
 release_gate:'HOLD_HUMAN',results};
await writeFile(join(root,'last-run.private.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
if(!all && completed===5){
 const attestation=await verifyPilotArchives(index,root,{size:5,expectedCount:249});
 await writeFile(join(root,'pilot-attestation.private.json'),JSON.stringify(attestation,null,2)+'\n',{mode:0o600});
}
console.log(JSON.stringify({attempted:limit,byte_verified:completed,blocked:limit-completed,release_gate:'HOLD_HUMAN'}));
if(completed!==limit)process.exitCode=3;
else process.exitCode=4; // mesmo sucesso de bytes não autoriza publicar
