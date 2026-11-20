/**
 * Pages Function — `/api/*` -> Worker API.
 * Lihat `pages/_shared/proxy.ts` untuk penjelasan seni bina.
 */
import { proxyToWorker, type ProxyEnv } from '../../_shared/proxy';

export const onRequest: PagesFunction<ProxyEnv> = ({ request, env }) =>
  proxyToWorker(request, env, '/api');
