/** Cânone S5: non-destructive inventory of migration portability hazards. */
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../migrations');
const schemas=['identity','editorial','taxonomy','norms','learning','commerce','admin','ops','audit','subscriber','public'];
const files=readdirSync(root).filter(f=>/^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
const flagged=files.map(file=>{
 const source=readFileSync(resolve(root,file),'utf8');
 const hazards={
  schemaReferences:Object.fromEntries(schemas.map(k=>[k,(source.match(new RegExp('\\b'+k+'\\.', 'g'))||[]).length]).filter(([,n])=>n>0)),
  publicSchemaViews:/\b(?:CREATE(?:\s+OR\s+REPLACE)?\s+VIEW|GRANT|REVOKE)\s+[^;]*\bpublic\./i.test(source),
  roleDDL:/\b(?:CREATE\s+ROLE|GRANT\s+canone_|ALTER\s+ROLE)\b/i.test(source),
  extensionDDL:/\bCREATE\s+EXTENSION\b/i.test(source),
  privilegedFunction:/\bSECURITY\s+DEFINER\b/i.test(source),
  hardcodedSearchPath:/\b(?:SET\s+search_path|set_config\s*\(\s*'search_path')/i.test(source),
  dynamicSQL:/\bEXECUTE\s+(?:format\s*\(|')/i.test(source),
  existingGlobalSchemaChange:/\bALTER\s+(?:TABLE|SCHEMA)\s+public\./i.test(source),
 };
 return {file,sha256:createHash('sha256').update(source).digest('hex'),portStatus:'HOLD_PORT_AND_REVIEW',hazards};
});
if(files.length!==30)throw Error('Expected 30 original migrations, got '+files.length);
const totals=Object.fromEntries(Object.keys(flagged[0].hazards).filter(x=>x!=='schemaReferences').map(k=>[k,flagged.filter(x=>x.hazards[k]).length]));
const result={version:'S5',isolationTarget:'pgsybzggewhinaniybiy',checked:files.length,readyToApply:0,blockedToPort:files.length,totals,files:flagged};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
