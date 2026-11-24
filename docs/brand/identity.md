# Identiti Jenama - MLBB Almanac

## Nama

**MLBB Almanac.** "Almanac" = buku rujukan. Ia promise yang tepat: buku
rujukan, bukan papan kadar kadar. Nama ini juga jujur - "almanac" sendiri
tidak menjanjikan data *live*, jadi kadar dan sejarah boleh tinggal dalam
satu tempat tanpa menipu.

Alternatif yang dipertimbangkan:

- *MLBB Ledger* -akaun, terlalu kecil untuk merangkumi sejarah.
- *MLBB Compendium* -terlalu panjang untuk logo dan untuk dicari.
- *Meta Almanac* -kehilangan "MLBB" dalam nama; sukar dicari, dan "meta"
  sudah dipakai pemain untuk layer atas meta anyways.

## Palet

| Token | Hex | Guna |
|---|---|---|
| Base | `#0B0F1A` | latar, panel |
| Panel | `#111726` / `#1A2236` | permukaan, hover |
| Cyan | `#00E5FF` | aksen, sel menyala, data live |
| Gold | `#F5C518` | tier, penanda aktif, taip |
| Hijau | `#3DDC97` | buff, naik |
| Merah | `#FF5C6C` | nerf, turun |

Tiada warna lain. Cyan bermaksud "sedang berlaku", gold bermaksud
"keputusan".

## Logo

Dua bentuk, dua tugas.

**Wordmark origami "MLBB-A"** (`brand/mlbb-a.svg`) - bentuk utama. Huruf
dilipat daripada keping kertas, emas dan perak, dengan bayang lembut supaya
setiap lipatan dibaca sebagai muka yang berlainan. Ia membawa nama "MLBB"
dan "Almanac" (A) dalam satu baris, jadi tidak perlu teks tambahan di
sebelahnya.

| Bahagian | Warna |
|---|---|
| Emas (M, B pertama, A) | `#f3c65f` `#d49b27` `#b47b14` |
| Perak (L, B kedua, tanda sempang) | `#f8fafc` `#e2e8f0` `#cbd5e1` `#94a3b8` |
| Panel logo | `#101d35` |

Wordmark ini sengaja membawa ramp emas-perak sendiri, bukan token UI.
Token cyan `#00E5FF` dan gold `#F5C518` ialah bahasa *data* - status,
tier, patch - dan tidak dilute oleh warna logo.

**Ikon 12 sel** (`brand/mark.svg`) - bentuk kedua. 12 sel: 3 kolum x 4 baris.
Grid 24 unit; kolum x = 2, 9, 16; baris y = 3, 8, 13, 18; setiap sel
6 x 2.5 unit. Satu sel menyala - sel terakhir dalam urutan baca (baris 4,
kolum 3) - cyan `#00E5FF`, melambangkan entri terkini dalam senarai
kronologi.

Ikon ini hanya untuk saiz kecil: favicon 16px, ikon PWA 192/512. Origami
tidak boleh dibaca pada 16px, jadi ia tidak pernah menggantikan wordmark.

Fail:

| Fail | Guna |
|---|---|
| `live/web/public/brand/mlbb-a.svg` | wordmark dengan panel latar |
| `live/web/public/brand/mlbb-a-transparent.svg` | wordmark lutsinar (header laman) |
| `live/web/public/brand/og-image.png` | kad perkongsian 1200x630 |
| `live/web/public/almanac-mark.svg`, `favicon.svg`, `icon-192/512.png` | ikon kecil |
| `docs/brand/assets/` | salinan untuk dokumen dan brand board |

## Nada suara

- **Tabulated** - data dalam jadual, bukan perenggan.
- **Current** - sentiasa tunjuk patch dan timestamp terkini.
- **Sourced** - setiap baris arkib ada pautan sumbernya.
- **Unadorned** - tiada emoji, tiada hype, tiada kata-kata hias.

Bahasa UI: Bahasa Indonesia. Copy jenama: Bahasa Inggeris. Kedua-duanya
memang berbeza - UI ini untuk pemain, jenama untuk produk.

## Tagline

- Pendek (≤6 perkataan): **Ten years of patches. Today's meta.**
- Sederhana (≤10 perkataan): **Complete patch history and live meta for every hero.**
- Eksplisit: **Every patch since 2016 and today's live meta, in one almanac.**

## Rujukan domain

`mlbbalmanac.com` (utama), `almanac.gg` (pendek), `mlbb-almanac.dev`
(teknikal). Domain belum dipasang - akaun Cloudflare tiada zon DNS.
