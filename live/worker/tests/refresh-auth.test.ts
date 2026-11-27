/**
 * Ujian auth `POST /api/refresh`.
 *
 *   node --experimental-strip-types --import ./tests/register-ts.mjs --test tests/refresh-auth.test.ts
 *
 * Refresh manual menulis ke KV, jadi ia mesti Sentiasa proving. Ujian ini
 * memastikan:
 *   - token bearer yang betul diterima
 *   - token salah / tiada ditolak
 *   - secret yang belum dikonfigurasi MENUTUP endpoint (bukan membuka)
 *   - perbandingan token constant-time (panjang tidak bocor)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { authorizeRefresh, bearerToken, constantTimeEquals } from '../src/lib/refresh-auth.ts';
import type { Env } from '../src/types.ts';

function request(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/refresh', { method: 'POST', headers });
}

const ENV: Env = { REFRESH_API_TOKEN: 'rahasia-panjang' };

test('bearer token yang betul diterima', () => {
  const auth = authorizeRefresh(request({ Authorization: 'Bearer rahasia-panjang' }), ENV);
  assert.equal(auth.ok, true);
});

test('bearer token salah ditolak dengan 401', () => {
  const auth = authorizeRefresh(request({ Authorization: 'Bearer salah' }), ENV);
  assert.equal(auth.ok, false);
  if (auth.ok) return;
  assert.equal(auth.status, 401);
  assert.equal(auth.error, 'unauthorized');
});

test('request tanpa Authorization ditolak', () => {
  const auth = authorizeRefresh(request({}), ENV);
  assert.equal(auth.ok, false);
  if (auth.ok) return;
  assert.equal(auth.status, 401);
});

test('scheme "bearer" insensitive kepada huruf besar', () => {
  const auth = authorizeRefresh(request({ Authorization: 'BEARER rahasia-panjang' }), ENV);
  assert.equal(auth.ok, true);
});

test('secret belum dikonfigurasi menutup endpoint (503), bukan membuka', () => {
  const auth = authorizeRefresh(request({}), {} as Env);
  assert.equal(auth.ok, false);
  if (auth.ok) return;
  assert.equal(auth.status, 503);
  assert.equal(auth.error, 'refresh_not_configured');
});

test('secret lama (X-Refresh-Token) masih berfungsi sebagai laluan sokongan', () => {
  const env: Env = { MANUAL_REFRESH_TOKEN: 'lama' };
  const auth = authorizeRefresh(request({ 'X-Refresh-Token': 'lama' }), env);
  assert.equal(auth.ok, true);
});

test('bearer adalah laluan utama apabila kedua-dua secret wujud', () => {
  const env: Env = { REFRESH_API_TOKEN: 'baharu', MANUAL_REFRESH_TOKEN: 'lama' };
  assert.equal(authorizeRefresh(request({ Authorization: 'Bearer baharu' }), env).ok, true);
  assert.equal(authorizeRefresh(request({ 'X-Refresh-Token': 'lama' }), env).ok, true);
  assert.equal(authorizeRefresh(request({ 'X-Refresh-Token': 'salah' }), env).ok, false);
});

test('bearerToken menguraikan header dengan betul', () => {
  assert.equal(bearerToken(request({ Authorization: 'Bearer abc123' })), 'abc123');
  assert.equal(bearerToken(request({ Authorization: 'Basic abc123' })), '');
  assert.equal(bearerToken(request({})), '');
});

test('constantTimeEquals tidak bocor panjang', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true);
  assert.equal(constantTimeEquals('abc', 'abd'), false);
  assert.equal(constantTimeEquals('abc', 'abcd'), false);
  assert.equal(constantTimeEquals('', ''), true);
});
