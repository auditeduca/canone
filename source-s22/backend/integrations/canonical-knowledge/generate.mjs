#!/usr/bin/env node
// Accept only pre-preserved, atomized corpus; auto-derive all read models and block drift.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deriveArtifacts,validateEvidenceGraph} from './engine.mjs';
const root=dirname(fileURLToPath(import.meta.url)),arg=new Set(process.argv.slice(2));
if(!arg.has('--write')&&!arg.has('--check')){console.log('DRY_RUN: use --write or --check');process.exit(0);}
if(arg.has('--write')&&arg.has('--check'))throw Error('Choose --write OR --check');
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const graph=await read('graph.v1.json'),contract=await read('contract.v1.json');
const outputs=deriveArtifacts(graph,contract),dest=join(root,'generated');
await mkdir(dest,{recursive:true});const drift=[];
for(const [name,data] of Object.entries(outputs)){
  const path=join(dest,name);
  if(arg.has('--check')&&(await readFile(path,'utf8').catch(()=>null))!==data)drift.push(name);
  if(arg.has('--write'))await writeFile(path,data,'utf8');
}
if(drift.length){console.error('BLOCK_CANONICAL_DRIFT '+drift.join(','));process.exit(4);}
if(arg.has('--strict-release')){const report=validateEvidenceGraph(graph,contract);if(report.release_gate!=='ELIGIBLE_FOR_EXTERNAL_APPROVAL'){console.error('BLOCK_CANONICAL_RELEASE '+report.release_gate);process.exit(5);}}
console.log(JSON.stringify({gate:arg.has('--check')?'PASS_NO_DRIFT':'GENERATED',files:Object.keys(outputs).length,scope:graph.corpus_status,production:'HOLD_HUMAN'}));
