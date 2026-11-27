/**
 * Siri tren untuk satu hero + ekstrak matriks counter.
 *
 * Worker menyimpan snapshot immutabel (`mlbb:snap:<version>`). Setiap
 * snapshot mengandungi rate SEMUA hero pada tarikhnya, jadi satu hero
 * boleh dijurkan menjadi siri win/pick/ban dari beberapa snapshot.
 *
 * Untuk phase 2 (carta korelasi patch-meta) dan phase 3 (draft pick),
 * data ini yang memberi graf.
 */
import { canonicalHeroKey } from '../../../../packages/shared/heroKey';
import type { CounterEdge, DatasetPayload, Hero, StoredDataset } from '../types';

/** Satu titik tren: rate satu hero pada satu snapshot. */
export interface HeroTrendPoint {
  /** Versi snapshot (timestamp terukur). */
  version: string;
  /** Tarikh measurement ISO, atau tarikh simpan bila measurement tiada. */
  date: string;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  /** Tier pada masa itu - Useful untuk tooltip. */
  tier: string | null;
}

/** NaN/Infinity menjadi null; tiada data menjadi null, bukan 0. */
function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Cari hero dalam satu snapshot mengikut kunci kanonik (bukan slug sahaja). */
export function findHeroInSnapshot(payload: DatasetPayload, heroKey: string): Hero | null {
  const wanted = canonicalHeroKey(heroKey);
  if (!wanted) return null;

  const heroes = payload.heroes?.heroes ?? [];
  const direct = heroes.find((hero) => canonicalHeroKey(hero.id) === wanted);
  if (direct) return direct;

  const byName = heroes.find((hero) => canonicalHeroKey(hero.name) === wanted);
  return byName ?? null;
}

/**
 * Bina siri tren daripada senarai snapshot.
 *
 * `snapshots` boleh dalam apa-apa order - fungsi ini menyusunnya ikut
 * tarikh. Snapshot tanpa entry untuk hero itu dilangkau (bukan diisi
 * dengan 0, yang akan plotted sebagai "saya turun ke 0%").
 */
export function buildHeroTrend(snapshots: StoredDataset[], heroKey: string): HeroTrendPoint[] {
  const points: (HeroTrendPoint & { sortKey: number })[] = [];

  for (const snapshot of snapshots) {
    const hero = findHeroInSnapshot(snapshot.payload, heroKey);
    if (!hero) continue;

    const stats = hero.stats;
    const measured = snapshot.payload.manifest?.rates_summary?.measured_at_utc ?? null;
    const date = measured ?? snapshot.storedAt;
    const sortKey = Date.parse(date);
    if (!Number.isFinite(sortKey)) continue;

    points.push({
      version: snapshot.storedAt,
      date,
      winRate: finiteOrNull(stats?.win_rate),
      pickRate: finiteOrNull(stats?.pick_rate),
      banRate: finiteOrNull(stats?.ban_rate),
      tier: stats?.tier ?? null,
      sortKey,
    });
  }

  points.sort((a, b) => a.sortKey - b.sortKey);

  return points.map(({ sortKey: _sortKey, ...point }) => point);
}

/**
 * Matriks counter daripada payload semasa.
 *
 * Edge = "hero A menang lawan hero B" (atau sebaliknya). Draft simulator
 * guna ini untuk mencadangkan counter kepada hero yang dikunci lawan.
 */
export function counterEdgesOf(payload: DatasetPayload | null | undefined): CounterEdge[] {
  const edges = payload?.counters?.edges ?? [];
  return edges.filter(
    (edge) =>
      typeof edge?.from === 'string' &&
      typeof edge?.to === 'string' &&
      edge.from.length > 0 &&
      edge.to.length > 0
  );
}
