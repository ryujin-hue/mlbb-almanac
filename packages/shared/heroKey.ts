/**
 * Kunci kanonik hero.
 *
 * Tiga sumber data menulis nama hero dengan ejaan yang berbeza:
 *
 *   - arkib  : `archive/hero_master.csv`   -> "Chang'e", "Yi Sun Shin"
 *   - live   : KV snapshot                 -> "chang-e", "yi-sun-shin"
 *   - hمنا  : nama paparan UI             -> "Chang'e"
 *
 * Kalau satu padanan salah, hero hilang dari senarai, sejarah imbangan
 * tidak muncul, atau carta korelasi plotted pada paksi salah. Jadi
 * semua kunci dinormalisasi melalui satu fungsi - bukan tiga fungsi
 * yang masing-masing "hampir sama".
 *
 * Kunci kanonik: huruf kecil, tanda aksen dilenyap, apa-apa yang bukan
 * alfanumerik menjadi satu tanda hubung, tanpa hujung '-'.
 */

/** Tag yang menanda nilai yang tidak boleh disahkan silang. */
export const UNVERIFIED_TAG = 'UNVERIFIED';

/**
 * Kunci kanonik satu nama hero.
 *
 *   "Chang'e"      -> "chang-e"
 *   "Yi Sun Shin"  -> "yi-sun-shin"
 *   "X.Borg"       -> "x-borg"
 *   "Lapu-Lapu"    -> "lapu-lapu"
 */
export function canonicalHeroKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Semua kunci yang bolehinentai satu nama.
 *
 * Kunci kanonik biasanya sudah cukup, tetapi beberapa nama ada
 * prefix/suffix yang hilang dalam satu sumber sahaja - "Miya, Layla"
 * terhadap "Miya", atau "Dyrroth" terhadap "Dyrroth, The Sacred Armor".
 * Senarai ini membolehkan padanan tanpa tekaan kabur yang tidak tentu.
 */
export function canonicalHeroKeyCandidates(name: string | null | undefined): string[] {
  const key = canonicalHeroKey(name);
  if (!key) return [];

  const candidates = new Set<string>([key]);

  // Buang prefix yang sering jadi sebutan(title), bukan nama: "the ...".
  const withoutArticle = key.replace(/^the-/, '');
  if (withoutArticle && withoutArticle !== key) candidates.add(withoutArticle);

  // "miya-layla" <-> "miya-layla" (sudah sama) tetapi "miya-layla" juga
  // perlu match "miya" - jadi simpan bahagian pertama sebagai alias.
  const parts = key.split('-');
  if (parts.length > 1) {
    candidates.add(parts[0] ?? key);
    candidates.add(parts.slice(0, 2).join('-'));
  }

  return [...candidates];
}

/**
 * Adakah dua nama hero merujuk kepada hero yang sama?
 *
 * `heroKeysMatch("Chang'e", "chang-e")` -> true
 * `heroKeysMatch("Miya, Layla", "miya-layla")` -> true
 * `heroKeysMatch("Sun", "yi-sun-shin")` -> false
 */
export function heroKeysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = canonicalHeroKey(a);
  const right = canonicalHeroKey(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const rightCandidates = new Set(canonicalHeroKeyCandidates(b));
  return canonicalHeroKeyCandidates(a).some((candidate) => rightCandidates.has(candidate));
}

/**
 * Normalisasi nilai rate: NaN, Infinity, null, undefined dan string
 * bukan nombor semuanya menjadi null.
 *
 * Worker sudah menapis NaN semasa normalisasi, tapi data boleh datang
 * dari JSON yang diedit tangan, dari hujung lama, atau dari arkib.
 * `Number.isFinite` sahaja sudah menapis NaN - tetapi `Number(null)`
 * ialah 0, jadi null TIDAK boleh dilepaskan terus ke `Number()`.
 */
export function safeRate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Format rate sebagai peratus dengan 2 angka perpuluhan; null -> "—". */
export function safePercent(value: unknown, digits = 2): string {
  const rate = safeRate(value);
  if (rate === null) return '—';
  return `${rate.toFixed(digits)}%`;
}

/**
 * Adakah teks ini menanda nilai yang tidak disahkan?
 *
 * Arkib menanda baris yang tidak dapat disahkan silang dengan
 * "UNVERIFIED" dalam-band. UI mesti menunjukkannya, bukan menyembunyikan
 * atau membulatkan.
 */
export function isUnverified(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.toUpperCase().includes(UNVERIFIED_TAG);
}

/**
 * Buang tag UNVERIFIED daripada teks supaya ayatnya boleh dipaparkan
 * sebagai ayat biasa, dengan tag tetap dipaparkan berasingan.
 */
export function stripUnverifiedTag(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\[\s*UNVERIFIED\s*\]/gi, '')
    .replace(/\(\s*UNVERIFIED\s*\)/gi, '')
    .replace(/\bUNVERIFIED\b\s*[—:-]?\s*/gi, '')
    .trim();
}

/**
 * Bandingkan dua senarai kunci dan laporkan kunci yang tidak sepadan.
 *
 * Dipakai dalam test: arkib (133 nama) lawan snapshot live (133 id).
 * Hasilnya ialah apa yang TIDAK ada dalam satu sisi - bukan "hampir sama".
 */
export interface KeyAlignment {
  /** Kunci yang ada dalam kedua-dua sisi. */
  matched: string[];
  /** Kunci hanya dalam Archive. */
  archiveOnly: string[];
  /** Kunci hanya dalam Live. */
  liveOnly: string[];
  /** Peratus kunci yang sepadan, 0..1. */
  coverage: number;
}

/**
 * Bandingkan kunci arkib dengan kunci live.
 *
 * `archiveKeys` dan `liveKeys` ialah senarai kunci kanonik (hasil
 * `canonicalHeroKey`). Perbandingan ialah set-ke-set - bukan
 * "bilangan sama", supaya satu pertukaran nama tidak lulus diam-diam.
 */
export function alignKeys(archiveKeys: string[], liveKeys: string[]): KeyAlignment {
  const archive = new Set(archiveKeys.filter(Boolean));
  const live = new Set(liveKeys.filter(Boolean));

  const matched: string[] = [];
  const archiveOnly: string[] = [];
  const liveOnly: string[] = [];

  for (const key of archive) {
    if (live.has(key)) matched.push(key);
    else archiveOnly.push(key);
  }
  for (const key of live) {
    if (!archive.has(key)) liveOnly.push(key);
  }

  matched.sort();
  archiveOnly.sort();
  liveOnly.sort();

  const coverage = archive.size === 0 ? 0 : matched.length / archive.size;

  return { matched, archiveOnly, liveOnly, coverage };
}
