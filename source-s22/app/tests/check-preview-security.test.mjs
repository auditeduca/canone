import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { validarPrevia } from '../scripts/check-preview-security.mjs';

const root = resolve(import.meta.dirname, '..');
function fixture(change) {
  const dir = mkdtempSync(join(tmpdir(), 'canone-s4-'));
  mkdirSync(join(dir, 'src', 'screens'), { recursive: true });
  for (const f of ['package.json', 'package-lock.json', 'vercel.json']) {
    writeFileSync(join(dir, f), readFileSync(join(root, f)));
  }
  writeFileSync(join(dir, 'src', 'screens', 'Entrar.tsx'),
    readFileSync(join(root, 'src', 'screens', 'Entrar.tsx')));
  change?.(dir);
  return dir;
}
function mutateJSON(dir, file, change) {
  const p = join(dir, file); const j = JSON.parse(readFileSync(p, 'utf8'));
  change(j); writeFileSync(p, JSON.stringify(j));
}
function identifiers(dir) { return validarPrevia(dir).failures.map(f => f.id); }

test('baseline S4 fail-closed para preview passa', () => {
  assert.deepEqual(validarPrevia().failures, []);
});
test('detecta divergência entre package.json e lockfile', () => {
  const d = fixture(p => mutateJSON(p, 'package.json', j => j.dependencies.react = '0.0.0'));
  try { assert.ok(identifiers(d).includes('NPM_DIRECT_DEPS_MATCH')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta versão vulnerável de Vite mesmo com declaração atual', () => {
  const d = fixture(p => mutateJSON(p, 'package-lock.json', j => j.packages['node_modules/vite'].version = '5.4.21'));
  try { assert.ok(identifiers(d).includes('VITE_SECURITY_PATCH')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta versão vulnerável do playwright-core', () => {
  const d = fixture(p => mutateJSON(p, 'package-lock.json', j => j.packages['node_modules/playwright-core'].version = '1.55.0'));
  try { assert.ok(identifiers(d).includes('PLAYWRIGHT_SECURITY_PATCH')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta segredo privilegiado inserido em fonte frontend', () => {
  const d = fixture(p => writeFileSync(join(p, 'src', 'segredo.ts'), 'const key = import.meta.env.VITE_COMANDER_TOKEN'));
  try { assert.ok(identifiers(d).includes('NO_BROWSER_OPERATOR_SECRET')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta perda de noindex da prévia', () => {
  const d = fixture(p => mutateJSON(p, 'vercel.json', j => j.headers[0].headers = j.headers[0].headers.filter(x => x.key !== 'X-Robots-Tag')));
  try { assert.ok(identifiers(d).includes('PROTECTED_HEADERS')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta armazenamento persistente de token', () => {
  const d = fixture(p => writeFileSync(join(p, 'src', 'persist.ts'), `localStorage.setItem('token', 'x')`));
  try { assert.ok(identifiers(d).includes('NO_PERSISTENT_BEARER')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta ausência de bloqueio na troca de link sem backend', () => {
  const d = fixture(p => writeFileSync(join(p, 'src', 'screens', 'Entrar.tsx'), 'async function trocarLink() { fetch("/api/auth/sessao") }'));
  try { assert.ok(identifiers(d).includes('LOGIN_NO_BACKEND_FAIL_CLOSED')); } finally { rmSync(d, { recursive: true, force: true }); }
});
test('detecta build que pula TypeScript', () => {
  const d = fixture(p => mutateJSON(p, 'package.json', j => j.scripts.build = 'tsc -b --noCheck && vite build'));
  try { assert.ok(identifiers(d).includes('STRICT_TYPESCRIPT_BUILD')); } finally { rmSync(d, { recursive: true, force: true }); }
});
