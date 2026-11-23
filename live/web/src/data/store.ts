/**
 * Helper tulen untuk senarai hero.
 *
 * Tiada state global: keadaan filter kini hidup dalam URL (lihat
 * `data/useHeroFilters`), jadi setiap paparan boleh dikongsi dan butang
 * "kembali" pelayar berfungsi seperti biasa.
 */
import { applyRankScope } from './client';
import type { HeroDelta, RatesSummary, SlimHero } from './client';

export const RANK_OPTIONS = [
  { value: 'all', label: 'All Ranks' },
  { value: 'epic', label: 'Epic' },
  { value: 'legend', label: 'Legend' },
  { value: 'mythic', label: 'Mythic' },
  { value: 'honor', label: 'Honor' },
  { value: 'glory', label: 'Mythical Glory' },
] as const;

export const WINDOW_OPTIONS = [
  { value: '1d', label: '1 hari' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
] as const;

export type SortKey =
  | 'win_rate'
  | 'pick_rate'
  | 'ban_rate'
  | 'tier_score'
  | 'name'
  | 'release_year'
  | 'patch_changes';

export interface SortOption {
  value: SortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'tier_score', label: 'Tier Score' },
  { value: 'win_rate', label: 'Win Rate' },
  { value: 'pick_rate', label: 'Pick Rate' },
  { value: 'ban_rate', label: 'Ban Rate' },
  { value: 'name', label: 'Nama' },
  { value: 'release_year', label: 'Tahun Rilis' },
  { value: 'patch_changes', label: 'Nota Patch' },
];

/** Paparan senarai hero: kad atau jadual. */
export type HeroViewMode = 'cards' | 'table';

// --------------------------------------------------------------- selectors

export interface FilteredHero extends SlimHero {
  /** Delta terhadap snapshot pembanding (bisa null). */
  delta: HeroDelta | null;
  trend: 'rising' | 'falling' | 'steady' | 'new' | null;
}

export interface FilterInput {
  heroes: SlimHero[];
  deltas: Map<string, HeroDelta>;
  /** Bracket rank aktif; angka rate/tier dihitung ulang sesuai bracket ini. */
  rank: string;
  query: string;
  roles: string[];
  lanes: string[];
  damageTypes: string[];
  sort: SortKey;
  desc: boolean;
  threshold: number;
  /** Bilangan nota patch arkib mengikut hero id (untuk sort "Nota Patch"). */
  archiveChanges?: Map<string, number>;
}

function matches(hero: SlimHero, input: FilterInput): boolean {
  if (input.roles.length > 0 && !input.roles.some((r) => hero.roles.includes(r))) return false;
  if (input.lanes.length > 0 && !input.lanes.some((l) => hero.lanes.includes(l))) return false;
  if (
    input.damageTypes.length > 0 &&
    !input.damageTypes.includes(hero.damage_type ?? 'Unknown')
  ) {
    return false;
  }
  if (input.query) {
    const haystack = [hero.name, hero.title, hero.id, ...hero.roles, ...hero.speciality]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(input.query.toLowerCase())) return false;
  }
  return true;
}

function valueFor(hero: SlimHero, key: SortKey, input: FilterInput): number | string {
  switch (key) {
    case 'win_rate':
      return hero.win_rate ?? -1;
    case 'pick_rate':
      return hero.pick_rate ?? -1;
    case 'ban_rate':
      return hero.ban_rate ?? -1;
    case 'tier_score':
      return hero.tier_score ?? -999;
    case 'release_year':
      return hero.release_year ?? 0;
    case 'name':
      return hero.name;
    case 'patch_changes':
      return input.archiveChanges?.get(hero.id) ?? 0;
  }
}

/** Filter + sort + lampirkan delta dalam satu kali lintasan. */
export function selectHeroes(input: FilterInput): FilteredHero[] {
  const out: FilteredHero[] = [];

  for (const raw of input.heroes) {
    // Angka rate/tier mengikuti bracket rank yang dipilih. Dihitung ulang di
    // client supaya ganti rank tidak perlu request ulang.
    const hero = applyRankScope(raw, input.rank);
    if (!matches(hero, input)) continue;
    const delta = input.deltas.get(hero.id) ?? null;
    const trend = delta ? delta.trend : null;
    out.push({ ...hero, delta, trend });
  }

  const direction = input.desc ? -1 : 1;
  out.sort((a, b) => {
    const left = valueFor(a, input.sort, input);
    const right = valueFor(b, input.sort, input);
    if (typeof left === 'string' || typeof right === 'string') {
      return String(left).localeCompare(String(right)) * direction;
    }
    if (left === right) return a.name.localeCompare(b.name);
    return (left - right) * direction;
  });

  return out;
}

/** Ringkasan untuk KPI di halaman Meta. */
export function summarize(heroes: SlimHero[], summary: RatesSummary | null, rank = 'all') {
  // Ringkasan DIHITUNG ULANG di client untuk bracket yang dipilih. Kalau
  // summary dari server (yang selalu scope "all") dipakai untuk bracket
  // Mythic, labelnya jadi bohong: angkanya scope "all" tapi ditulis
  // "Mythic".
  const scoped = rank === 'all' ? heroes : heroes.map((h) => applyRankScope(h, rank));
  const rated = scoped.filter((h) => h.win_rate !== null);

  const avgWinRate =
    rated.length > 0 ? rated.reduce((sum, h) => sum + (h.win_rate ?? 0), 0) / rated.length : null;

  // Rata-rata win rate per role. Satu hero bisa punya lebih dari satu role,
  // jadi nilainya ikut dihitung di setiap role-nya.
  const roleBuckets = new Map<string, number[]>();
  for (const hero of rated) {
    const value = hero.win_rate ?? 0;
    const roles = hero.roles.length > 0 ? hero.roles : ['Unknown'];
    for (const role of roles) {
      const bucket = roleBuckets.get(role);
      if (bucket) bucket.push(value);
      else roleBuckets.set(role, [value]);
    }
  }
  const avgWinRateByRole: Record<string, number> = {};
  for (const [role, values] of roleBuckets) {
    avgWinRateByRole[role] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  const mostBanned = scoped
    .filter((h) => h.ban_rate !== null)
    .sort((a, b) => (b.ban_rate ?? 0) - (a.ban_rate ?? 0))[0];

  const mostPicked = scoped
    .filter((h) => h.pick_rate !== null)
    .sort((a, b) => (b.pick_rate ?? 0) - (a.pick_rate ?? 0))[0];

  return {
    avgWinRate,
    avgWinRateByRole,
    mostBanned: mostBanned
      ? { id: mostBanned.id, name: mostBanned.name, value: mostBanned.ban_rate ?? 0 }
      : null,
    mostPicked: mostPicked
      ? { id: mostPicked.id, name: mostPicked.name, value: mostPicked.pick_rate ?? 0 }
      : null,
    rated: rated.length,
    total: heroes.length,
    // Nilai dari server disimpan untuk pembanding, dipakai panel transparansi.
    serverAvgWinRate: summary?.avg_win_rate ?? null,
  };
}
