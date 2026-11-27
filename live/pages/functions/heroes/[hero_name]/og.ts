/**
 * Pages Function - kad Open Graph satu hero.
 *
 *   GET /heroes/<slug>/og   ->  image/png 1200x630
 *
 * Data diambil daripada tiga sumber:
 *   1. Worker API `/api/hero?id=`  - nama, tier, kadar win/pick/ban
 *   2. Arkib statik `core.json`    - patch terakhir yang menyentuh hero
 *   3. Imej arkib (PNG)            - portrait, daripada repo awam
 *
 * Semua tiga di-cache dalam Cache API Cloudflare, jadi kad yang sama tidak
 * di-fetch semula untuk setiap perkongsian.
 */
import {
  buildFallbackSvg,
  buildOgSvg,
  type OgHeroCard,
  type OgStatus,
} from '../../../_shared/og-card';
import { renderOgPng } from '../../../_shared/og-render';
import { DEFAULT_WORKER_ORIGIN } from '../../../_shared/proxy';

interface OgEnv {
  WORKER_ORIGIN?: string;
}

/** TTL cache (detik) bagi setiap sumber. */
const CACHE_TTL = {
  hero: 600,
  archive: 3600,
  portrait: 86400,
  font: 86400,
} as const;

/** Repo awam yang holds imej arkib - sumber portrait PNG. */
const ARCHIVE_RAW_BASE =
  'https://raw.githubusercontent.com/ryujin-hue/mlbb-almanac/main/archive/images/heroes';

/** Font - diletakkan dalam aset statik laman supaya tiada CDN luar. */
const FONT_PATH = '/og/DejaVuSans-Bold.ttf';

interface HeroApiResponse {
  hero?: {
    name?: string;
    title?: string | null;
    roles?: string[];
    portrait_url?: string | null;
    stats?: {
      tier?: string | null;
      win_rate?: number | null;
      pick_rate?: number | null;
      ban_rate?: number | null;
    } | null;
  };
}

interface ArchiveCore {
  hero_changes?: {
    hero: string;
    version: string;
    date: string;
    change_type: string;
  }[];
}

function canonicalKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch dengan cache.
 *
 * Cache API Cloudflare hanya boleh menyimpan response 200 jadi ralat
 * tidak dikongsi - request seterusnya cuba lagi.
 */
async function cachedFetch(
  request: Request,
  cacheKey: string,
  ttlSeconds: number
): Promise<Response | null> {
  const cache = caches.default;
  const key = new Request(cacheKey, { method: 'GET' });

  const hit = await cache.match(key);
  if (hit) return hit;

  const response = await fetch(request);
  if (!response.ok) return null;

  const copy = response.clone();
  await cache.put(
    key,
    new Response(copy.body, {
      status: 200,
      headers: {
        'Cache-Control': `public, max-age=${ttlSeconds}`,
        'Content-Type': copy.headers.get('Content-Type') ?? 'application/octet-stream',
      },
    })
  );

  return response;
}

/** Status patch terakhir untuk hero: buffed / nerfed / stable. */
function statusOfLastChange(
  changes: ArchiveCore['hero_changes'],
  heroName: string
): { status: OgStatus; version: string | null } {
  const wanted = canonicalKey(heroName);
  const related = (changes ?? []).filter(
    (change) => canonicalKey(change.hero) === wanted && change.version
  );
  if (related.length === 0) return { status: 'stable', version: null };

  const sorted = [...related].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const last = sorted[sorted.length - 1];
  const type = (last?.change_type ?? '').toLowerCase();

  let status: OgStatus = 'stable';
  if (type.includes('buff')) status = 'buffed';
  else if (type.includes('nerf')) status = 'nerfed';

  return { status, version: last?.version ?? null };
}

export const onRequest: PagesFunction<OgEnv> = async ({ params, request, env }) => {
  const rawName = params.hero_name;
  const slug = decodeURIComponent(
    Array.isArray(rawName) ? (rawName[0] ?? '') : (rawName ?? '')
  ).trim();
  const origin = new URL(request.url).origin;
  const workerOrigin = (env.WORKER_ORIGIN || DEFAULT_WORKER_ORIGIN).replace(/\/+$/, '');

  try {
    // 1. Font.
    const fontResponse = await cachedFetch(
      new Request(`${origin}${FONT_PATH}`),
      `${origin}${FONT_PATH}`,
      CACHE_TTL.font
    );
    if (!fontResponse) throw new Error('font tidak ditemui');
    const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());

    // 2. Hero daripada Worker.
    const heroResponse = await cachedFetch(
      new Request(`${workerOrigin}/api/hero?id=${encodeURIComponent(slug)}`),
      `${workerOrigin}/api/hero?id=${encodeURIComponent(slug)}`,
      CACHE_TTL.hero
    );

    let card: OgHeroCard | null = null;

    if (heroResponse?.ok) {
      const payload = (await heroResponse.json()) as HeroApiResponse;
      const hero = payload.hero;
      if (hero?.name) {
        // 3. Arkib - patch terakhir.
        let status: OgStatus = 'stable';
        let patchVersion: string | null = null;
        try {
          const archiveResponse = await cachedFetch(
            new Request(`${origin}/archive/core.json`),
            `${origin}/archive/core.json`,
            CACHE_TTL.archive
          );
          if (archiveResponse?.ok) {
            const core = (await archiveResponse.json()) as ArchiveCore;
            const found = statusOfLastChange(core.hero_changes, hero.name);
            status = found.status;
            patchVersion = found.version;
          }
        } catch {
          // Arkib tidak tersedia - kad dilukis tanpa status patch.
        }

        // 4. Portrait PNG daripada repo awam.
        let portraitDataUri: string | null = null;
        const portraitName = `${canonicalKey(hero.name)}.png`;
        try {
          const portraitResponse = await cachedFetch(
            new Request(`${ARCHIVE_RAW_BASE}/${portraitName}`),
            `${ARCHIVE_RAW_BASE}/${portraitName}`,
            CACHE_TTL.portrait
          );
          if (portraitResponse?.ok) {
            const bytes = new Uint8Array(await portraitResponse.arrayBuffer());
            let binary = '';
            for (const byte of bytes) binary += String.fromCharCode(byte);
            portraitDataUri = `data:image/png;base64,${btoa(binary)}`;
          }
        } catch {
          // Portrait tidak wajib - kad tetap dilukis dengan blok inisial.
        }

        card = {
          name: hero.name,
          title: hero.title ?? null,
          tier: hero.stats?.tier ?? null,
          roles: hero.roles ?? [],
          winRate: hero.stats?.win_rate ?? null,
          pickRate: hero.stats?.pick_rate ?? null,
          banRate: hero.stats?.ban_rate ?? null,
          status,
          patchVersion,
          measuredAt: null,
          portraitDataUri,
          sourceUrl: `${origin}/heroes/${encodeURIComponent(slug)}`,
        };
      }
    }

    const svg = card ? buildOgSvg(card) : buildFallbackSvg(`${origin}/heroes`);
    const png = await renderOgPng(svg, fontBytes);

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800',
        'Content-Length': String(png.byteLength),
      },
    });
  } catch (error) {
    // Kad lalai tetap PNG - ralat tidak boleh bocor sebagai HTML.
    try {
      const fallbackSvg = buildFallbackSvg(null);
      const fontResponse = await fetch(new Request(`${origin}${FONT_PATH}`));
      const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
      const png = await renderOgPng(fallbackSvg, fontBytes);
      return new Response(png, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=600',
          'X-Og-Error': String(error).slice(0, 120),
        },
      });
    } catch {
      return new Response('OG unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      });
    }
  }
};
