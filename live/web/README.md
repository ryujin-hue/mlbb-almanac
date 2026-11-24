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
```

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
| `/heroes/<slug>` | detail hero + sejarah imbangan |

Routing ikut **path**, bukan hash. Setiap halaman ada URL sendiri; filter
(rank, sort, carian, role/lane/damage, kad/jadual) tinggal dalam query string,
jadi setiap paparan boleh dikongsi dan butang "kembali" pelayar berfungsi.

## Kontrak dengan Worker

Laman hanya memanggil endpoint yang sama seperti Worker:

```
GET /api/meta         GET /api/heroes?rank=all     GET /api/hero?id=<slug>
GET /api/deltas?window=7d&threshold=0.5            GET /api/snapshots
GET /api/patch-notes  GET /api/tournaments
```

Arkib (sejarah patch) **tidak** melalui Worker — ia dibina sebagai JSON
statis daripada CSV arkib semasa build:

```
python3 ../tools/build_archive.py     # -> public/archive/{core,reference,docs}.json
```

## Aturan main

- Tiada dependency routing, state atau virtualisasi pihak ketiga. React +
  Vite sahaja; `router.tsx` dan `useHeroFilters.ts` cukup.
- Tiada store global. State filter berasal daripada URL, jadi tidak boleh
  rosak antara halaman.
- Tiada komponen mati. Codes yang dibuang dalam redesign (Composition,
  FilterToolbar, HeroGrid, MoversPanel, ArchivePanel, …) sudah dipadam.
- Token reka bentuk ialah satu set tetap dalam `styles.css` — jangan tambah
  warna baharu.
- Angka format `id-ID` (koma sebagai pemisah desimal).

## Aset

- Logo: `public/brand/mlbb-a.svg` (dengan panel) dan
  `public/brand/mlbb-a-transparent.svg` (untuk header).
- Ikon kecil: `public/favicon.svg`, `public/icon-192.png`,
  `public/icon-512.png`.
- Kad perkongsian: `public/brand/og-image.png`.
