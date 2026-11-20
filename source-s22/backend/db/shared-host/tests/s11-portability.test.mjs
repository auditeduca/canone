import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateS11} from '../s11-review-all.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(here,'../generated/s11-review-only');
test('S11: 30 original sources audited with no drift, 4 isolated candidates',()=>{
 const r=generateS11();assert.equal(r.sourceMigrationCount,30);assert.equal(r.reviewArtifacts,30);assert.equal(r.liveExecutableCount,0);assert.equal(r.isolatedQaCandidateCount,4);
 assert.deepEqual(r.report.filter(x=>x.isolationQaCandidate).map(x=>x.sequence),[2,3,4,5]);
 assert.equal(r.sharedDatabaseTouched,false);
});
test('S11: never overwrites original migrations or writes executable .sql files',()=>{
 const r=generateS11();
 for(const row of r.report){const text=readFileSync(resolve(out,`REVIEW_ONLY_${row.file}.txt`),'utf8');assert.match(text,/NEVER EXECUTE IN SHARED HOST/);assert.match(text,/HOLD_HUMAN_NO_GO/);assert.equal(row.liveExecuteAllowed,false);}
});
test('S11: high-risk global bootstrap and privileged functions explicitly fail closed',()=>{
 const r=generateS11();assert.ok(r.report[0].hazards.includes('GLOBAL_BOOTSTRAP_NOT_PORTED'));
 for(const n of [14,19,23,24,27,29])assert.ok(r.report[n-1].hazards.length>1);
 assert.ok(r.report[22].hazards.includes('NON_CODE_SQL_BODY_NEEDS_SEMANTIC_PORT'));
});
test('S11: protected shared-host boundary and unknown domain refusal',()=>{
 const r=generateS11();assert.equal(r.targetProject,'pgsybzggewhinaniybiy');
 for(const row of r.report){assert.equal(row.protection,'HOLD_HUMAN_NO_GO');}
});
