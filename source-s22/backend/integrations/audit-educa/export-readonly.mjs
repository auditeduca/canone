#!/usr/bin/env node
// Exporta dados APENAS da origem privada, em transação REPEATABLE READ READ ONLY.
// Não copia para o Cânone e nunca altera o Supabase.
import {readFile, mkdir, writeFile, open as openFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const directory = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(await readFile(path.join(directory, 'contract.v1.json'), 'utf8'));
const run = process.argv.includes('--execute');
const output = process.env.CANONE_BRIDGE_EXPORT_DIR || path.resolve(directory, '../../.local-bridge/export');
if (!run) {
  process.stdout.write(JSON.stringify({status:'DRY_RUN', tables:contract.tables.map(t=>t.source), output,
    source:'CANONE_SOURCE_DATABASE_URL (server only)', writes_to_database:0}, null,2)+'\n');
  process.exit(0);
}
if (!process.env.CANONE_SOURCE_DATABASE_URL) {
  console.error('HOLD: CANONE_SOURCE_DATABASE_URL ausente; configurar como segredo somente leitura.');
  process.exit(2);
}
// Vinculação defensiva ao ref remoto inspecionado; cópias locais exigem override explícito.
const sourceUrl = new URL(process.env.CANONE_SOURCE_DATABASE_URL);
if (!`${sourceUrl.hostname} ${decodeURIComponent(sourceUrl.username)}`.includes(contract.source_project_ref)
    && process.env.CANONE_SOURCE_REF_OVERRIDE !== 'I_UNDERSTAND_SOURCE_MISMATCH') {
  console.error('HOLD: a conexão não contém o ref esperado do projeto de origem.');
  process.exit(2);
}
const {Client} = await import('pg');
const client = new Client({connectionString:process.env.CANONE_SOURCE_DATABASE_URL,application_name:'canone-audit-educa-readonly-v1'});
await mkdir(output,{recursive:true});
const manifest = {contract:contract.contract_id, source_project_ref:contract.source_project_ref,
  extracted_at:new Date().toISOString(), mode:'READ_ONLY', tables:[]};
const quote = x => '"' + x.replaceAll('"','""') + '"';
try {
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for (const item of contract.tables) {
    const [schema,table]=item.source.split('.');
    const cols = item.export_fields ? item.export_fields.map(quote).join(', ') : '*';
    const fileName=item.source.replaceAll('.','__')+'.ndjson';
    const file=await openFile(path.join(output,fileName),'w',0o600);
    let count=0,offset=0; const checksum=createHash('sha256');
    try {
      while(true) {
        const sql=`SELECT ${cols} FROM ${quote(schema)}.${quote(table)} ORDER BY ${quote(item.key)} LIMIT 250 OFFSET $1`;
        const {rows}=await client.query(sql,[offset]);
        if (!rows.length)break;
        for (const row of rows) {
          const line=JSON.stringify(row)+'\n';
          await file.write(line); checksum.update(line); count++;
        }
        offset+=rows.length;
      }
    } finally {await file.close();}
    manifest.tables.push({source:item.source,file:fileName,rows:count,sha256:checksum.digest('hex'),type:item.type});
    console.log(`${item.source}: ${count} linhas (somente leitura)`);
  }
  await client.query('COMMIT');
  await writeFile(path.join(output,'manifest.json'), JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  console.log(`Manifesto gravado: ${path.join(output,'manifest.json')}`);
} catch (err) {
  try {await client.query('ROLLBACK');} catch {}
  console.error('EXPORT_FAILED:',err.message); process.exitCode=1;
} finally {await client.end().catch(()=>{});}
