/** Cânone alpha.9: private Bearer-only gateway, no browser database credentials. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const FEATURE_KEY = 'cfc.exam';
export class GatewayError extends Error {
  constructor(status, code) { super(code); this.name = 'GatewayError'; this.status = status; this.code = code; }
}
export function getBearer(headers = {}) {
  const auth = headers.authorization ?? headers.Authorization;
  if (typeof auth !== 'string' || auth.length > 8500 || !/^Bearer [^ ]+$/i.test(auth)) {
    throw new GatewayError(401, 'AUTH_REQUIRED');
  }
  const jwt = auth.slice(7);
  if (!JWT.test(jwt) || jwt.length > 8192) throw new GatewayError(401, 'INVALID_TOKEN');
  return jwt;
}
export function makeSupabaseAuthVerifier({ url, publishableKey, fetchImpl = fetch }) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.username || base.password || base.search || base.hash ||
      !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || !publishableKey || typeof publishableKey !== 'string') {
    throw new Error('INVALID_SUPABASE_AUTH_CONFIGURATION');
  }
  return async (jwt) => {
    let response;
    try {
      response = await fetchImpl(new URL('/auth/v1/user', base), {
        method: 'GET', cache: 'no-store', redirect: 'error',
        headers: { Authorization: `Bearer ${jwt}`, apikey: publishableKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
    } catch { throw new GatewayError(503, 'AUTH_UNAVAILABLE'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new GatewayError(401, 'INVALID_TOKEN');
      throw new GatewayError(503, 'AUTH_UNAVAILABLE');
    }
    let user;
    try { user = await response.json(); } catch { throw new GatewayError(503, 'AUTH_UNAVAILABLE'); }
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id) || user.is_anonymous === true) {
      throw new GatewayError(401, 'INVALID_USER');
    }
    return user.id.toLowerCase();
  };
}
const actionSchema = Object.freeze({
  '/api/v1/exam/start': { method: 'exam_start', keys: ['formId'], args: b => [b.formId] },
  '/api/v1/exam/answer': { method: 'exam_answer', keys: ['attemptId', 'ordinal', 'option'], args: b => [b.attemptId, b.ordinal, b.option] },
  '/api/v1/exam/finish': { method: 'exam_finish', keys: ['attemptId'], args: b => [b.attemptId] },
  '/api/v1/exam/reveal': { method: 'exam_reveal', keys: ['attemptId'], args: b => [b.attemptId] },
  '/api/v1/exam/review': { method: 'exam_to_srs', keys: ['attemptId', 'ordinal'], args: b => [b.attemptId, b.ordinal] },
});
export const SQL = Object.freeze({
  exam_start: 'SELECT canone_ops.exam_start($1::uuid) AS id',
  exam_answer: 'SELECT canone_ops.exam_answer($1::uuid,$2::integer,$3::text)',
  exam_finish: 'SELECT * FROM canone_ops.exam_finish($1::uuid)',
  exam_reveal: 'SELECT * FROM canone_ops.exam_reveal($1::uuid)',
  exam_to_srs: 'SELECT canone_ops.exam_to_srs($1::uuid,$2::integer) AS id',
});
function parseBody(raw, keys) {
  if (typeof raw !== 'string' || raw.length > 4096) throw new GatewayError(413, 'PAYLOAD_TOO_LARGE');
  let body;
  try { body = JSON.parse(raw); } catch { throw new GatewayError(400, 'INVALID_JSON'); }
  if (!body || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype ||
      Object.keys(body).length !== keys.length || keys.some(k => !Object.hasOwn(body, k))) {
    throw new GatewayError(400, 'INVALID_FIELDS');
  }
  for (const key of keys) {
    if (key === 'ordinal' && (!Number.isInteger(body[key]) || body[key] < 1 || body[key] > 1000)) {
      throw new GatewayError(400, 'INVALID_ORDINAL');
    }
    if ((key === 'formId' || key === 'attemptId') && (typeof body[key] !== 'string' || !UUID.test(body[key]))) {
      throw new GatewayError(400, 'INVALID_ID');
    }
    if (key === 'option' && !['A','B','C','D','E'].includes(body[key])) {
      throw new GatewayError(400, 'INVALID_OPTION');
    }
  }
  return body;
}
export function createGateway({ verifyUser, dbExecutor, featureKey = FEATURE_KEY }) {
  if (typeof verifyUser !== 'function' || typeof dbExecutor !== 'function') throw new Error('MISSING_INTERNAL_GATEWAY_DEPENDENCY');
  if (featureKey !== FEATURE_KEY) throw new Error('UNKNOWN_FEATURE_KEY');
  return async ({ method, path, headers, rawBody }) => {
    const baseHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff' };
    try {
      const action = actionSchema[path];
      if (!action) throw new GatewayError(404, 'NOT_FOUND');
      if (method !== 'POST') throw new GatewayError(405, 'METHOD_NOT_ALLOWED');
      if (!/application\/json(?:\s*;.*)?$/i.test(headers['content-type'] ?? '')) throw new GatewayError(415, 'JSON_REQUIRED');
      // Validate shape before network Auth/DB, but never use payload userId or role.
      const body = parseBody(rawBody, action.keys);
      const jwt = getBearer(headers);
      const userId = await verifyUser(jwt); // Auth server /auth/v1/user, never local JWT decode.
      if (!UUID.test(userId)) throw new GatewayError(503, 'AUTH_UNAVAILABLE');
      const result = await dbExecutor({ userId, featureKey, method: action.method, args: action.args(body) });
      return { status: 200, headers: baseHeaders, body: { ok: true, data: result } };
    } catch (error) {
      const e = error instanceof GatewayError ? error : new GatewayError(503, 'SERVICE_UNAVAILABLE');
      return { status: e.status, headers: baseHeaders, body: { ok: false, error: e.code } };
    }
  };
}
/** A trusted PG transaction binds a verified subject, then checks entitlement on every action. */
export function makePgExecutor({ pool }) {
  if (!pool || typeof pool.connect !== 'function') throw new Error('PG_POOL_REQUIRED');
  return async ({ userId, featureKey, method, args }) => {
    if (!UUID.test(userId) || featureKey !== FEATURE_KEY || !Object.hasOwn(SQL, method)) {
      throw new GatewayError(403, 'FORBIDDEN');
    }
    const client = await pool.connect();
    let begun = false;
    try {
      await client.query('BEGIN'); begun = true;
      await client.query("SET LOCAL statement_timeout = '4500ms'");
      await client.query("SET LOCAL lock_timeout = '2000ms'");
      // Runtime must have a dedicated, server-only PG login authorized to SET ROLE.
      await client.query('SET LOCAL ROLE service_role');
      await client.query("SELECT pg_catalog.set_config('request.jwt.claim.sub',$1,true)", [userId]);
      const authz = await client.query(
        'SELECT canone_ops.can_use_feature($1::uuid,$2::text) AS allowed', [userId, featureKey]);
      if (authz.rows?.[0]?.allowed !== true) throw new GatewayError(403, 'FEATURE_NOT_AUTHORIZED');
      const result = await client.query(SQL[method], args);
      await client.query('COMMIT'); begun = false;
      if (method === 'exam_answer') return { accepted: true };
      if (method === 'exam_reveal') return { rows: result.rows ?? [] };
      if (method === 'exam_finish') return result.rows?.[0] ?? null;
      return { id: result.rows?.[0]?.id ?? null };
    } catch (err) {
      if (begun) { try { await client.query('ROLLBACK'); } catch { /* discard connection below */ } }
      if (err instanceof GatewayError) throw err;
      if (err?.code === '42501') throw new GatewayError(403, 'FORBIDDEN');
      if (err?.code === '23503') throw new GatewayError(404, 'OBJECT_NOT_FOUND');
      if (err?.code === '23514') throw new GatewayError(409, 'ACTION_NOT_ALLOWED');
      throw new GatewayError(503, 'DATABASE_UNAVAILABLE');
    } finally { client.release(); }
  };
}
