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

12 sel: 3 kolum x 4 baris. Grid 24 unit; kolum x = 2, 9, 16; baris
y = 3, 8, 13, 18; setiap sel 6 x 2.5 unit. Satu sel menyala - sel
terakhir dalam urutan baca (baris 4, kolum 3) - cyan `#00E5FF`,
melambangkan entri terkini dalam senarai kronologi.

Logo ini berfungsi sebagai: favicon 16px, ikon PWA 192/512, tanda di kepala
laman, dan diganding dengan wordmark `MLBB ALMANAC`. Tiada bentuk bulat,
tiada gradien, tiada unsur playful.

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
