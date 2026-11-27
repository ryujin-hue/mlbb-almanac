#!/usr/bin/env node
/**
 * Server pengembangan + mock Worker API.
 *
 * Menyajikan hasil build `site/` DAN mengimplementasikan endpoint yang sama
 * dengan Worker Cloudflare, memakai normalizer yang sama. Jadi perilaku
 * lokal = perilaku produksi, tanpa perlu deploy.
 *
 *   node --experimental-strip-types --import ./worker/tests/register-ts.mjs \
 *        tools/dev-server.mjs [port]
 *
 * Endpoint:
 *   GET /api/heroes?rank=all|epic|legend|mythic|honor|glory
 *   GET /api/hero?id=<heroId>
 *   GET /api/deltas?window=1d|7d|30d
 *   GET /api/snapshots
 *   GET /api/meta
 *   GET /api/hero-trend?id=<heroId>
 *   GET /api/counters
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeBundleToDataset } from '../worker/src/lib/normalize.ts';
import { buildMetaMovers, computeDeltas, toSlimHeroes } from '../worker/src/lib/deltas.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const PORT = Number(process.argv[2] ?? 5173);
const UPSTREAM = 'https://raw.githubusercontent.com/achedon12/mlbb/develop';

const PATHS = {
  heroes: '/src/data/game/heroes.json',
  skills: '/src/data/game/skills.json',
  statistics: '/src/data/game/statistics.json',
  items: '/src/data/game/items.json',
  visuals: '/src/data/game/visuals.json',
  sync: '/src/data/game/sync.json',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

let datasetPromise = null;

/** Dataset di-cache sekali per proses: fetch upstream itu mahal (3+ MB). */
function loadDataset() {
  if (!datasetPromise) datasetPromise = fetchDataset();
  return datasetPromise;
}

async function fetchDataset() {
  const entries = await Promise.all(
    Object.entries(PATHS).map(async ([key, path]) => {
      const res = await fetch(`${UPSTREAM}${path}`);
      if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
      return [key, await res.json()];
    })
  );
  const bundle = Object.fromEntries(entries);
  const payload = normalizeBundleToDataset(bundle, UPSTREAM);
  return {
    payload,
    storedAt: new Date().toISOString(),
    version: payload.manifest.generated_at_utc ?? 'dev',
  };
}

