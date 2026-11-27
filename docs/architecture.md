# Seni Bina

## Dua lapisan, satu laman

MLBB Almanac menggabungkan dua sumber yang berbeza bentuk:

| | Lapisan sejarah | Lapisan meta |
|---|---|---|
| Sumber | `archive/*.csv` | MLBBDex mirror |
| Kekerapan | sekali sehari (auto-update) | sekali sehari (cron Worker) |
| Bentuk | patch, perubahan, katalog | rate, pick/ban, tier, snapshot |
| Penghantaran | JSON statik dalam bundle web | API Worker melalui Pages Functions |

Kedua-duanya converge pada satu halaman: kad hero memaparkan kadar live
**dan** nota patch terakhir; modal hero memaparkan profil live **dan**
log perubahan arkib.

## Mengapa sejarah tidak jadi API kedua

Arsip berada dalam repositori yang sama, jadi ia boleh ditukar kepada JSON
semasa build:

```
live/tools/build_archive.py
  archive/patch_index.csv    -->  live/web/public/archive/core.json
  archive/hero_changes.csv   -->  (87 patch, 350 perubahan hero,
  archive/item_changes.csv   -->   99 perubahan item, 133 hero, 104 item)
  archive/hero_master.csv    -->
  archive/items_master.csv   -->  live/web/public/archive/reference.json
  archive/references/*.csv   -->  (13 jadual rujukan)

  archive/*.md                -->  live/web/public/archive/docs.json
  archive/images/...          -->  live/web/public/archive/img/...
```

Kelebihan:

- Tiada API kedua untuk dihos, pantau, atau caj operasi.
- Tiada sync job - JSON sentiasa konsisten dengan CSV.
- Boleh digunakan offline (service worker cache).
- Versi sejarah tidak boleh "drift" - ia ikut commit yang sama.

Kos: JSON hanya dikemas kini bila build dijalankan. `auto-update` mencetuskan
commit, push mencetuskan build, jadi kelewatan paling lama satu hari.

## Frontend

- **React + Vite**, tanpa state management luaran (Zustand untuk satu store).
- **Routing laluan** (`router.tsx`, tanpa dependency router): `/` (senarai
  hero), `/heroes`, `/heroes/<hero>`, `/meta`, `/movers`, `/patches`,
  `/patches/<versi>`, `/patch-notes`, `/items`, `/data`. Server menyervis
  `index.html` untuk laluan SPA (Pages `_redirects`, Worker
  `not_found_handling`).
- **Keadaan filter dalam URL** (`data/useHeroFilters.ts`): rank, sort, arah,
  carian, role/lane/tipe damage, mod kad/jadual, tempoh movers dan ambang
  delta. Setiap paparan boleh dikongsi, butang "kembali" pelayar berfungsi
  seperti biasa. Tiada state global - Zustand dibuang.
- **Arkib dimuat lazy**: `core.json` (303 KB) diambil selari dengan API live;
  `reference.json` dan `docs.json` hanya diambil bila halaman Data dibuka.
- **Rate dihitung semula di client** (`applyRankScope`) supaya ganti rank
  tidak memicu request ulang dan grid tidak flicker.
- **Kad hero** (kad atau jadual) - tiada virtualizer; 133 kad dimuat sekali
  sahaja, cukup kecil untuk satu halaman.

## Worker

- Cloudflare Worker + KV (`MLBB_KV`).
- Cron `0 2 * * *` (02:00 UTC) - ambil upstream, normalkan, simpan snapshot.
- Static assets `./site`, `run_worker_first = ["/audio/*"]` supaya Worker
  sendiri yang perlu slice fail audio dan pulangkan **206 + Content-Range**
  (Workers Static Assets sahaja menghantar 200 penuh; Safari/iOS perlukan
  Range).

## Pages

