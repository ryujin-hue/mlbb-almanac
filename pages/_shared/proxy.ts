/**
 * Pages Function — proxy ke Worker API.
 *
 * Pages tak boleh proxy ke origin luar melalui `_redirects`, jadi `/api/*`
 * dihantar ke Worker (pemilik KV + cron + upstream fetch) dari sini.
 *
 * Faedah: browser tetap satu origin, jadi tiada CORS, tiada perubahan pada
 * client, dan `connect-src 'self'` dalam `_headers` kekal betul.
 */
export interface ProxyEnv {
  /** Asas Worker. Boleh di-set sebagai Pages env var untuk override. */
  WORKER_ORIGIN?: string;
}

export const DEFAULT_WORKER_ORIGIN = 'https://mlbb-data-workflow.mlvv.workers.dev';

/**
 * Teruskan request ke Worker. Header Range, If-Range, If-None-Match dan
 *EPT preserved supaya Range 206 untuk audio hero kekal berfungsi.
 */
export async function proxyToWorker(
  request: Request,
  env: ProxyEnv,
  pathPrefix: string,
): Promise<Response> {
  const origin = (env.WORKER_ORIGIN || DEFAULT_WORKER_ORIGIN).replace(/\/+$/, '');
  const incoming = new URL(request.url);

  // Guna pathname asal (bukan params.path) supaya segment yang mengandungi
  // koma/ruang/aksen kekal escaping dengan betul - nama folder audio ada
  // koma dan ruang ("Bruno,nolan,Fredrinn,aamon,brody").
  const target = `${origin}${pathPrefix}${incoming.pathname.slice(pathPrefix.length)}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-host');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const out = new Headers(upstream.headers);
  // Worker pulangkan Access-Control-Allow-Origin; biar harmless untuk
  // pemanggil luar yang terus kena Worker.
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