function json(res, body, status = 200) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const target = join(SITE, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(SITE)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    // SPA fallback.
    const index = join(SITE, 'index.html');
    if (existsSync(index)) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(readFileSync(index));
      return;
    }
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
    'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(readFileSync(target));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === '/api/heroes') {
      const rank = searchParams.get('rank') ?? 'all';
      const { payload, storedAt } = await loadDataset();
      return json(res, {
        heroes: toSlimHeroes(payload.heroes.heroes, rank),
        manifest: {
          schema_version: payload.manifest.schema_version,
          generated_at_utc: payload.manifest.generated_at_utc,
          game_patch: payload.manifest.game_patch,
          counts: payload.manifest.counts,
          rates_summary: payload.manifest.rates_summary ?? null,
          sources: payload.manifest.sources,
          warnings: payload.manifest.warnings,
        },
        runtime: { storedAt },
      });
    }

    if (pathname === '/api/hero') {
      const id = searchParams.get('id');
      if (!id) return json(res, { error: 'missing_id' }, 400);
      const { payload, storedAt } = await loadDataset();
      const hero = payload.heroes.heroes.find((h) => h.id === id);
      if (!hero) return json(res, { error: 'hero_not_found' }, 404);
      return json(res, {
        hero,
        counters: {
          edges: payload.counters.edges.filter((e) => e.from === id || e.to === id),
        },
        items: {
          items: payload.items.items.filter((item) => {
            const best = (item.best_for ?? '').toLowerCase();
            return best.includes(hero.name.toLowerCase()) || best.includes('all heroes');
          }),
        },
        runtime: { storedAt },
      });
    }

    if (pathname === '/api/deltas') {
      const window = searchParams.get('window') ?? '7d';
      // Dev server tidak punya riwayat snapshot; jawaban jujur, bukan angka
      // karangan. Bentuknya sama dengan Worker supaya client tidak perlu
      // menebak dari status code.
      return json(res, {
        available: false,
        reason: 'no_history',
        message:
          'Dev server tidak menyimpan riwayat snapshot. Worker menyimpan satu versi per refresh harian.',
        window,
        threshold: 0.5,
        from: { version: 'none', measured_at_utc: null, stored_at: null },
        to: { version: 'dev', measured_at_utc: null },
        actual_days: null,
        approximate: false,
        oldest_available_days: null,
        rising: [],
        falling: [],
        steady: 0,
        new_heroes: [],
        deltas: [],
      });
    }

    if (pathname === '/api/snapshots') {
      // Bentuk sama seperti Worker: counts mengikut dataset sebenar, bukan 0.
      const { storedAt, version, payload } = await loadDataset();
      return json(res, {
        entries: [
          {
            version,
            measured_at_utc: version,
            stored_at: storedAt,
            counts: payload.manifest.counts,
          },
        ],
      });
    }

    // Tren satu hero - dev server hanya ada satu snapshot, jadi siri
    // pendek dibina daripada dataset semasa (bentuk sama seperti Worker).
    if (pathname === '/api/hero-trend') {
      const id = url.searchParams.get('id') || '';
      const { storedAt, version, payload } = await loadDataset();
      const hero = (payload.heroes.heroes || []).find(
        (entry) => entry.id === id || entry.name === id,
      );
      const stats = hero?.stats ?? null;
      const measured = payload.manifest?.rates_summary?.measured_at_utc ?? null;
      const points = hero
        ? [
            {
              version,
              date: measured ?? storedAt,
              winRate: stats.win_rate ?? null,
              pickRate: stats.pick_rate ?? null,
              banRate: stats.ban_rate ?? null,
              tier: stats.tier ?? null,
            },
          ]
        : [];
      return json(res, {
        available: points.length > 0,
        hero: id,
        count: points.length,
        points,
      });
    }

    // Matriks counter.
    if (pathname === '/api/counters') {
      const { payload } = await loadDataset();
      const edges = (payload.counters?.edges ?? []).map((edge) => ({
        from: edge.from,
        to: edge.to,
        strength: edge.strength ?? null,
        advantage: edge.advantage_points ?? null,
        source: edge.source ?? null,
      }));
      return json(res, {
        available: true,
        count: edges.length,
        edges,
        generated_at_utc: payload.manifest?.generated_at_utc ?? null,
      });
    }

    // Patch notes MLBB Hub - dev server tidak menarik mlbbhub.com, jadi
    // bentuk jawapan mengekalkan bentuk sebenar (available, articles).
    if (pathname === '/api/patch-notes') {
      return json(res, {
        available: true,
        source: 'MLBB Hub (mlbbhub.com)',
        source_url: 'https://mlbbhub.com/news/',
        fetched_at: new Date().toISOString(),
        count: 0,
        articles: [],
      });
    }

    // Turnamen PandaScore - tanpa token, jawapan jujur dengan sebab.
    if (pathname === '/api/tournaments') {
      return json(res, {
        available: false,
        source: 'PandaScore',
        source_url: 'https://api.pandascore.co/mlbb/tournaments/upcoming',
        fetched_at: new Date().toISOString(),
        count: 0,
        tournaments: [],
        reason: 'no_token',
        message: 'Token PandaScore belum ditetapkan (secret PANDASCORE_API_TOKEN).',
      });
    }

    if (pathname === '/api/meta') {
      const { payload, storedAt } = await loadDataset();
      return json(res, {
        status: 'live',
        source: 'MLBBDex GitHub mirror',
        patch: payload.manifest.game_patch,
        totalHeroes: payload.manifest.counts.heroes,
        lastUpdated: payload.manifest.generated_at_utc,
        lastAttemptAt: storedAt,
        nextUpdateAt: null,
        scheduleUtc: 'dev',
        lastError: null,
      });
    }

    return serveStatic(req, res, pathname);
  } catch (error) {
    return json(res, { error: 'server_error', message: String(error) }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev server + mock API: http://127.0.0.1:${PORT}`);
});
