#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectReadiness,buildEvidenceQueue} from './readiness.mjs';
const args=process.argv.slice(2),arg=key=>{const n=args.indexOf(key);return n<0?undefined:args[n+1]};
if(!args.includes('--execute')){console.log('DRY_RUN: use --execute --input <private-candidates.ndjson> [--report path]');process.exit(0);}
if(!arg('--input'))throw Error('SOURCE_INPUT_REQUIRED');
const raw=await readFile(arg('--input'),'utf8');
const candidates=raw.trim()?raw.trim().split(/\r?\n/).map(JSON.parse):[];
const r=inspectReadiness(candidates);
if(arg('--report'))await writeFile(arg('--report'),JSON.stringify({readiness:r,queue:buildEvidenceQueue(candidates)},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(r,null,2));
if(r.integrity_gate==='FAIL')process.exitCode=3;
else if(args.includes('--strict-release'))process.exitCode=4;
