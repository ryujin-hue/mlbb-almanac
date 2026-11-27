/**
 * Ujian kad Open Graph.
 *
 *   npx vitest run live/pages
 *
 * Menguji dua perkara:
 *   1. SVG yang dibina betul (escape, kandungan, warna tier).
 *   2. SVG itu benar-benar boleh dirasterize kepada PNG 1200x630 dengan
 *      font yang dibekalkan - supaya kad tidak berubah kepada kotak
 *      kosong apabila dilayan.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

import {
  OG_HEIGHT,
  OG_WIDTH,
  buildFallbackSvg,
  buildOgSvg,
  statusLabel,
  tierColor,
  type OgHeroCard,
} from '../_shared/og-card';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const CARD: OgHeroCard = {
  name: 'Alucard',
  title: 'The Shadow',
  tier: 'S+',
  roles: ['Fighter', 'Assassin'],
  winRate: 49.27,
  pickRate: 0.44,
  banRate: 0.28,
  status: 'buffed',
  patchVersion: '2.2.23',
  measuredAt: '2026-11-24',
  sourceUrl: 'https://mlbb-almanac.pages.dev/heroes/alucard',
};

let fontBytes: Uint8Array;

beforeAll(async () => {
  fontBytes = new Uint8Array(
    readFileSync(resolve(REPO_ROOT, 'live/web/public/og/DejaVuSans-Bold.ttf'))
  );
  await initWasm(
    readFileSync(
      resolve(REPO_ROOT, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')
    ) as unknown as ArrayBuffer
  );
});

describe('buildOgSvg', () => {
  it('mengandungi nama hero, tier dan ketiga-tiga rate', () => {
    const svg = buildOgSvg(CARD);
    expect(svg).toContain('Alucard');
    expect(svg).toContain('S+');
    expect(svg).toContain('49.27%');
    expect(svg).toContain('0.44%');
    expect(svg).toContain('0.28%');
    expect(svg).toContain('BUFFED');
    expect(svg).toContain('2.2.23');
  });

  it('saiz kad 1200x630', () => {
    const svg = buildOgSvg(CARD);
    expect(svg).toContain(`width="${OG_WIDTH}"`);
    expect(svg).toContain(`height="${OG_HEIGHT}"`);
  });

  it('escape aksara XML dalam nama hero', () => {
    const svg = buildOgSvg({ ...CARD, name: 'A & B <script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('A &amp; B &lt;script&gt;');
  });

  it('guna blok inisial apabila portrait tiada', () => {
    const svg = buildOgSvg({ ...CARD, portraitDataUri: null, name: 'Miya Layla' });
    expect(svg).toContain('>ML<');
    expect(svg).not.toContain('<image');
  });

  it('meletakkan portrait sebagai data URI apabila ada', () => {
    const svg = buildOgSvg({
      ...CARD,
      portraitDataUri: 'data:image/png;base64,AAAA',
    });
    expect(svg).toContain('data:image/png;base64,AAAA');
  });

  it('kad lalai tetap mengandungi jenama', () => {
    const svg = buildFallbackSvg();
    expect(svg).toContain('MLBB ALMANAC');
    expect(svg).toContain(`width="${OG_WIDTH}"`);
  });
});

describe('warna tier', () => {
  it('S+ dan S guna emas, A cyan, B dan C kelabu', () => {
    expect(tierColor('S+')).toBe('#F5C518');
    expect(tierColor('S')).toBe('#F5C518');
    expect(tierColor('A')).toBe('#00E5FF');
    expect(tierColor('B')).toBe('#8B9BB4');
    expect(tierColor(null)).toBe('#8B9BB4');
  });
});

describe('statusLabel', () => {
  it('tiga status sahaja', () => {
    expect(statusLabel('buffed')).toBe('BUFFED');
    expect(statusLabel('nerfed')).toBe('NERFED');
    expect(statusLabel('stable')).toBe('STABLE');
  });
});

describe('rasterizer', () => {
  it('menghasilkan PNG yang sah', () => {
    const svg = buildOgSvg(CARD);
    const png = new Resvg(svg, {
      fitTo: { mode: 'original' },
      font: {
        fontBuffers: [fontBytes],
        loadSystemFonts: false,
        defaultFontFamily: 'DejaVu Sans',
      },
    })
      .render()
      .asPng();

    expect(png.byteLength).toBeGreaterThan(1000);
    // Tanda tangan PNG.
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    // Simpan untuk semakan visual.
    const outDir = resolve(REPO_ROOT, 'output');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'og-card-alucard.png'), png);
  });

  it('kad lalai juga boleh dirasterize', () => {
    const png = new Resvg(buildFallbackSvg(), {
      font: { fontBuffers: [fontBytes], loadSystemFonts: false },
    })
      .render()
      .asPng();
    expect(png.byteLength).toBeGreaterThan(500);
  });
});
