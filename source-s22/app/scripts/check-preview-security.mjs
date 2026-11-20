/**
 * Read-only, offline preview supply-chain and public-boundary guard.
 * Passing this check is NEVER permission to publish clinical/legal/editorial
 * content, enable payments, or expose an operational backend.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, dirname, join } from 'node:path';

const scriptPath = fileURLToPath(import.meta.url);
const APP_ROOT = resolve(dirname(scriptPath), '..');
const requiredHeaders = [
  'Content-Security-Policy',
  'X-Robots-Tag',
  'X-Content-Type-Options',
  'X-Frame-Options',
];

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) result.push(...listFiles(p));
    else if (d.isFile()) result.push(p);
  }
  return result;
}

export function validarPrevia(root = APP_ROOT) {
  const failures = [];
  const passes = [];
  function check(id, ok, reason) {
    (ok ? passes : failures).push({ id, ...(ok ? {} : { reason }) });
  }
  let pkg, lock, vercel;
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
    vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  } catch (error) {
    return { status: 'HOLD_SECURITY', passes: [], failures: [{ id: 'FILES', reason: String(error) }] };
  }
  const rootLock = lock.packages?.[''] ?? {};
  check('NPM_LOCK_V3', lock.lockfileVersion === 3, 'Lockfile v3 ausente');
  check('NPM_DIRECT_DEPS_MATCH',
    JSON.stringify(pkg.dependencies ?? {}) === JSON.stringify(rootLock.dependencies ?? {}) &&
    JSON.stringify(pkg.devDependencies ?? {}) === JSON.stringify(rootLock.devDependencies ?? {}),
    'As dependências declaradas não correspondem ao lockfile');
  check('VITE_SECURITY_PATCH', pkg.devDependencies?.vite === '6.4.6' && lock.packages?.['node_modules/vite']?.version === '6.4.6',
    'Vite 6.4.6 não está fixado e travado');
  check('PLAYWRIGHT_SECURITY_PATCH', pkg.devDependencies?.playwright === '1.55.1' &&
    lock.packages?.['node_modules/playwright']?.version === '1.55.1' &&
    lock.packages?.['node_modules/playwright-core']?.version === '1.55.1',
    'Playwright ou playwright-core permanece anterior à correção de segurança');
  check('STRICT_TYPESCRIPT_BUILD', /\btsc\s+--noEmit\b/.test(pkg.scripts?.build ?? '') &&
    !/--noCheck/.test(pkg.scripts?.build ?? ''), 'Build permite ignorar verificação TypeScript');
  const hdrMap = new Map((vercel.headers ?? []).flatMap(x => x.headers ?? []).map(x => [x.key.toLowerCase(), x.value]));
  check('PROTECTED_HEADERS', requiredHeaders.every(h => hdrMap.has(h.toLowerCase())) &&
    (hdrMap.get('content-security-policy') ?? '').includes("frame-ancestors 'none'") &&
    (hdrMap.get('x-robots-tag') ?? '').toLowerCase().includes('noindex'),
  'Faltam CSP/frame-ancestors/noindex ou outros headers de prévia');
  const source = listFiles(join(root, 'src')).filter(f => /\.tsx?$/.test(f))
    .map(f => ({ path: relative(root, f), text: readFileSync(f, 'utf8') }));
  check('NO_BROWSER_OPERATOR_SECRET', !source.some(({ text }) =>
    /VITE_COMANDER_TOKEN|SUPABASE_SERVICE_ROLE|service_role_key/i.test(text)),
  'Código TS/TSX contém referência a segredo privilegiado no navegador');
  check('NO_PERSISTENT_BEARER', !source.some(({ text }) =>
    /\b(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem)\s*\(/.test(text)),
  'Persistência de bearer token no armazenamento do navegador');
  const login = source.find(f => f.path.endsWith('src/screens/Entrar.tsx'))?.text ?? '';
  check('LOGIN_NO_BACKEND_FAIL_CLOSED', /async function trocarLink[\s\S]*?if\s*\(!cfg\.baseUrl\)/.test(login),
  'Troca de link sem verificação explícita de backend');
  const assets = listFiles(join(root, 'public'));
  check('NO_RESTRICTED_FONT_FILES', !assets.some(x => /\.woff2?$/i.test(x)),
  'Fontes binárias presentes sem manifesto comprovado de licença');
  check('NO_TEMP_DIAGNOSTICS', !/s4-(?:audit|lockfile)\./i.test(pkg.scripts?.build ?? ''),
  'Comando de build contém exportação temporária de diagnóstico');
  return { status: failures.length ? 'HOLD_SECURITY' : 'PASS_PREVIEW_ONLY', passes, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const r = validarPrevia();
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = r.failures.length ? 2 : 0;
}
