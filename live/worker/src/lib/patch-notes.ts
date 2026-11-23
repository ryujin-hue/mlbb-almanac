/**
 * Patch notes daripada MLBB Hub.
 *
 * Sumber: https://mlbbhub.com/news/ - robots.txt mlbbhub membenarkan /news/
 * tetapi LARANG /api/, jadi Worker ini tidak pernah memanggil API mereka:
 * ia baca sitemap news (publik) dan halaman artikel, lalu ambil metadata
 * berstruktur (ld+json) + badan teks dari <article class="prose-article">.
 *
 * Semua kandungan kekal milik MLBB Hub; Almanac hanya memaut ke sumber.
 */

const SITEMAP_URL = 'https://mlbbhub.com/news/sitemap.xml';
const NEWS_BASE = 'https://mlbbhub.com/news/';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Versi kunci:_naik apabila bentuk atau URL imej berubah supaya cache
// lama tidak bercampur.
export const PATCH_NOTES_KEY = 'mlbb:patch-notes:v2:latest';
export const PATCH_NOTES_MAX_AGE_SECONDS = 60 * 60 * 12;

/** Versi patch: 2.1.70, 2.2.16a, 1.9.90 */
const VERSION_RE = /\b(\d+\.\d+\.\d+[a-z]?)\b/;

/**
 * Slug yang mengandungi "patch" tetapi BUKAN patch notes (tier list, guide
 *lane). Elak supaya senarai patch notes tidak bercampur dengan tier list.
 */
const EXCLUDE_RE = /tier[- ]?list|build guide|guide|combo|rotation|roaming guide/i;

export interface PatchNoteArticle {
  version: string | null;
  title: string;
  url: string;
  published_at: string | null;
  summary: string;
  image: string | null;
  blocks: { kind: 'h' | 'p'; text: string }[];
}

export interface PatchNotesPayload {
  available: boolean;
  source: string;
  source_url: string;
  fetched_at: string;
  count: number;
  articles: PatchNoteArticle[];
  message?: string;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 12s: satu halaman yang perlahan tak boleh tahan keseluruhan refresh.
async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function isPatchArticle(slug: string): boolean {
  if (!slug.includes('patch')) return false;
  if (EXCLUDE_RE.test(slug.replace(/[-_]/g, ' '))) return false;
  return true;
}

function extractLdJson(html: string): Record<string, unknown> | null {
  const blocks = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!blocks) return null;
  for (const block of blocks) {
    const raw = block.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(raw.trim());
      const type = (data as { '@type'?: string })['@type'];
      if (type === 'NewsArticle' || type === 'Article' || type === 'BlogPosting') {
        return data as Record<string, unknown>;
      }
    } catch {
      // blok bukan JSON - langkau
    }
  }
  return null;
}

function extractBody(html: string): { kind: 'h' | 'p'; text: string }[] {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i);
  const region = article ? article[0] : html;
  const blocks: { kind: 'h' | 'p'; text: string }[] = [];
  const seen = new Set<string>();

  const pattern = /<(h2|h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(region)) !== null) {
    const tag = (match[1] ?? '').toLowerCase();
    const text = cleanText(match[2] ?? '');
    if (text.length < 12) continue;
    if (/\{min-width|Advertisement|self\.__next_s/i.test(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    blocks.push({ kind: tag.startsWith('h') ? 'h' : 'p', text });
    if (blocks.length >= 80) break;
  }
  return blocks;
}

/**
 * Imej artikel datang melalui wsrv.nl (proxy imej) selalunya pada lebar
 * 3840px - terlalu besar untuk satu kad. Hadkan lebar supaya halaman patch
 * notes tidak menari Hundreds of megabytes.
 */
function normalizeImage(raw: string): string {
  // Atribut HTML mengandungi entity (&amp;) - tanpa ini, query string rosak.
  const url = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  if (!url.includes('wsrv.nl')) return url;
  if (/[?&]w=\d+/.test(url)) return url.replace(/([?&])w=\d+/, '$1w=640');
  return `${url}${url.includes('?') ? '&' : '?'}w=640`;
}

/**
 * Host yang dibenarkan untuk imej artikel. Banner iklan dalam badan
 * artikel datang dari CDN Moonton (akmweb.youngjoygame.com) - itu bukan
 * ilustrasi artikel, jadi ia dilangkau.
 */
const IMAGE_HOSTS = ['esportpedia.b-cdn.net', 'wsrv.nl'];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function extractImage(html: string, meta: Record<string, unknown>): string | null {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i);
  const region = article ? article[0] : html;

  const sources = [...region.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)]
    .map((match) => match[1])
    .filter((url): url is string => Boolean(url));

  for (const source of sources) {
    const url = normalizeImage(source);
    if (IMAGE_HOSTS.some((host) => hostOf(url).endsWith(host))) return url;
  }

  const image = meta.image;
  if (image && typeof image === 'object' && 'url' in image) {
    const url = (image as { url?: string }).url;
    if (typeof url === 'string') return normalizeImage(url);
  }
  return null;
}

