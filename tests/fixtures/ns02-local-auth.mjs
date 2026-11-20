/** Test-only Supabase Auth HTTP response emulator: NEVER import from gateway runtime. */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { GatewayError } from '../../gateway/alpha9-core.mjs';

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const key = randomBytes(32); // new ephemeral signing key for EACH test process
export const STUDENT_A = randomUUID();
export const STUDENT_B = randomUUID();
export const FIXTURE_FORM = randomUUID();
const DEFAULT_TTL = 300;
const makeSignature = (input, k=key) => createHmac('sha256',k).update(input).digest('base64url');

export function syntheticToken(sub, {ttl=DEFAULT_TTL, user_metadata={}}={}) {
  const header=b64({alg:'HS256',typ:'JWT'});
  const payload=b64({sub,exp:Math.floor(Date.now()/1000)+ttl,iss:'ns02-local-test-only',user_metadata});
  const body=header+'.'+payload;
  return body+'.'+makeSignature(body);
}
export function tamperedToken(sub) {
  const token=syntheticToken(sub);
  const [a,b] = token.split('.');
  const wrong = makeSignature(a+'.'+b,randomBytes(32));
  return a+'.'+b+'.'+wrong;
}
export function syntheticAuthFetch(url, options) {
  if (process.env.CANONE_SYNTHETIC_TEST_ONLY !== '1')
    throw Error('SIMULATED_AUTH_DISABLED_OUTSIDE_TESTS');
  const u = new URL(url);
  if (u.protocol!=='https:' || u.hostname!=='ns02-test-project.supabase.co' || u.pathname!=='/auth/v1/user')
    throw Error('TEST_FETCH_REFUSES_NON_FIXTURE_HOST');
  if (options?.method !== 'GET' || options?.headers?.apikey !== 'fake_publishable_key_only_for_ns02')
    throw Error('TEST_AUTH_REQUEST_CONTRACT_CHANGED');
  const token=options?.headers?.Authorization?.replace(/^Bearer /,'') || '';
  const ok={ok:false,status:401,json:async()=>({message:'unauthorized'})};
  const parts=token.split('.');
  if (parts.length!==3) return Promise.resolve(ok);
  try {
    const body=parts[0]+'.'+parts[1];
    const sig=Buffer.from(parts[2],'utf8');
    const expected=Buffer.from(makeSignature(body),'utf8');
    if (sig.length!==expected.length || !timingSafeEqual(sig,expected))return Promise.resolve(ok);
    const header=JSON.parse(Buffer.from(parts[0],'base64url'));
    const payload=JSON.parse(Buffer.from(parts[1],'base64url'));
    if (header.alg!=='HS256' || payload.iss!=='ns02-local-test-only' ||
        typeof payload.exp!=='number' || payload.exp<=Date.now()/1000)
      return Promise.resolve(ok);
    return Promise.resolve({ok:true,status:200,json:async()=>({id:payload.sub,user_metadata:payload.user_metadata})});
  } catch { return Promise.resolve(ok); }
}
/** Reproducible test-double for *gateway authorization*, NOT a database or RLS model. */
export function syntheticDbExecutor() {
  const subscribed=new Set([STUDENT_A,STUDENT_B]);
  const attempts=new Map();
  const seen=new Set();
  const actions=[];
  return {
    actions, subscribed, attempts,
    async execute({userId,featureKey,method,args}) {
      actions.push({userId,featureKey,method});
      if (featureKey!=='cfc.exam' || !subscribed.has(userId))
        throw new GatewayError(403,'FEATURE_NOT_AUTHORIZED');
      if (method==='exam_start') {
        if (args[0]!==FIXTURE_FORM) throw new GatewayError(404,'OBJECT_NOT_FOUND');
        const id=randomUUID(); attempts.set(id,{userId,answered:false,finished:false});return {id};
      }
      const obj=attempts.get(args[0]);
      if (!obj || obj.userId!==userId) throw new GatewayError(403,'FORBIDDEN');
      if (method==='exam_answer') {
        if (obj.finished)throw new GatewayError(409,'ACTION_NOT_ALLOWED');
        obj.answered=true;return {accepted:true};
      }
      if (method==='exam_finish') {
        if (!obj.answered)throw new GatewayError(409,'ACTION_NOT_ALLOWED');
        obj.finished=true;return {question_count:1,answered_count:1};
      }
      if (method==='exam_reveal') {
        if (!obj.finished)throw new GatewayError(409,'ACTION_NOT_ALLOWED');
        return {rows:[{ordinal:1,correct_option:'C'}]};
      }
      if (method==='exam_to_srs') {
        if (!obj.finished)throw new GatewayError(409,'ACTION_NOT_ALLOWED');
        const dedupe=args[0]+':'+args[1];if(!seen.has(dedupe))seen.add(dedupe);
        return {id:dedupe};
      }
      throw new GatewayError(404,'NOT_FOUND');
    },
    reviewEventCount(){return seen.size;}
  };
}
