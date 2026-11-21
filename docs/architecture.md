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

- **React + Vite**, tanpa state management luaran (Zustand untuk dua store).
- **Tab**: Hero, Tim, Movers, Patch, Item, Data.
- **Arkib dimuat lazy**: `core.json` (273 KB) diambil selari dengan API live;
  `reference.json` dan `docs.json` hanya diambil bila tab Data dibuka.
- **Rate dihitung semula di client** (`applyRankScope`) supaya ganti rank
  tidak memicu request ulang dan grid tidak flicker.
- **Virtualizer** (`@tanstack/react-virtual`) untuk grid hero - senarai
  133 kad bergambar.

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

`pages/wrangler.jsonc` (bukan `.toml`) - wrangler 4.152 mengabaikan
`wrangler.toml` dalam subdirektori dan mengambil `wrangler.jsonc` yang paling
dekat di direktori kerja semasa.

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
