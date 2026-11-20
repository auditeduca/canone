// =============================================================================
// GERADOR DE ERD — o diagrama vem do BANCO, não de uma lembrança.
// -----------------------------------------------------------------------------
// Lê o catálogo do Postgres (information_schema) e emite Mermaid.
// Um ERD escrito à mão mente no dia seguinte; este é extraído do schema que
// roda.
// =============================================================================
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { splitSql } from './migrate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MIGRATIONS = join(ROOT, 'db', 'migrations');

const db = await PGlite.create({ extensions: { citext, pg_trgm, btree_gist } });
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  for (const stmt of splitSql(readFileSync(join(MIGRATIONS, f), 'utf8'))) {
    await db.exec(stmt);
  }
}

// Tabelas e colunas
const cols = await db.query(`
  SELECT c.table_schema, c.table_name, c.column_name, c.udt_name AS data_type,
         c.is_nullable, c.column_default
    FROM information_schema.columns c
   WHERE c.table_schema IN ('identity','editorial','taxonomy','norms','learning',
                             'commerce','admin','ops','audit','public','subscriber')
     AND c.table_name NOT LIKE 'v\\_%' ESCAPE '\\'
   ORDER BY c.table_schema, c.table_name, c.ordinal_position
`);

const tabelas = new Map();
for (const r of cols.rows) {
  const chave = `${r.table_schema}.${r.table_name}`;
  if (!tabelas.has(chave)) tabelas.set(chave, []);
  tabelas.get(chave).push(r);
}

// Chaves primárias
const pks = await db.query(`
  SELECT tc.table_schema, tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
   WHERE tc.constraint_type = 'PRIMARY KEY'
     AND tc.table_schema IN ('identity','editorial','taxonomy','norms','learning',
                              'commerce','admin','ops','audit')
`);

// Relações (FKs)
const fks = await db.query(`
  SELECT tc.table_schema, tc.table_name, kcu.column_name,
         ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema IN ('identity','editorial','taxonomy','norms','learning',
                              'commerce','admin','ops','audit')
`);

const pkDe = new Map();
for (const r of pks.rows) pkDe.set(`${r.table_schema}.${r.table_name}`, r.column_name);

const linha = (t) => {
  const c = tabelas.get(t);
  if (!c) return null;
  const pk = pkDe.get(t);
  const partes = c.map((col) => {
    const ehPk = col.column_name === pk;
    const ehFk = fks.rows.some(
      (f) => f.table_schema === c[0].table_schema && f.table_name === c[0].table_name &&
             f.column_name === col.column_name
    );
    // udt_name é o tipo real do Postgres (citext, timestamptz, int4...);
    // data_type vem como 'USER-DEFINED' para extensão, o que é inútil.
    const tipos = {
      uuid: 'uuid', text: 'text', citext: 'text', int4: 'int', int8: 'bigint',
      numeric: 'num', bool: 'bool', date: 'date', jsonb: 'json', tsvector: 'tsvector',
      timestamptz: 'ts', time: 'time', bytea: 'bytes', varchar: 'text',
      inet: 'inet', char: 'char', int2: 'smallint', float8: 'float'
    };
    const bruto = col.data_type;
    const t2 = bruto.startsWith('_')
      ? (tipos[bruto.slice(1)] ?? bruto.slice(1)) + '[]'
      : (tipos[bruto] ?? bruto);
    return `      ${col.column_name} ${t2}${ehPk ? ' PK' : ''}${ehFk ? ' FK' : ''}`;
  });
  return `  ${t} {\n${partes.join('\n')}\n  }`;
};

// Nomes de relação legíveis: "editorial_x" -> "editorial"
const nomeRel = (schema, tabela) => {
  const t = tabela.replace(/^(v_)/, '');
  return t;
};

const blocos = [];
for (const schema of ['identity', 'editorial', 'taxonomy', 'norms', 'learning', 'commerce', 'admin', 'ops', 'audit']) {
  const ts = [...tabelas.keys()].filter((k) => k.startsWith(schema + '.')).sort();
  if (!ts.length) continue;
  blocos.push(`  subgraph ${schema}\n${ts.map(linha).filter(Boolean).join('\n')}\n  end`);
}

