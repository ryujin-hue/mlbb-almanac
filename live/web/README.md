<div align="center">
  <img src="../../docs/brand/assets/mlbb-a.svg" alt="MLBB Almanac" width="340" />
</div>

# MLBB Almanac — Web

React 19 + TypeScript + Vite. Output ditulis ke `../site` (folder yang
di-serve Cloudflare Worker dan Cloudflare Pages).

Bahasa Indonesia · [English monorepo README](../../README.md)

```bash
npm install
npm run dev      # dev server Vite
npm run build    # typecheck + build ke ../site
npm run typecheck
npm test         # 60 semakan - component + DOM (vitest + testing-library)
```

Tailwind v4 dipakai untuk komponen baharu sahaja: `theme.css` +
`utilities.css` diimport **tanpa preflight**, jadi reset Tailwind tidak
menyentuh mana-mana halaman sedia ada. Token warna dipetakan ke token
CSS yang sama (`bg-surface`, `text-muted`, `border-line`) - satu sistem
warna, bukan dua.

## Struktur

```
src/
  App.tsx                 shell, routing, pemuatan data, footer
  router.tsx              router path tanpa dependency (currentPath, navigate, matchRoute)
  main.tsx                entry + registrasi service worker
  styles.css              token reka bentuk, mobile-first, tema gelap
  data/
    client.ts             fetch + cache memori untuk /api/*
    AlmanacContext.tsx    provider: arkib, meta API, snapshot, status, muat semula
    archive.ts            indeks arkib (core/reference/docs) + heroSlug()
    useHeroFilters.ts     state filter dalam query string
    store.ts              pembantu tulen sahaja (tiada store global)
  lib/
    format.ts             format tarikh, nombor, tanda
    heroAudio.ts         URL audio hero
  components/
    shell.tsx             TopNav (desktop) + BottomNav (mobile) + jenama
    ui.tsx                PatchTag, TierBadge, Panel, Stat, Sheet, EmptyState, ErrorState
    TournamentPanel.tsx   jadual sukan MLBB daripada PandaScore
    Markdown.tsx          render .md ringkas
    ReferenceSection.tsx  jadual rujukan
  pages/                  satu fail satu laluan
  components/
    HeroMetaCorrelationChart.tsx  carta patch vs meta (Recharts, dimuat lazy)
    DraftPickSimulator.tsx        draf 5v5
    ErrorBoundary.tsx             boundary ralat untuk ciri baharu
  lib/
    heroTrend.ts          normalisasi data carta (tulen, diuji)
    draft.ts              state machine draf + heuristik (tulen, diuji)
```

## Laluan

| Laluan | Halaman |
|---|---|
| `/` `/heroes` | senarai hero — kad atau jadual |
| `/meta` | ringkasan meta |
| `/movers` | hero yang naik / turun |
| `/patches` `/patches/<version>` | senarai patch dan detail satu patch |
| `/patch-notes` | artikel patch notes MLBB Hub |
| `/items` | katalog 104 item |
| `/data` | status dataset, snapshot, arkib, katalog API |
| `/heroes/<slug>` | detail hero: Overview, Balance history, Patch vs meta |
| `/draft` | Draft Pick Simulator 5v5 - keadaan dalam URL |

Routing ikut **path**, bukan hash. Setiap halaman ada URL sendiri; filter
(rank, sort, carian, role/lane/damage, kad/jadual) tinggal dalam query string,
jadi setiap paparan boleh dikongsi dan butang "kembali" pelayar berfungsi.

## Kontrak dengan Worker

Laman hanya memanggil endpoint yang sama seperti Worker:

```
GET /api/meta         GET /api/heroes?rank=all     GET /api/hero?id=<slug>
GET /api/hero-trend?id=<slug>&limit=14             GET /api/counters
GET /api/deltas?window=7d&threshold=0.5            GET /api/snapshots
GET /api/patch-notes  GET /api/tournaments
```

`/api/hero-trend` menyusun siri win/pick/ban satu hero daripada snapshot
KV (setiap snapshot ialah rate semua hero pada tarikhnya).
`/api/counters` memulangkan matriks counter - draft simulator guna ia
untuk mencadangkan counter kepada hero yang dikunci lawan.

Arkib (sejarah patch) **tidak** melalui Worker — ia dibina sebagai JSON
statis daripada CSV arkib semasa build:

```
python3 ../tools/build_archive.py     # -> public/archive/{core,reference,docs}.json
```

## Aturan main

- Tiada dependency routing, state atau virtualisasi pihak ketiga. React +
  Vite sahaja; `router.tsx` dan `useHeroFilters.ts` cukup.
- Recharts hanya untuk carta korelasi, dan ia dimuat **secara lazy** -
  bundle utama kekal ~94 KB, manakala chunk carta ~429 KB diambil
  hanya bila tab "Patch vs meta" dibuka.
- Tiada store global. State filter berasal daripada URL, jadi tidak boleh
  rosak antara halaman.
- Tiada komponen mati. Codes yang dibuang dalam redesign (Composition,
  FilterToolbar, HeroGrid, MoversPanel, ArchivePanel, …) sudah dipadam.
- Token reka bentuk ialah satu set tetap dalam `styles.css` — jangan tambah
  warna baharu.
- Angka format `id-ID` (koma sebagai pemisah desimal).

## Ujian

```bash
npm test                       # semua (vitest, jsdom)
npx vitest run tests/draft.test.ts
```

Fail DOM memasang `// @vitest-environment jsdom` di baris pertama.
Ujian lived dalam `live/web` (bukan root) - supaya React hanya ada satu
salinan; dua salinan akan pecahkan hooks.

## Aset

- Logo: `public/brand/mlbb-a.svg` (dengan panel) dan
  `public/brand/mlbb-a-transparent.svg` (untuk header).
- Font kad OG: `public/og/DejaVuSans-Bold.ttf` (+ lesen).
- Ikon kecil: `public/favicon.svg`, `public/icon-192.png`,
  `public/icon-512.png`.
- Kad perkongsian: `public/brand/og-image.png`.
