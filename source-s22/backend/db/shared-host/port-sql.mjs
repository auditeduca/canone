#!/usr/bin/env node
/*
 * Cânone S7 — qualified identifier projection from the OWNED migration files.
 * No SQL is executed. The output is NON-EXECUTABLE REVIEW MATERIAL until
 * the dependency graph, postgres tests and human review are complete.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = resolve(here, '../migrations');
const manifest = JSON.parse(readFileSync(resolve(here, 'S5_NAMESPACE_MANIFEST.json'), 'utf8'));
const target = resolve(here, 'generated');
const OUTPUT_VERSION = 'canone.s7.sql-port-review.v1';
const sha = x => createHash('sha256').update(x).digest('hex');
const assert = (x, message) => { if (!x) throw Error('BLOCK_SQL_PORT: ' + message); };

export function scanSql(text) {
  const out=[]; let i=0, codeStart=0;
  function flush(end){if(end>codeStart) out.push({type:'code',value:text.slice(codeStart,end)});}
  function emit(type,start,end){flush(start);out.push({type,value:text.slice(start,end)});i=end;codeStart=end;}
  while(i<text.length){
    if(text.startsWith('--',i)) { const next=text.indexOf('\n',i+2);emit('comment',i,next<0?text.length:next+1);continue; }
    if(text.startsWith('/*',i)) {
      let depth=1,j=i+2;
      while(j<text.length && depth>0){if(text.startsWith('/*',j)){depth++;j+=2;}else if(text.startsWith('*/',j)){depth--;j+=2;}else j++;}
      assert(depth===0,'unterminated comment');emit('comment',i,j);continue;
    }
    if(text[i]==="'"){
      let j=i+1,done=false;
      while(j<text.length){if(text[j]==="'"){if(text[j+1]==="'"){j+=2;continue;}j++;done=true;break;}j++;}
      assert(done,'unterminated string literal');emit('string',i,j);continue;
    }
    if(text[i]==='"'){
      let j=i+1,done=false;
      while(j<text.length){if(text[j]==='"'){if(text[j+1]==='"'){j+=2;continue;}j++;done=true;break;}j++;}
      assert(done,'unterminated quoted identifier');emit('identifier',i,j);continue;
    }
    if(text[i]==='$'){
      const match=/^\$([A-Za-z_][A-Za-z_0-9]*|)\$/.exec(text.slice(i));
      if(match){const end=text.indexOf(match[0],i+match[0].length);assert(end!==-1,'unterminated dollar quote');emit('dollar',i,end+match[0].length);continue;}
    }
    i++;
  }
  flush(text.length);
  assert(out.map(x=>x.value).join('')===text,'scanner did not roundtrip');
  return out;
}

export function rewriteQualifiedIdentifiers(text,map){
  const parts=scanSql(text);const names=Object.keys(map);
  assert(names.length>0,'empty mapping');
  const qualifier = new RegExp('\\b('+names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?=\\s*\\.)','g');
  const result=parts.map(part=>part.type==='code'?part.value.replace(qualifier,(n)=>map[n]):part.value).join('');
  assert(scanSql(result).map(x=>x.type).join('|')===parts.map(x=>x.type).join('|'),'token classes changed');
  return result;
}