const relacoes = fks.rows
  .filter((f) => tabelas.has(`${f.table_schema}.${f.table_name}`) &&
                  tabelas.has(`${f.ref_schema}.${f.ref_table}`))
  .map((f) => {
    const de = `${f.table_schema}.${f.table_name}`;
    const para = `${f.ref_schema}.${f.ref_table}`;
    return `  ${nomeRel(f.table_schema, f.table_name)} ${f.column_name} --> ${nomeRel(f.ref_schema, f.ref_table)}`;
  });

const mermaid = `%% Gerado por scripts/gerar-erd.mjs a partir do schema REAL.
%% ${tabelas.size} tabelas · ${fks.rows.length} chaves estrangeiras.
%% NÃO EDITE À MÃO: regenere com "npm run erd".
erDiagram
${blocos.join('\n')}

${[...new Set(relacoes)].join('\n')}
`;

const saida = join(ROOT, 'docs', '03-erd.mmd');
writeFileSync(saida, mermaid, 'utf8');

const md = `# 03 · ERD

> **Gerado do banco.** O diagrama abaixo é extraído do catálogo do Postgres
> em tempo de build (\`npm run erd\`), com ${tabelas.size} tabelas e
> ${fks.rows.length} chaves estrangeiras. Um ERD escrito à mão mente no dia
> seguinte; este não tem como mentir.

Diagrama completo (Mermaid): [\`03-erd.mmd\`](./03-erd.mmd)

## As tabelas por domínio

| Schema | Tabelas | O que guarda |
|---|---|---|
| \`identity\` | ${[...tabelas.keys()].filter(k => k.startsWith('identity.')).length} | credencial, perfil, consentimento, solicitação de dados |
| \`editorial\` | ${[...tabelas.keys()].filter(k => k.startsWith('editorial.')).length} | metamodelo, conteúdo versionado, verificação, fonte, revisão |
| \`taxonomy\` | ${[...tabelas.keys()].filter(k => k.startsWith('taxonomy.')).length} | áreas, assuntos, subtopics, módulos, blueprint, edições do exame |
| \`norms\` | ${[...tabelas.keys()].filter(k => k.startsWith('norms.')).length} | órgãos, normas, versões, itens normativos |
| \`learning\` | ${[...tabelas.keys()].filter(k => k.startsWith('learning.')).length} | itens, SRS, progresso, histórico, notas, offline |
| \`commerce\` | ${[...tabelas.keys()].filter(k => k.startsWith('commerce.')).length} | planos, assinaturas, pagamentos, elegibilidade |
| \`admin\` | ${[...tabelas.keys()].filter(k => k.startsWith('admin.')).length} | concessão de visão de usuário, moderação, flags |
| \`ops\` | ${[...tabelas.keys()].filter(k => k.startsWith('ops.')).length} | settings, integrações, webhooks, jobs |
| \`audit\` | ${[...tabelas.keys()].filter(k => k.startsWith('audit.')).length} | log append-only com encadeamento de hash |

## As cinco relações que sustentam a tese

\`\`\`
editorial.source ──< editorial.verification ──< editorial.content_item
        (fonte)            (a prova)                    (o conteúdo)
                              │
                              │ state='verificada'
                              │ exige source_quote + valid_until
                              ▼
                     content_item.state = 'publicado'
\`\`\`

1. **\`content_item\` ↔ \`content_item_version\`** — o payload canônico mora
   na versão; o item é o índice estável.
2. **\`content_item_version\` → \`learning.item\`/\`item_option\`** — projeção
   por trigger. O payload é a verdade.
3. **\`content_item\` → \`verification\` → \`source\`** — a verificação é
   entidade, com o trecho literal da fonte ao lado.
4. **\`norms.norm\` → \`norm_version\` → \`norm_item\`** — a vigência encadeada;
   nova versão caduca a verificação e abre a moderação.
5. **\`identity.account\` → tudo** — o \`user_id\` é a origem da propriedade
   (o RLS usa \`ops.current_user_id()\`, não a coluna).
`;

writeFileSync(join(ROOT, 'docs', '03-erd.md'), md, 'utf8');
console.log(`ERD gerado: ${tabelas.size} tabelas, ${fks.rows.length} FKs → docs/03-erd.mmd + docs/03-erd.md`);
await db.close();
