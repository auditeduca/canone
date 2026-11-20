/** Development-only HTTP entrypoint; no deploy until dedicated staging & security review. */
import http from 'node:http';
import { createRequire } from 'node:module';
import { createGateway, makePgExecutor, makeSupabaseAuthVerifier } from './alpha9-core.mjs';

export function validateEnvironment(env) {
  const project = env.CANONE_EXPECTED_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(project ?? '') || project === 'pgsybzggewhinaniybiy')
    throw Error('MISSING_OR_SHARED_SUPABASE_PROJECT');
  if (env.CANONE_SUPABASE_URL !== `https://${project}.supabase.co` ||
      !env.CANONE_SUPABASE_PUBLISHABLE_KEY || !env.CANONE_PG_DSN) throw Error('REQUIRED_SERVER_CONFIGURATION_MISSING');
  const pg = new URL(env.CANONE_PG_DSN);
  if (pg.protocol !== 'postgresql:' && pg.protocol !== 'postgres:') throw Error('INVALID_PG_DSN');
  if (pg.hostname !== `db.${project}.supabase.co`) throw Error('REFUSE_UNMATCHED_DB_PROJECT');
  // Explicitly refuse non-TLS direct DB URLs (the PG server itself must also require SSL).
  if (pg.searchParams.get('sslmode') !== 'verify-full') throw Error('PG_TLS_VERIFY_FULL_REQUIRED');
  return project;
}
export async function makeServer({ gateway, host = '127.0.0.1', port = 8788 }) {
  const server = http.createServer(async (req, res) => {
    let rawBody = '';
    try {
      for await (const chunk of req) {
        rawBody += chunk.toString('utf8');
        if (rawBody.length > 4096) { res.writeHead(413); res.end(); return; }
      }
      const path = new URL(req.url ?? '/', `http://${host}`).pathname;
      const result = await gateway({ method: req.method, path, headers: req.headers, rawBody });
      res.writeHead(result.status, result.headers);
      res.end(JSON.stringify(result.body));
    } catch {
      res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: 'SERVICE_UNAVAILABLE' }));
    }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, host, resolve));
  return server;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  validateEnvironment(process.env);
  // Historical backend declares and lockfiles pg@8.23.1; no new unpinned supply-chain dependency.
  const requireFromBackend = createRequire(new URL('../../source-s22/backend/package.json', import.meta.url));
  const { Pool } = requireFromBackend('pg');
  const pool = new Pool({ connectionString: process.env.CANONE_PG_DSN, max: 5, idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 3000 });
  const gateway = createGateway({
    verifyUser: makeSupabaseAuthVerifier({ url: process.env.CANONE_SUPABASE_URL,
      publishableKey: process.env.CANONE_SUPABASE_PUBLISHABLE_KEY }),
    dbExecutor: makePgExecutor({ pool }),
  });
  await makeServer({ gateway });
  process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
}
