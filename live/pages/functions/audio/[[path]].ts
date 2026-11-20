/**
 * Pages Function — `/audio/*` -> Worker (yang pulangkan 206 + Content-Range).
 *
 * Hero lagu perlu Range untuk Safari/iOS. Pages static assets tak boleh
 * dipercayai untuk Range, jadi route ini dihantar ke Worker yang memang
 * sudah ada implementasinya (`worker/src/lib/audio-range.ts`).
 */
import { proxyToWorker, type ProxyEnv } from '../../_shared/proxy';

export const onRequest: PagesFunction<ProxyEnv> = ({ request, env }) =>
  proxyToWorker(request, env, '/audio');