Pages tidak boleh proksi origin luar (`_redirects`: "You cannot proxy
external domains"). Jadi `pages/functions/` memproksi `/api/*` dan `/audio/*`
ke Worker. Browser kekal satu origin - tiada CORS, tiada perubahan client,
`connect-src 'self'` kekal.

Tiga fungsi Pages:

| Fungsi | Tujuan |
|---|---|
| `api/[[path]].ts` | proksi ke Worker |
| `audio/[[path]].ts` | proksi ke Worker (Range 206 dikekalkan) |
| `heroes/[hero_name]/og.ts` | kad Open Graph 1200x630 PNG |

### Kad OG

Kad dijana **pada masa permintaan**, bukan semasa build - supaya kadar
win/pick/ban sentiasa mengikut snapshot terkini.

- Rasterizer: `resvg-wasm` (WASM tulen - jalan dalam Workers tanpa Node).
  Modul WASM diimport terus; `wrangler.jsonc` perlukan rule
  `CompiledWasm`, tanpanya bundle jadi 2.4 MB.
- Font: DejaVu Sans Bold (lesen permissive) di dalam `site/og/` -
  Worker/Workers tiada font sistem, jadi font mesti datang sendiri.
- Portrait: PNG arkib daripada repo awam (`raw.githubusercontent.com`).
  Portrait live ialah WebP, dan resvg tidak boleh decode WebP - jadi
  imej arkib (PNG) yang digunakan.
- Semua sumber (hero, arkib, portrait, font) di-cache dalam Cache API
  Cloudflare.
- Hero tidak dijumpai -> kad lalai, tetap PNG (bukan 404 HTML).

`pages/wrangler.jsonc` (bukan `.toml`) - wrangler 4.152 mengabaikan
`wrangler.toml` dalam subdirektori dan mengambil `wrangler.jsonc` yang paling
dekat di direktori kerja semasa.

## Endpoint Worker

| Endpoint | Fungsi |
|---|---|
| `GET /api/meta` | status runtime, patch semasa, jumlah hero |
| `GET /api/heroes?rank=` | senarai hero + kadar + tier |
| `GET /api/hero?id=` | detail satu hero |
| `GET /api/hero-trend?id=&limit=` | siri win/pick/ban satu hero merentas snapshot |
| `GET /api/counters` | matriks counter ("from" menang lawan "to") |
| `GET /api/deltas?window=&threshold=` | movers antara dua snapshot |
| `GET /api/snapshots` | senarai versi snapshot |
| `GET /api/patch-notes` | artikel MLBB Hub |
| `GET /api/tournaments` | jadual MLBB (PandaScore) |
| `POST /api/refresh` | refresh manual - **Bearer `REFRESH_API_TOKEN`** |

`POST /api/refresh` DITUTUP bila `REFRESH_API_TOKEN` tiada (503). Versi
lama membenarkan semua orang; refresh menulis ke KV, jadi ia mesti sentiasa
proving. `GET /api/refresh` kini 405.

## Kunci hero

Tiga sumber menulis nama hero dengan ejaan berbeza: arkib (`Chang'e`),
live KV (`chang-e`), UI (`Chang'e`). Semuanya dinormalisasi melalui satu
fungsi - `packages/shared/heroKey.ts` - supaya senarai, sejarah imbangan
dan carta tidak hilang hero.

Testnya membandingkan `archive/hero_master.csv` (133 nama) dengan id dalam
snapshot live (133 id) dan menuntut **100% keselarasan** - bukan "hampir
sama".

## Perkara yang mudah pecah

- **Config wrangler**: config dalam subdirektori hanya dibaca jika ia
  `wrangler.jsonc` dan berada dalam direktori kerja semasa.
- **Dua deploy Cloudflare serentak** menghasilkan rate limit 10429. Kedua
  workflow guna concurrency group `cloudflare-deploy`.
- **Service worker**: aset statik cache-first. Naikkan `VERSION` dalam
  `sw.js` bila nama aset berubah.
- **Perbandingan "rata-rata ikut bracket"** mesti dibuat pada nilai penuh,
  bukan string paparan 1 desimal - dua bracket boleh sama-sama dipaparkan
  "50,0%" walaupun nilai sebenar berbeza.
- **Baris CSV ragged**: `DictReader` menghasilkan key `None` untuk kolum
  berlebihan. Buang key itu sebelum menulis semula.
- **Tarikh arkib tidak seragam**: 46 baris `hero_changes` bertarikh
  "2016 (year-only, day UNVERIFIED)" dan 83 baris tiada versi patch. Baris
  seperti itu dilangkau dalam carta - bukan dipaksa ke tarikh fake.
- **NaN dalam rate**: `Number(null)` ialah 0, jadi `null` tidak boleh
  dilepaskan terus ke `Number()`. `safeRate()` dalam `packages/shared`
  menapis NaN, Infinity, null dan string bukan nombor.

## Sumber luar (Worker)

Worker ialah satu-satunya tempat yang memanggil API luar, supaya tiada CORS
dan tiada token dalam client.

- **Patch notes MLBB Hub** (`worker/src/lib/patch-notes.ts`): baca
  `mlbbhub.com/news/sitemap.xml` (publik) dan halaman artikel, ambil
  `ld+json` + badan `<article class="prose-article">`. Robots mlbbhub
  membenarkan `/news/` tetapi **melarang `/api/`** - jadi Worker tidak pernah
  memanggil API mereka. Cache di KV, disegarkan cron 02:00 UTC,
  stale-while-revalidate untuk pelawat.
- **Turnamen PandaScore** (`worker/src/lib/tournaments.ts`):
  `api.pandascore.co/mlbb/tournaments/upcoming` dengan
  `Authorization: Bearer <PANDASCORE_API_TOKEN>` (secret Worker). Tanpa
  token, endpoint pulangkan `available: false` + sebab `no_token` - bukan
  ralat 500 dan bukan senarai kosong yang pembaca tersalah baca sebagai
  "tiada solen". Liputan MLBB PandaScore jarang: kalau `upcoming` kosong,
  Worker jatuh balik kepada `past?sort=-begin_at` dan tandai
  `scope: 'recent'` (UI bertukar tajuk kepada "Turnamen terkini").

## Secret Worker dalam CI

Input `secrets:` pada `cloudflare/wrangler-action@v3` mencari **nama**
pemboleh ubah persekitaran, bukan nilainya - secret GitHub tidak boleh
digunakan terus di situ ("Value for secret X not found in environment").
Langkah CI sendiri menggunakan API Cloudflare:

```
PUT https://api.cloudflare.com/client/v4/accounts/{acct}/workers/scripts/mlbb-data-workflow/secrets
{"name":"PANDASCORE_API_TOKEN","text":"...","type":"secret_text"}
```

## Cache service worker

`sw.js` menyimpan arkib JSON dalam cache shell. Bila bentuk `core.json`
berubah (kunci baharu ditambah), cache lama masih dihidapkan dan client
jatuh pada "core.systems is not iterable" - halaman Patch dan Item mati
tanpa cara pulih. Dua langkah wajib:

1. Naikkan `VERSION` dalam `sw.js` (cache lama dipadam).
2. Arkib JSON dilayan stale-while-revalidate, jadi salinan lapuk pulih
   sendiri pada lawatan seterusnya.

Selain itu, `indexArchive` memperlakukan setiap senarai sebagai pilihan
(`core.systems ?? []`) supaya fail lama degrade kepada nota yang kurang,
bukan exception.