async function parseArticle(url: string): Promise<PatchNoteArticle | null> {
  const html = await fetchText(url);
  const meta = extractLdJson(html);
  if (!meta) return null;

  const title = cleanText(String(meta.headline ?? ''));
  if (!title) return null;

  const version = VERSION_RE.exec(title)?.[1] ?? null;
  const blocks = extractBody(html);
  const summary =
    cleanText(String(meta.description ?? '')) || (blocks[0]?.text ?? '');

  return {
    version,
    title,
    url,
    published_at: typeof meta.datePublished === 'string' ? meta.datePublished : null,
    summary,
    image: extractImage(html, meta),
    blocks,
  };
}

/**
 * Tarik patch notes terkini. Gagal pada mana-mana artikel individu tidak
 * menggagalkan keseluruhan - artikel lain masih dipulangkan.
 */
/** Jalankan kerja dengan had konkurensi ( Worker hanya ada CPU time terhad). */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function fetchPatchNotes(limit = 40): Promise<PatchNotesPayload> {
  const xml = await fetchText(SITEMAP_URL);
  const urls = [...new Set((xml.match(/<loc>([^<]+)<\/loc>/g) ?? []).map((m) => m.replace(/<\/?loc>/g, '')))];
  const patchUrls = urls.filter((u) => {
    const slug = u.replace(NEWS_BASE, '');
    return isPatchArticle(slug);
  });

  // Tarik secara selari dengan had konkurensi: 80 artikel satu per satu
  // mengambil terlalu lama pada lawatan pertama.
  const candidates = patchUrls.slice(0, 80);
  const parsed = await mapWithLimit(candidates, 6, async (url) => {
    try {
      return await parseArticle(url);
    } catch (error) {
      console.warn('[patch-notes] skip', url, String(error));
      return null;
    }
  });

  const articles: PatchNoteArticle[] = [];
  for (const item of parsed) {
    // Patch notes = ada nombor versi, atau tajuknya menyebut "patch notes".
    // Artikel meta/jungle lain yang kebetulan ada "patch" dalam slug
    // tidak layak masuk senarai.
    if (item && (item.version || /patch\s*notes/i.test(item.title))) articles.push(item);
    if (articles.length >= limit) break;
  }

  articles.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));

  return {
    available: articles.length > 0,
    source: 'MLBB Hub (mlbbhub.com)',
    source_url: 'https://mlbbhub.com/news/',
    fetched_at: new Date().toISOString(),
    count: articles.length,
    articles,
  };
}

export async function readPatchNotes(kv?: KVNamespace): Promise<PatchNotesPayload | null> {
  if (!kv) return null;
  return (await kv.get<PatchNotesPayload>(PATCH_NOTES_KEY, 'json')) ?? null;
}

export async function writePatchNotes(
  kv: KVNamespace | undefined,
  payload: PatchNotesPayload
): Promise<void> {
  if (!kv) return;
  await kv.put(PATCH_NOTES_KEY, JSON.stringify(payload), {
    expirationTtl: 60 * 60 * 24 * 7,
  });
}

export async function isPatchNotesStale(payload: PatchNotesPayload | null): Promise<boolean> {
  if (!payload || !payload.fetched_at) return true;
  const age = Date.now() - new Date(payload.fetched_at).getTime();
  return !Number.isFinite(age) || age > PATCH_NOTES_MAX_AGE_SECONDS * 1000;
}
