/**
 * Lapisan data arkib MLBB Almanac.
 *
 * Fail JSON dijana oleh `live/tools/build_archive.py` daripada dataset dalam
 * `archive/` (repo mlbb-historical-database):
 *
 *   core.json       - 87 versi patch, 350 perubahan hero, 99 perubahan item,
 *                     133 rekod hero, 104 rekod item
 *   reference.json  - 13 jadual referensi (role, lane, emblem, spell, ...)
 *   docs.json       - 5 dokumen markdown (kamus, sejarah meta, garis masa)
 *
 * Fail ini berasingan daripada bundle JS supaya tab Hero (landskap utama)
 * tidak Weigh loads data sejarah sebelum ia perlu. `fetchJson` yang sama
 * seperti API live digunakan supaya cache memori + IndexedDB konsisten.
 */
import { fetchJson } from './client';

export interface ArchiveManifest {
  generated_at: string;
  source: string;
  counts: {
    patches: number;
    hero_changes: number;
    item_changes: number;
    heroes: number;
    items: number;
    reference_tables: number;
    documents: number;
    systems: number;
    images: number;
  };
}

export interface ArchivePatch {
  version: string;
  date: string;
  source: string;
  hero_change_count: number;
  item_change_count: number;
  /** Pecahan jenis perubahan dalam patch ini (contoh: Buff x5, Rework x2). */
  types: { type: string; count: number }[];
}

export interface ArchiveSystemNote {
  version: string;
  period: string;
  system: string;
  aspect: string;
  detail: string;
  source: string;
}

export interface ArchiveSeason {
  season?: number;
  end_date?: string;
  latest_patch?: string;
}

export interface ArchiveHeroChange {
  version: string;
  date: string;
  hero: string;
  change_type: string;
  detail: string;
  source: string;
  /** Nilai lama bila ada format "lama >> baru". */
  old_value: string;
  new_value: string;
}

export interface ArchiveItemChange {
  version: string;
  date: string;
  item: string;
  change_type: string;
  detail: string;
  source: string;
  old_value: string;
  new_value: string;
}

export interface ArchiveHero {
  hero: string;
  role: string;
  lane: string;
  release_version: string;
  release_date: string;
  price_bp: string;
  price_diamond: string;
  reworked: boolean;
  total_buffs: number;
  total_nerfs: number;
  total_adjusts: number;
  change_count: number;
  last_change_version: string;
  last_change_type: string;
  sources: string;
}

export interface ArchiveItem {
  item: string;
  category: string;
  price_gold: number;
  build_path: string;
  unique_passives: string;
  image: string | null;
  change_count: number;
  last_change_version: string;
  last_change_type: string;
  sources: string;
}

export interface ArchiveCore {
  manifest: ArchiveManifest;
  season: ArchiveSeason;
  /** Nota sistem ikut versi patch. Managersih jika sumber lama tiada kunci ini. */
  systems?: ArchiveSystemNote[];
  patches: ArchivePatch[];
  hero_changes: ArchiveHeroChange[];
  item_changes: ArchiveItemChange[];
  heroes: ArchiveHero[];
  items: ArchiveItem[];
}

export interface ArchiveTable {
  id: string;
  label: string;
  file: string;
  columns: string[];
  row_count: number;
  rows: Record<string, string>[];
}

export interface ArchiveReference {
  manifest: ArchiveManifest;
  tables: ArchiveTable[];
}

export interface ArchiveDoc {
  id: string;
  title: string;
  file: string;
  markdown: string;
}

export interface ArchiveDocs {
  manifest: ArchiveManifest;
  docs: ArchiveDoc[];
}

const BASE = '/archive';

export const archiveApi = {
  core: () => fetchJson<ArchiveCore>(`${BASE}/core.json`, { cacheKey: 'archive:core' }),
  reference: () =>
    fetchJson<ArchiveReference>(`${BASE}/reference.json`, { cacheKey: 'archive:reference' }),
  docs: () => fetchJson<ArchiveDocs>(`${BASE}/docs.json`, { cacheKey: 'archive:docs' }),
} as const;

// ------------------------------------------------------------------ indeks

