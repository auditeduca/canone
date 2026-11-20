#!/usr/bin/env node
/* S11: 30 migrations, same authority and lexer as S7; REVIEW-ONLY artifacts.
 * No database connection, no DDL, no grant, no migration promotion.
 */
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {scanSql, rewriteQualifiedIdentifiers, reviewOriginalSql} from './port-sql.mjs';
const HERE=dirname(fileURLToPath(import.meta.url));
const MIG=resolve(HERE,'../migrations');
const GENERATED=resolve(HERE,'generated/s11-review-only');
const SHA=s=>createHash('sha256').update(s).digest('hex');
const assert=(test,msg)=>{if(!test)throw Error('S11_HOLD: '+msg);};
const reg=/\b(identity|editorial|taxonomy|norms|learning|commerce|admin|ops|audit|public|subscriber|evidence|bridge|control)\s*\./gi;
const patterns=[
 [/\bCREATE\s+EXTENSION\b/i,'EXTENSION_GLOBAL'],
 [/\bCREATE\s+(?:ROLE|USER)\b/i,'CREATE_ROLE_GLOBAL'],
 [/\bALTER\s+ROLE\b/i,'ALTER_ROLE_GLOBAL'],
 [/\b(?:GRANT|REVOKE)\b/i,'GRANT_OR_REVOKE_REVIEW'],
 [/\bSECURITY\s+DEFINER\b/i,'SECURITY_DEFINER_REVIEW'],
 [/\bSET\s+(?:LOCAL\s+)?(?:search_path|ROLE)\b/i,'SEARCH_PATH_OR_ROLE_REVIEW'],
 [/\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+(?:TABLE|VIEW|SCHEMA)\s+(?:public|auth|storage|contabilidade_cfc|ce_platform)\b/i,'SHARED_OR_EXTERNAL_DDL'],
 [/\bEXECUTE\b/i,'DYNAMIC_SQL_REVIEW'],
 [/\b(?:ALTER\s+OWNER|OWNER\s+TO)\b/i,'OWNER_REVIEW']
];

export function generateS11({write=false}={}){
 const manifest=JSON.parse(readFileSync(join(HERE,'S5_NAMESPACE_MANIFEST.json'),'utf8'));
 const map=Object.fromEntries(manifest.schemas.map(s=>[s.old,s.new]));
 assert(Object.keys(map).length===14,'14 canonical namespaces required');
 assert(manifest.target_project_id==='pgsybzggewhinaniybiy','target changed');
 const files=readdirSync(MIG).filter(x=>/^\d{3}_[a-z0-9_]+\.sql$/.test(x)).sort();
 assert(files.length===30 && manifest.original_migrations.length===30,'30-source parity');
 const report=[];const written=[];
 for(let i=0;i<files.length;i++){
  const file=files[i], raw=readFileSync(join(MIG,file),'utf8'),expected=manifest.original_migrations[i];
  assert(file===expected.file && SHA(raw)===expected.sha256,'original source collision '+file);
  const seg=scanSql(raw);
  const originalCode=seg.filter(x=>x.type==='code').map(x=>x.value).join(' ');
  const translated=rewriteQualifiedIdentifiers(raw,map);
  assert(SHA(raw)===expected.sha256,'source mutation '+file);
  const hazards=new Set();
  for(const [re,key] of patterns)if(re.test(originalCode))hazards.add(key);
  const delimited=seg.filter(x=>x.type==='dollar'||x.type==='identifier');
  if(delimited.length){hazards.add('NON_CODE_SQL_BODY_NEEDS_SEMANTIC_PORT');if(delimited.some(x=>{reg.lastIndex=0;return reg.test(x.value)}))hazards.add('UNMAPPED_DOMAIN_IN_PROCEDURAL_BODY');}
  if(file.startsWith('001_'))hazards.add('GLOBAL_BOOTSTRAP_NOT_PORTED');
  if(i>0)hazards.add('DEPENDENCY_ON_GLOBAL_ROLE_EXTENSION_BOOTSTRAP');
  if(i>=5)hazards.add('DEPENDENCY_GRAPH_NOT_HOMOLOGATED');
  if(/\bcitext\b/i.test(originalCode))hazards.add('CITEXT_EXTENSION_REQUIRED');
  const rewrittenCode=scanSql(translated).filter(x=>x.type==='code').map(x=>x.value).join(' ');
  reg.lastIndex=0;if(reg.test(rewrittenCode))hazards.add('UNMAPPED_QUALIFIED_IDENTIFIER');
  const already=reviewOriginalSql(file,raw,map);
  for(const item of already.hazards)hazards.add(item);
  const candidate=i>=1&&i<=4;// 002-005, limited isolated QA only
  const kind=i===0?'BOOTSTRAP_HOLD':candidate?'PGLITE_QA_CANDIDATE':'REVIEW_REQUIRED';
  const filename=`REVIEW_ONLY_${file}.txt`;
  const content=[
    '-- GENERATED FOR AUDIT ONLY; NEVER EXECUTE IN SHARED HOST OR MIGRATION RUNNER.',
    `-- Authority: backend/db/migrations/${file}`,
    `-- Original sha256: ${SHA(raw)}`,
    '-- S11 status: HOLD_HUMAN_NO_GO; QA subset 002..005 runs ONLY in disposable PGlite.',
    `-- Hazards: ${[...hazards].sort().join(' | ') || 'DEPENDENCY_REVIEW_REQUIRED'}`,
    '',i===0?'-- Original bootstrap not safe to port automatically; source shown for review.':'-- Qualified schema name projection (procedural/dynamic bodies NOT rewritten).','',
    i===0?raw:translated
  ].join('\n');
  written.push({file:filename,content});
  report.push({sequence:i+1,file,originalSha256:SHA(raw),candidateSha256:SHA(content),kind,hazards:[...hazards].sort(),hasSqlBody:seg.some(x=>x.type==='dollar'),isolationQaCandidate:candidate,liveExecuteAllowed:false,protection:'HOLD_HUMAN_NO_GO'});
 }
 const summary={version:'canone.s11.shared-host.30-migrations.review.v1',source:'backend/db/migrations/',targetProject:manifest.target_project_id,sourceMigrationCount:30,reviewArtifacts:30,isolatedQaCandidateCount:report.filter(x=>x.isolationQaCandidate).length,liveExecutableCount:0,sharedDatabaseTouched:false,productionGate:'HOLD_HUMAN_NO_GO',hazardMigrations:report.filter(x=>x.hazards.length).length,report};
 written.push({file:'S11_FULL_PORTABILITY_AUDIT.json',content:JSON.stringify(summary,null,2)+'\n'});
 if(write)mkdirSync(GENERATED,{recursive:true});
 for(const x of written){const path=join(GENERATED,x.file);if(write)writeFileSync(path,x.content);else assert(readFileSync(path,'utf8')===x.content,'generated drift '+x.file);}
 return summary;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=generateS11({write:process.argv.includes('--write')});console.log(`S11_REVIEW_PASS migrations=${r.sourceMigrationCount} QA_candidates=${r.isolatedQaCandidateCount} executable_live=${r.liveExecutableCount}`)}catch(e){console.error(e.message);process.exitCode=5}
}
