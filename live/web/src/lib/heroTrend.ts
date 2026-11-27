/**
 * Normalisasi data untuk carta korelasi patch-meta.
 *
 * Dua sumber, dua bentuk:
 *   - tren live   : satu titik setiap snapshot (tarikh ISO penuh)
 *   - sejarah patch: baris arkib (tarikh "YYYY-MM-DD", kadang "2016
 *     (year-only, day UNVERIFIED)", kadang version kosong)
 *
 * Carta memerlukan dua-duanya pada paksi yang sama, jadi tarikh ditapis
 * kepada format hari sahaja. Baris yang tidak boleh dipetakan TIDAK
 * dipaksa ke tarikh fake - ia dilangkau, jadi carta tidak menunjukkan patch yang
 * tiada tarikh - dan UI tetap boleh tunjuk sejarah penuh dalam senarai.
 */
import { safeRate } from '@shared/heroKey';

export type PatchChangeType = 'buff' | 'nerf' | 'revamp' | 'adjustment';

/** Satu titik tren: rate satu hero pada satu hari. */
export interface LiveTrendPoint {
  /** Tarikh "YYYY-MM-DD". */
  date: string;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
}

/** Satu peristiwa patch yang akan dilukis sebagai garis menegak. */
export interface PatchHistoryEntry {
  /** Tarikh "YYYY-MM-DD". */
  date: string;
  /** Versi patch, contoh "2.2.16". */
  patchVersion: string;
  changeType: PatchChangeType;
  /** Ringkasan perubahan (dipangkas untuk tooltip). */
  summary: string;
  /** Source URL baris arkib - supaya tooltip boleh dipaut. */
  source?: string;
}

/** Warna marker mengikut jenis perubahan. */
export const PATCH_MARKER_COLOR: Record<PatchChangeType, string> = {
  buff: '#34D399',
  nerf: '#F87171',
  revamp: '#F5C518',
  adjustment: '#F5C518',
};

/** Label pendek untuk tooltip. */
export const PATCH_CHANGE_LABEL: Record<PatchChangeType, string> = {
  buff: 'Buff',
  nerf: 'Nerf',
  revamp: 'Rework',
  adjustment: 'Adjustment',
};

/**
 * Tukar apa-apa bentuk tarikh kepada "YYYY-MM-DD", atau null.
 *
 *   "2026-11-11"                 -> "2026-11-11"
 *   "2026-11-26T13:12:35.117Z"   -> "2026-11-26"   (timestamp snapshot)
 *   "2016 (year-only, day UNVERIFIED)" -> null (tidak boleh dipetakan)
 *   ""                           -> null
 */
export function toChartDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const day = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  // Selepas hari, hanya 'T' (timestamp) atau hujung sah yang dibenarkan.
  const rest = trimmed.slice(10);
  if (rest !== '' && !rest.startsWith('T')) return null;

  return day;
}

/** Tukar jenis perubahan arkib kepada empat jenis carta. */
export function mapChangeType(raw: string | null | undefined): PatchChangeType {
  const key = (raw ?? '').toLowerCase();
  if (key.includes('buff')) return 'buff';
  if (key.includes('nerf')) return 'nerf';
  if (key.includes('rework') || key.includes('revamp')) return 'revamp';
  return 'adjustment';
}

/**
 * Normalisasi siri tren.
 *
 * - Buang titik tanpa tarikh yang sah.
 * - Buang titik yang tiada rate langsung (semuanya null) - satu baris
 *   kosong pada graf bermakna "tiada data", bukan "0%".
 * - Jika beberapa snapshot jatuh pada hari yang sama, yang terakhir
 *   disimpan (paling terkini).
 */
export function normalizeTrend(
  points: readonly { date: string; winRate: number | null; pickRate: number | null; banRate: number | null }[]
): LiveTrendPoint[] {
  const byDate = new Map<string, LiveTrendPoint>();

  for (const point of points) {
    const date = toChartDate(point.date);
    if (!date) continue;

    const winRate = safeRate(point.winRate);
    const pickRate = safeRate(point.pickRate);
    const banRate = safeRate(point.banRate);
    if (winRate === null && pickRate === null && banRate === null) continue;

    byDate.set(date, { date, winRate, pickRate, banRate });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Normalisasi sejarah patch menjadi peristiwa carta.
 *
 * Baris tanpa versi patch (contoh "Released — fighter/assassin") tidak
 * boleh dilukis pada paksi tarikh, jadi ia dilangkau.
 */
export function normalizePatchHistory(
  changes: readonly {
    version: string;
    date: string;
    change_type: string;
    detail: string;
    source?: string;
  }[]
): PatchHistoryEntry[] {
  const entries: PatchHistoryEntry[] = [];

  for (const change of changes) {
    const version = (change.version ?? '').trim();
    if (!version) continue;

    const date = toChartDate(change.date);
    if (!date) continue;

    entries.push({
      date,
      patchVersion: version,
      changeType: mapChangeType(change.change_type),
      summary: (change.detail ?? '').trim(),
      ...(change.source ? { source: change.source } : {}),
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

/** Pangkas ringkasan untuk tooltip - potong di Ruang, tambah "…". */
export function truncateSummary(summary: string, maxLength = 90): string {
  const trimmed = summary.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Kumpulkan PatchHistoryEntry mengikut tarikh untuk carian tooltip. */
export function groupPatchHistoryByDate(
  entries: readonly PatchHistoryEntry[]
): Map<string, PatchHistoryEntry[]> {
  const grouped = new Map<string, PatchHistoryEntry[]>();
  for (const entry of entries) {
    const bucket = grouped.get(entry.date);
    if (bucket) bucket.push(entry);
    else grouped.set(entry.date, [entry]);
  }
  return grouped;
}
