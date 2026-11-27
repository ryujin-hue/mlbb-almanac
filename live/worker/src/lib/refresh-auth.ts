/**
 * Auth untuk `POST /api/refresh`.
 *
 * Refresh manual menulis ke KV, jadi ia mesti Sentiasa proving. Versi
 * lama membenarkan semua orang yang tahu endpoint itu - untuk operasi
 * yang menulis, itu terlalu longgar.
 *
 * Laluan:
 *   1. `Authorization: Bearer <REFRESH_API_TOKEN>`  (utama)
 *   2. `X-Refresh-Token: <MANUAL_REFRESH_TOKEN>`    (sokongan, secret lama)
 *
 * Tiada secret = endpoint ditutup (503), bukan dibuka.
 */
import type { Env } from '../types';

/**
 * Bandingkan dua token constant-time.
 *
 * Panjang tidak bocor: kedua-dua sisi digratekan ke panjang yang sama
 * sebelum dibandingkan, jadi `length` tidak memberitahu pemanggil
 * berapa panjang token yang betul.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export type RefreshAuth =
  | { ok: true }
  | { ok: false; status: number; error: string; message: string };

/** Token daripada header `Authorization: Bearer ...` (tanpacase, tanpa ruang). */
export function bearerToken(request: Request): string {
  const header = (request.headers.get('Authorization') ?? '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

/**
 * Periksa request refresh.
 *
 * Kembalikan `{ ok: true }` atau `{ ok: false, status, error, message }`.
 * `status` 401 = token salah/tiada; 503 = secret belum dikonfigurasi.
 */
export function authorizeRefresh(request: Request, env: Env): RefreshAuth {
  const bearer = bearerToken(request);
  const headerToken = (request.headers.get('X-Refresh-Token') ?? '').trim();

  const secret = env.REFRESH_API_TOKEN?.trim();
  if (secret) {
    if (bearer && constantTimeEquals(bearer, secret)) return { ok: true };

    const legacy = env.MANUAL_REFRESH_TOKEN?.trim();
    if (legacy && headerToken && constantTimeEquals(headerToken, legacy)) return { ok: true };

    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: 'Hantar Authorization: Bearer <REFRESH_API_TOKEN>.',
    };
  }

  const legacy = env.MANUAL_REFRESH_TOKEN?.trim();
  if (legacy) {
    if (headerToken && constantTimeEquals(headerToken, legacy)) return { ok: true };
    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: 'Hantar X-Refresh-Token: <MANUAL_REFRESH_TOKEN>.',
    };
  }

  return {
    ok: false,
    status: 503,
    error: 'refresh_not_configured',
    message:
      'Secret REFRESH_API_TOKEN belum ditetapkan pada Worker - refresh manual dikunci sehingga secret itu wujud.',
  };
}
