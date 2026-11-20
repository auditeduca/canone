#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {collectSenado,verifySenadoArchive,PRIVATE_SENADO_DIR} from './client.mjs';

const catalog=JSON.parse(await readFile(fileURLToPath(new URL('./catalog.v1.json',import.meta.url)),'utf8'));
const execute=process.argv.includes('--execute');
const chosen=process.argv.find(a=>a.startsWith('--source='));
const requestedKeys=chosen?[chosen.slice('--source='.length)]:undefined;
const out=PRIVATE_SENADO_DIR;
try {
  const report=process.argv.includes('--verify')?await verifySenadoArchive(catalog,{dir:out}):await collectSenado(catalog,{execute,dir:out,requestedKeys});
  // The CLI prints only non-copyrighted metadata and does not leak the full API payload.
  console.log(JSON.stringify(report,null,2));
} catch(e) {
  console.error(JSON.stringify({state:process.argv.includes('--verify')?'HOLD_ARCHIVE':'HOLD_API',reason:String(e.message),publication_eligible:false}));
  process.exitCode=2;
}