export interface ArchiveIndex {
  core: ArchiveCore;
  /** Rekod arkib mengikut nama hero (tanpa huruf besar). */
  heroByName: Map<string, ArchiveHero>;
  /** Semua perubahan hero, dikelompokkan mengikut nama hero. */
  heroChangesByHero: Map<string, ArchiveHeroChange[]>;
  /** Semua perubahan item, dikelompokkan mengikut nama item. */
  itemChangesByItem: Map<string, ArchiveItemChange[]>;
  /** Perubahan mengikut versi patch (hero + item). */
  changesByVersion: Map<string, { heroes: ArchiveHeroChange[]; items: ArchiveItemChange[] }>;
  /** Nota sistem (emblem, spell, dsb) mengikut versi patch. */
  systemsByVersion: Map<string, ArchiveSystemNote[]>;
}

/** Susun versi patch secara numerik: 2.2.16 > 2.2.9 (bukan rentetan). */
export function versionSortKey(version: string): number[] {
  const matches = version.match(/\d+/g);
  return matches ? matches.map((part) => Number(part)) : [0];
}

export function compareVersions(a: string, b: string): number {
  const left = versionSortKey(a);
  const right = versionSortKey(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

export function indexArchive(core: ArchiveCore): ArchiveIndex {
  const heroByName = new Map<string, ArchiveHero>();
  for (const hero of core.heroes) heroByName.set(hero.hero.toLowerCase(), hero);

  // Cache lama (service worker) mungkin menyimpan core.json tanpa kunci
  // yang ditambah kemudian - contohnya "systems". Satu kunci yang hilang
  // tidak boleh menjatuhkan seluruh indeks, jadi setiap senarai dilindungi.
  const heroChanges = core.hero_changes ?? [];
  const itemChanges = core.item_changes ?? [];
  const systemNotes = core.systems ?? [];

  const heroChangesByHero = new Map<string, ArchiveHeroChange[]>();
  for (const change of heroChanges) {
    const key = change.hero.toLowerCase();
    const bucket = heroChangesByHero.get(key);
    if (bucket) bucket.push(change);
    else heroChangesByHero.set(key, [change]);
  }
  for (const bucket of heroChangesByHero.values()) {
    bucket.sort((a, b) => compareVersions(a.version, b.version));
  }

  const itemChangesByItem = new Map<string, ArchiveItemChange[]>();
  for (const change of itemChanges) {
    const key = change.item.toLowerCase();
    const bucket = itemChangesByItem.get(key);
    if (bucket) bucket.push(change);
    else itemChangesByItem.set(key, [change]);
  }
  for (const bucket of itemChangesByItem.values()) {
    bucket.sort((a, b) => compareVersions(a.version, b.version));
  }

  const changesByVersion = new Map<string, { heroes: ArchiveHeroChange[]; items: ArchiveItemChange[] }>();
  const bucketFor = (version: string) => {
    let bucket = changesByVersion.get(version);
    if (!bucket) {
      bucket = { heroes: [], items: [] };
      changesByVersion.set(version, bucket);
    }
    return bucket;
  };
  for (const change of heroChanges) bucketFor(change.version).heroes.push(change);
  for (const change of itemChanges) bucketFor(change.version).items.push(change);

  const systemsByVersion = new Map<string, ArchiveSystemNote[]>();
  for (const note of systemNotes) {
    const bucket = systemsByVersion.get(note.version);
    if (bucket) bucket.push(note);
    else systemsByVersion.set(note.version, [note]);
  }

  return {
    core,
    heroByName,
    heroChangesByHero,
    itemChangesByItem,
    changesByVersion,
    systemsByVersion,
  };
}

// ------------------------------------------------------------------- utiliti

/** Kategori visual untuk jenis perubahan (Buff/Nerf/Adjust/New/Rework/...). */
export function changeTypeClass(type: string): string {
  const key = (type || '').toLowerCase();
  if (key.includes('buff')) return 'buff';
  if (key.includes('nerf')) return 'nerf';
  if (key.includes('rework') || key.includes('revamp')) return 'rework';
  if (key.includes('new')) return 'new';
  if (key.includes('adjust') || key.includes('change') || key.includes('renam')) return 'adjust';
  if (key.includes('remove')) return 'remove';
  if (key.includes('replace')) return 'adjust';
  return 'neutral';
}

/** Label ringkas untuk patch: "2.2.16" -> "2.2". */
export function patchSeries(version: string): string {
  const parts = version.match(/\d+/g);
  if (!parts || parts.length < 2) return version;
  return `${parts[0]}.${parts[1]}`;
}

/** Huruf pertama nama hero, untuk avatar teks. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Slug nama hero seperti yang digunakan API live: huruf kecil, semua
 * aksara bukan alfanumerik ditukar kepada tanda hubung.
 * ("Chang'e" -> "chang-e", "Lapu-Lapu" -> "lapu-lapu").
 */
export function heroSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
