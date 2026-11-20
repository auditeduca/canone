/** F3 real HTTP+PG17 test server. Synthetic Auth key stays in process. */
import {writeFileSync,unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createGateway,makePgExecutor,makeSupabaseAuthVerifier} from '../gateway/alpha11-core.mjs';
import {makeServer} from '../gateway/alpha9-server.mjs';
import {syntheticAuthFetch,syntheticToken} from './fixtures/ns02-local-auth.mjs';
const port=Number(process.env.CANONE_CI_PG17_PORT);
const file=process.env.CANONE_CI_P0_TOKEN_FILE;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CANONE_CI_PG17_ONLY!=='yes'||
 process.env.CANONE_SYNTHETIC_TEST_ONLY!=='1'||
 !/^[0-9a-f]{12}(?:[0-9a-f]{52})?$/.test(process.env.CANONE_CI_PG17_CONTAINER??'')||
 !Number.isInteger(port)||port<1024||port>65535||
 !/^\/tmp\/canone-p0-token-[A-Za-z0-9._-]+$/.test(file??'')||
 ['DATABASE_URL','SUPABASE_DB_URL','SUPABASE_DB_PASSWORD','SUPABASE_SERVICE_ROLE_KEY',
  'CANONE_PG_DSN','CANONE_SUPABASE_URL'].some(k=>process.env[k]))
 throw Error('REFUSE_NON_EPHEMERAL_F3_PG17');
const requireBackend=createRequire(new URL('../source-s22/backend/package.json',import.meta.url));
const {Pool}=requireBackend('pg');
const pool=new Pool({host:'127.0.0.1',port,database:'canone_alpha7_ci',ssl:false,
  user:'canone_gateway_ci',password:'canone_ci_ephemeral_only',max:2,
  connectionTimeoutMillis:3000,idleTimeoutMillis:1000});
const verifier=makeSupabaseAuthVerifier({url:'https://ns02-test-project.supabase.co',
  publishableKey:'fake_publishable_key_only_for_ns02',fetchImpl:syntheticAuthFetch});
let server;
try{
  const role=await pool.query('SELECT current_user,r.rolsuper FROM pg_roles r WHERE r.rolname=current_user');
  if(role.rows?.[0]?.current_user!=='canone_gateway_ci'||role.rows?.[0]?.rolsuper!==false)
    throw Error('INVALID_EPHEMERAL_DB_ROLE');
  server=await makeServer({gateway:createGateway({verifyUser:verifier,dbExecutor:makePgExecutor({pool})}),
    host:'127.0.0.1',port:8788});
  writeFileSync(file,JSON.stringify({
    owner:syntheticToken('33333333-3333-4333-8333-333333333333'),
    peer:syntheticToken('44444444-4444-4444-8444-444444444444'),
    unlicensed:syntheticToken('55555555-5555-4555-8555-555555555555')
  }),{mode:0o600});
  console.log('F3_REAL_PG17_GATEWAY_READY');
}catch(e){await pool.end();throw e;}
const shutdown=async()=>{
  await new Promise(resolve=>server.close(()=>resolve()));
  await pool.end();
  try{unlinkSync(file);}catch{}
  process.exit(0);
};
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
