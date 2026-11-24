<div align="center">
  <img src="../docs/brand/assets/mlbb-a.svg" alt="MLBB Almanac" width="360" />
</div>

# MLBB Almanac — Live Layer

Bahasa Indonesia · [English monorepo README](../README.md)

Lapisan "sekarang" bagi **MLBB Almanac**: kadar win, pick dan ban yang langsung,
tier, snapshot harian, catatan patch MLBB Hub, dan jadual sukan MLBB.
Semuanya datang dari Worker; laman hanya membaca.

## Isi folder ini

```
worker/          Cloudflare Worker — API, KV, cron 02:00 UTC
  src/index.ts     router utama (/api/*)
  src/lib/         store, deltas, counters, patch-notes, tournaments, audio-range
  tests/           16 unit tests (vitest)
web/             React 19 + Vite — laman
  src/pages/       Meta, Heroes, Movers, Patches, Items, Data, Patch Notes
  src/components/  shell (topnav/bottomnav), panel, ui, tournament
  src/data/        client, AlmanacContext, archive index, URL-state hooks
pages/           Cloudflare Pages Functions — proxy /api/* dan /audio/* ke Worker
tools/           build_archive.py, dev-server.mjs, fetch_patch_notes.py
tests/           smoke_test_v2.py (88 semakan), production_check.py (70 semakan)
```

Bahan warisan daripada projek "MLBB Meta & Counter" yang lama masih ada di
folder ini (`site/`, `extract_mlbb_data.py`, `templates/`, `run_termux.sh`),
tetapi **tidak lagi deployed**. Sumber kebenaran ialah `worker/`, `web/`,
`pages/`.

## Endpoint Worker

Semua panggilan keluar dibuat oleh Worker — tiada token pihak ketiga dalam
pelayar.

| Endpoint | Fungsi |
|---|---|
| `GET /api/meta` | status runtime, patch semasa, jumlah hero |
| `GET /api/dataset` | kontrak penuh `manifest + heroes + counters + items + maps` |
| `GET /api/heroes?rank=all` | senarai hero dengan kadar, pick, ban, tier |
| `GET /api/hero?id=<slug>` | detail satu hero |
| `GET /api/snapshots` | senarai versi snapshot tersimpan |
| `GET /api/deltas?window=7d&threshold=0.5` | perubahan tier/kadar antara dua snapshot |
| `GET /api/patch-notes` | artikel patch notes MLBB Hub (dari sitemap awam) |
| `GET /api/tournaments` | jadual sukan MLBB (PandaScore) |
| `POST /api/refresh` | refresh manual (perlu token) |

Kunci KV: `mlbb:dataset:latest`, `mlbb:meta:latest`, `mlbb:snap:*`,
`mlbb:patch-notes:v3:latest`, `mlbb:tournaments:latest`.

## Cron dan snapshot

- Cron Worker: **02:00 UTC** setiap hari → ambil data upstream, normalisasi,
  simpan snapshot baharu dan kemas kini `mlbb:dataset:latest`.
- `GET /api/deltas` bandingkan snapshot semasa dengan yang lama — di situlah
  data Movers berasal.
- `mlbb:patch-notes` disegarkan pada cron yang sama dengan
  stale-while-revalidate, jadi pelawat tidak perlu menunggu scrape.

## Audio hero

`/audio/<slug>.mp3` dilayan Worker dengan `Range` 206 supaya pemain boleh
lompat ke awal. Pages Functions hanya meneruskan — Pages tidak boleh
melayani Range sendiri.

## Jalankan secara lokal

```bash
# 1. arkib -> JSON (perlu dijalankan sebelum build web)
python3 tools/build_archive.py

# 2. build laman
cd web && npm install && npm run build

# 3. mock API Worker tanpa Cloudflare
cd .. && node --experimental-strip-types --import ./worker/tests/register-ts.mjs \
    tools/dev-server.mjs 5178
```

## Uji

```bash
cd live
python3 tests/smoke_test_v2.py                                        # 88 semakan, browser
QA_BASE=https://mlbb-almanac.pages.dev python3 tests/production_check.py   # 70 semakan, live
cd worker && npx vitest run                                          # 16 unit tests
```

## Yang perlu diketahui

- **MLBB Hub tidak boleh dipanggil melalui API mereka** — robots.txt mereka
  melarang `/api/`. Worker hanya membaca sitemap `/news/` dan halaman
  artikel. Setiap artikel mengekalkan pautan ke asalnya.
- **Liputan PandaScore bagi MLBB jarang** — `upcoming` lazimnya kosong.
  Worker jatuh balik kepada `past?sort=-begin_at` dan menandakan
  `scope: 'recent'`, jadi tajuk panel berubah kepada "Turnamen terkini".
- **Cache service worker mesti dinaikkan** setiap kali bentuk
  `archive/core.json` berubah, jika tidak pelawat melihat JSON lama.

## Sumber

- MLBBDex mirror (`achedon12/mlbb`) — CC BY-SA 4.0
- Mobile Legends Wiki — bagi imej dan rujukan
- MLBB Hub — artikel patch notes (tulisan rakan)
- PandaScore — jadual sukan MLBB

Tidak berafiliasi dengan Moonton.
