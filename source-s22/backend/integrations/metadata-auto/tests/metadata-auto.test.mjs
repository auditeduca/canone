import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readInputs,validateSnapshot,buildArtifacts,sha256,stable,parseCanoneERD} from '../engine.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const snapshotFile=join(root,'snapshots/supabase-audit-educa-observed.v1.json');
const {snapshot,contract,targetTables}=readInputs(root,snapshotFile);
const clone=x=>structuredClone(x);

test('reconcilia 19 FKs físicas e 3 elos lógicos sem confundi-los; views preservadas',()=>{
  const result=validateSnapshot(snapshot,contract,targetTables);
  assert.deepEqual(result.structural_issues,[]);
  assert.equal(result.foreign_keys,19);
  assert.equal(result.logical_relations,3);
  assert.equal(result.view_dependencies,5);
  assert.equal(snapshot.tables.find(x=>x.id==='account_palm.master_register').object_kind,'VIEW');
  assert.equal(result.release_gate,'HOLD_HUMAN');
  assert.ok(targetTables.length>=90);
});
test('dicionário, mapa e registros são gerados deterministicamente',()=>{
  const a=buildArtifacts(snapshot,contract,targetTables);
  const b=buildArtifacts(snapshot,contract,targetTables);
  assert.equal(stable(a),stable(b));
  assert.ok(a['dicionario-dados.csv'].includes('contabilidade_cfc'));
  assert.ok(a['mapa-crosswalk.md'].includes('norms.norm'));
  assert.match(a['relacionamentos.mmd'],/\[FK\]/);
  assert.match(a['relacionamentos.mmd'],/\[LÓGICO\]/);
});
test('FK sem destino bloqueia geração e publicação',()=>{
  const modified=clone(snapshot);modified.relationships[0].to='account_palm.tabela_inexistente';
  const result=validateSnapshot(modified,contract,targetTables);
  assert.ok(result.structural_issues.some(x=>x.includes('RELATION_ENDPOINT_MISSING')));
  assert.throws(()=>buildArtifacts(modified,contract,targetTables),/METADATA_INVALID/);
});
test('FK sem validação ou relação lógica fingindo FK é reprovada',()=>{
  const m=clone(snapshot);const fk=m.relationships.find(x=>x.kind==='FOREIGN_KEY');fk.validated=false;
  assert.ok(validateSnapshot(m,contract,targetTables).structural_issues.some(x=>x.includes('UNVALIDATED_FK')));
  const m2=clone(snapshot);const rel=m2.relationships.find(x=>x.kind==='LOGICAL_CROSSWALK');rel.validated=true;
  assert.ok(validateSnapshot(m2,contract,targetTables).structural_issues.some(x=>x.includes('LOGICAL_RELATION_MISLABELED')));
});
test('view sem origem comprovada ou fingindo PK física é bloqueada',()=>{
  const m=clone(snapshot);const v=m.tables.find(x=>x.id==='account_palm.master_register');
  v.primary_key=['register_id'];
  assert.ok(validateSnapshot(m,contract,targetTables).structural_issues.some(x=>x.includes('VIEW_PRETENDS_PHYSICAL_PK')));
  const m2=clone(snapshot);m2.relationships=m2.relationships.filter(x=>!x.id.includes('account_palm.master_register__view_dependency'));
  assert.ok(validateSnapshot(m2,contract,targetTables).structural_issues.some(x=>x.includes('VIEW_DEPENDENCY_MISSING')));
});

test('redução de aridade da FK bloqueia contrato físico',()=>{
  const m=clone(snapshot);const fk=m.relationships.find(x=>x.kind==='FOREIGN_KEY');fk.to_columns=[];
  assert.ok(validateSnapshot(m,contract,targetTables).structural_issues.some(x=>x.includes('FK_COLUMN_ARITY')));
});
test('origem de Enfermagem fora da allowlist bloqueia geração',()=>{
  const c=clone(contract);c.tables[0].source='public.exam_questions';
  assert.ok(validateSnapshot(snapshot,c,targetTables).structural_issues.some(x=>x.includes('UNAUTHORIZED_SOURCE')));
});
test('metamodelo não aceita ausência de schema de destino',()=>{
  const t=targetTables.filter(x=>x.id!=='norms.norm_version');
  assert.ok(validateSnapshot(snapshot,contract,t).structural_issues.some(x=>x==='CANONE_TARGET_MISSING norms.norm_version'));
});
test('release fail-closed mesmo com fontes e FKs íntegros',()=>{
  const result=validateSnapshot(snapshot,contract,targetTables);
  assert.equal(result.structurally_valid,true);
  assert.equal(result.release_gate,'HOLD_HUMAN');
  assert.ok(result.release_blockers.some(x=>x.startsWith('GABARITO_PENDENTE')));
  assert.ok(result.release_blockers.some(x=>x.startsWith('NORMAS_NAO_CONCILIADAS')));
});
test('geração é idempotente; --check compara byte a byte',()=>{
  const run=spawnSync(process.execPath,[join(root,'generate.mjs'),'--check'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/PASS_NO_DRIFT/);
});
test('gerador não consulta produção por padrão e recusa --live sem segredo',()=>{
  const dry=spawnSync(process.execPath,[join(root,'generate.mjs')],{encoding:'utf8'});
  assert.equal(dry.status,0);
  assert.match(dry.stdout,/DRY_RUN/);
  const run=spawnSync(process.execPath,[join(root,'generate.mjs'),'--live','--check'],{encoding:'utf8',env:{...process.env,CANONE_SOURCE_DATABASE_URL:''}});
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/CANONE_SOURCE_DATABASE_URL ausente/);
});
test('DDL staging reserva FKs tipadas, RLS forçado e impede auto-promoção',()=>{
  const sql=readFileSync(join(root,'ddl/001_canone_bridge_isolated_only.sql'),'utf8');
  assert.match(sql,/REFERENCES canone_bridge\.source_row\(id\)/);
  assert.match(sql,/REFERENCES norms\.norm\(id\)/);
  assert.match(sql,/REFERENCES editorial\.content_item\(id\)/);
  assert.match(sql,/CHECK\(publication_eligible = false\)/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/g);
  assert.match(sql,/bridge_exactly_one_target/);
  assert.match(sql,/REVOKE ALL ON ALL TABLES/);
});
