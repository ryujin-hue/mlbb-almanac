# MLBB Almanac

> Every patch since 2016 and today's live meta, in one almanac.

Kumpulan data dan laman web Mobile Legends: Bang Bang. Dua hal dalam satu
fail: **sejarah** (87 versi patch, 350 perubahan hero, 99 perubahan item,
104 item, 13 jadual rujukan) dan **meta live** (win rate, pick/ban, tier,
snapshot harian).

| | |
|---|---|
| **Laman** | https://mlbb-almanac.pages.dev |
| **Worker (API + KV)** | https://mlbb-data-workflow.mlvv.workers.dev |
| **Arkib (FastAPI)** | `archive/api/` - 78 endpoint, jalankan lokal |

## Struktur

```
archive/            mlbb-historical-database - sejarah patch, hero, item, rujukan
  api/              FastAPI (78 endpoint) + pemHebah mirror statik
  scripts/          update_data.py (auto-update harian), build_api_artifacts.py
  tests/            21 semakan pytest
  *.csv             patch_index, hero_changes, item_changes, hero_master, items_master
  references/       13 jadual rujukan (role, lane, emblem, spell, ...)
  images/           683 imej bersumber

live/               mlbb-data-workflow - meta live + laman web
  web/              React + Vite (UI produção)
  worker/           Cloudflare Worker: KV, cron 02:00 UTC, API
  pages/            Pages Functions: proksi /api/* dan /audio/* ke Worker
  shared/ -> dipindah ke packages/shared/
  tools/            dev-server.mjs (mock API), build_archive.py (penjana arkib)
  tests/            smoke_test_v2.py (88 semakan), production_check.py (29 semakan)

packages/shared/    kod kongsi antara worker dan web (tier, types)
docs/               identiti jenama, seni bina, kamus
```

### Kenapa monorepo

`archive/` dan `live/` tinggal dalam satu repositori supaya **laman web boleh
membaca sejarah terus semasa build** - tiada API kedua, tiada sync job, tiada
data lapuk. `live/tools/build_archive.py` menukar CSV arkib kepada JSON +
imej dalam `live/web/public/archive/`, dan `web/` memuatnya secara lazy.

## Aliran data

```
archive/*.csv ──> live/tools/build_archive.py ──> live/web/public/archive/*.json
                                                       │
                  MLBBDex mirror ──> Worker (KV) ───────┴──> Pages Functions ──> Browser
```

## Development

```bash
# Arkib -> JSON untuk laman
cd live && python3 tools/build_archive.py

# Laman (mock API lokal, tanpa Cloudflare)
cd live/web && npm install && npm run build
cd .. && node --experimental-strip-types --import ./worker/tests/register-ts.mjs \
    tools/dev-server.mjs 5178

# Semakan
cd live && python3 tests/smoke_test_v2.py                       # 88 semakan
QA_BASE=https://mlbb-almanac.pages.dev python3 tests/production_check.py
```

## CI

| Workflow | Bila |Apa |
|---|---|---|
| `auto-update` | cron 18:00 UTC | kemas kini dataset arkib, commit auto |
| `QA Site` | setiap push | unit test worker, typecheck, build, smoke test 88 semakan |
| `QA Production` | cron 03:00 UTC | cek terus kedua-dua situs live (29 semakan) |
| `Deploy Pages` | push | `live/` -> Cloudflare Pages |
| `Deploy Worker + Site` | push | `live/worker` -> Cloudflare Workers |

Dua deploy Cloudflare guna concurrency group yang sama (`cloudflare-deploy`) -
API Cloudflare rate-limit (code 10429) bila dua deploy serentak.

## Data & lesen

Meta live dari [MLBBDex mirror](https://github.com/achedon12/mlbb) (CC BY-SA
4.0 via Mobile Legends Wiki). Arkib disusun daripada sumber awam dengan
rujukan pada setiap baris (lihat tab **Data** di laman). Tidak berafiliasi
dengan Moonton.