export function reviewOriginalSql(file, text, map) {
  const seg=scanSql(text),plain=seg.filter(x=>x.type==='code').map(x=>x.value).join(' ');
  const hazards=[];
  const check=(re,key)=>{if(re.test(plain))hazards.push(key);};
  check(/\bCREATE\s+EXTENSION\b/i,'EXTENSION_GLOBAL');
  check(/\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i,'ROLE_GLOBAL');
  check(/\b(?:GRANT|REVOKE)\b/i,'ROLE_GRANTS_NEED_REVIEW');
  check(/\bSECURITY\s+DEFINER\b/i,'PRIVILEGED_FUNCTION');
  check(/\bSET\s+search_path\b/i,'SEARCH_PATH');
  check(/\bcitext\b/i,'CITEXT_EXTENSION_UNAVAILABLE');
  check(/\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|VIEW|SCHEMA)\s+(?:public|auth|storage|ce_platform|contabilidade_cfc)\b/i,'OTHER_DOMAIN_DDL');
  if(seg.some(x=>x.type==='dollar'))hazards.push('DOLLAR_BODY_NOT_LEXICALLY_PORTED');
  if(seg.some(x=>x.type==='identifier'))hazards.push('QUOTED_IDENTIFIER_REVIEW');
  if(/\bEXECUTE\b/i.test(plain))hazards.push('DYNAMIC_SQL_REVIEW');
  if(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i.test(plain))hazards.push('FUNCTION_SECURITY_REVIEW');
  // There must be no unqualified global public or extension DDL in a shared host.
  const rewritten=rewriteQualifiedIdentifiers(text,map);
  const identifiers=scanSql(rewritten).filter(x=>x.type==='code').map(x=>x.value).join(' ');
  const qualified=[...identifiers.matchAll(/\b(canone_[a-z_]+)\s*\./g)].map(x=>x[1]);
  const unported=[...identifiers.matchAll(/\b(identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit|public|subscriber|evidence|bridge|control)\s*\./g)];
  if(unported.length) hazards.push('UNPORTABLE_QUALIFIED_DOMAIN');
  const approved=new Set(Object.values(map));
  if(qualified.some(x=>!approved.has(x)))hazards.push('UNKNOWN_PREFIX');
  return {file,sourceSha256:sha(text),outputSha256:sha(rewritten),hazards:[...new Set(hazards)].sort(),rewritten};
}

export function generatePortReview({base=here, write=false}={}){
  const localManifest=JSON.parse(readFileSync(resolve(base,'S5_NAMESPACE_MANIFEST.json'),'utf8'));
  const map=Object.fromEntries(localManifest.schemas.map(x=>[x.old,x.new]));
  assert(localManifest.target_project_id==='pgsybzggewhinaniybiy','unexpected project');
  assert(Object.keys(map).length===14,'schema map drift');
  const review=[];const outputs=[];
  for(const item of localManifest.original_migrations){
    // S7 focuses on the first baseline and learning vertical; 008-030 remain untouched.
    if(Number(item.file.slice(0,3))<2||Number(item.file.slice(0,3))>7)continue;
    const text=readFileSync(resolve(base,'../migrations',item.file),'utf8');
    assert(sha(text)===item.sha256,'source checksum changed: '+item.file);
    const row=reviewOriginalSql(item.file,text,map);
    // Dependence on 001 global roles + extension setup cannot be silently dropped.
    row.hazards.push('MIGRATION_001_ROLES_EXTENSION_DEPENDENCY');
    row.hazards=[...new Set(row.hazards)].sort();
    const filename='REVIEW_ONLY_'+item.file;
    const contents=`-- GENERATED REVIEW ONLY. DO NOT EXECUTE ON SHARED SUPABASE.\n-- Source ${item.file} sha256 ${row.sourceSha256}\n-- Status HOLD_HUMAN_NO_GO, blocked hazards: ${row.hazards.join(' | ')}\n${row.rewritten}`;
    outputs.push({name:filename,content:contents});
    review.push({file:item.file,sourceSha256:row.sourceSha256,portSha256:sha(contents),hazards:row.hazards,domainRefs:[...new Set([...row.rewritten.matchAll(/\bcanone_[a-z_]+(?=\s*\.)/g)].map(x=>x[0]))].sort(),state:'HOLD_PORT_REVIEW',executeAllowed:false});
  }
  assert(review.length===6,'expected migrations 002-007');
  const report={version:OUTPUT_VERSION,project:localManifest.target_project_id,originalAuthority:'backend/db/migrations/',portAuthority:'backend/db/shared-host/port-sql.mjs',count:review.length,executableCount:0,release:'HOLD_HUMAN_NO_GO',migrations:review};
  outputs.push({name:'port-review.generated.json',content:JSON.stringify(report,null,2)+'\n'});
  if(write){mkdirSync(resolve(base,'generated'),{recursive:true});for(const o of outputs)writeFileSync(resolve(base,'generated',o.name),o.content);}
  else for(const o of outputs){const f=resolve(base,'generated',o.name);assert(readFileSync(f,'utf8')===o.content,'drift '+o.name);}
  return report;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const mode=process.argv.includes('--write');const r=generatePortReview({write:mode});console.log(`PASS_S7_SQL_PORT_${mode?'WRITE':'CHECK'} source=${r.count} executable=${r.executableCount} gate=${r.release}`);}
  catch(e){console.error(e.message);process.exitCode=4;}
}
