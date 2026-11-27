import { describe, expect, it } from 'vitest';

import {
  groupPatchHistoryByDate,
  mapChangeType,
  normalizePatchHistory,
  normalizeTrend,
  toChartDate,
  truncateSummary,
} from '../src/lib/heroTrend';

describe('toChartDate', () => {
  it('terima format hari sahaja', () => {
    expect(toChartDate('2026-11-11')).toBe('2026-11-11');
  });

  it('tolak tarikh yang tidak boleh dipetakan', () => {
    expect(toChartDate('2016 (year-only, day UNVERIFIED)')).toBeNull();
    expect(toChartDate('')).toBeNull();
    expect(toChartDate(null)).toBeNull();
    expect(toChartDate('11/11/2026')).toBeNull();
  });

  it('terima timestamp ISO dan ambil bahagian hari', () => {
    expect(toChartDate('2026-11-26T13:12:35.117Z')).toBe('2026-11-26');
    expect(toChartDate('2026-11-26T13:12:35+08:00')).toBe('2026-11-26');
  });
});

describe('mapChangeType', () => {
  it('empat jenis carta', () => {
    expect(mapChangeType('Buff')).toBe('buff');
    expect(mapChangeType('Nerf')).toBe('nerf');
    expect(mapChangeType('Rework')).toBe('revamp');
    expect(mapChangeType('Adjust')).toBe('adjustment');
    expect(mapChangeType('New')).toBe('adjustment');
    expect(mapChangeType(null)).toBe('adjustment');
  });
});

describe('normalizeTrend', () => {
  it('buang titik tanpa sebarang rate (bukan plotted sebagai 0)', () => {
    const points = normalizeTrend([
      { date: '2026-01-01', winRate: null, pickRate: null, banRate: null },
      { date: '2026-01-02', winRate: 50, pickRate: null, banRate: null },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]?.date).toBe('2026-01-02');
  });

  it('ganti titik apabila beberapa snapshot jatuh pada hari yang sama', () => {
    const points = normalizeTrend([
      { date: '2026-01-01', winRate: 10, pickRate: 1, banRate: 2 },
      { date: '2026-01-01', winRate: 20, pickRate: 3, banRate: 4 },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]?.winRate).toBe(20);
  });

  it('susun mengikut tarikh', () => {
    const points = normalizeTrend([
      { date: '2026-03-01', winRate: 1, pickRate: 1, banRate: 1 },
      { date: '2026-01-01', winRate: 2, pickRate: 2, banRate: 2 },
    ]);
    expect(points.map((point) => point.date)).toEqual(['2026-01-01', '2026-03-01']);
  });

  it('NaN menjadi null, bukan 0', () => {
    const points = normalizeTrend([
      { date: '2026-01-01', winRate: Number.NaN, pickRate: 5, banRate: null },
    ]);
    expect(points[0]?.winRate).toBeNull();
    expect(points[0]?.pickRate).toBe(5);
  });

  it('buang tarikh yang tidak sah', () => {
    const points = normalizeTrend([
      { date: '2016 (year-only)', winRate: 50, pickRate: 1, banRate: 1 },
    ]);
    expect(points).toHaveLength(0);
  });

  it('timestamp ISO menjadi satu titik sehari', () => {
    const points = normalizeTrend([
      { date: '2026-11-26T01:00:00Z', winRate: 50, pickRate: 1, banRate: 1 },
      { date: '2026-11-26T23:00:00Z', winRate: 51, pickRate: 1, banRate: 1 },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]?.date).toBe('2026-11-26');
    expect(points[0]?.winRate).toBe(51);
  });
});

describe('normalizePatchHistory', () => {
  it('langkau baris tanpa versi patch', () => {
    const entries = normalizePatchHistory([
      { version: '', date: '2016-01-01', change_type: 'New', detail: 'Released' },
      { version: '1.5.16', date: '2020-09-22', change_type: 'Rework', detail: 'Revamp' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.patchVersion).toBe('1.5.16');
    expect(entries[0]?.changeType).toBe('revamp');
  });

  it('langkau tarikh yang tidak boleh dipetakan', () => {
    const entries = normalizePatchHistory([
      {
        version: '1.1.23',
        date: '2016 (year-only, day UNVERIFIED)',
        change_type: 'New',
        detail: 'Released',
      },
    ]);
    expect(entries).toHaveLength(0);
  });

  it('susun mengikut tarikh', () => {
    const entries = normalizePatchHistory([
      { version: '2.2.23', date: '2026-11-11', change_type: 'Buff', detail: 'x' },
      { version: '1.5.16', date: '2020-09-22', change_type: 'Nerf', detail: 'y' },
    ]);
    expect(entries.map((entry) => entry.date)).toEqual(['2020-09-22', '2026-11-11']);
  });
});

describe('truncateSummary', () => {
  it('tidak memotong ayat pendek', () => {
    expect(truncateSummary('Base HP +100', 90)).toBe('Base HP +100');
  });

  it('memotong ayat panjang dan menambah elipsis', () => {
    const long = 'a'.repeat(200);
    const result = truncateSummary(long, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith('…')).toBe(true);
  });

  it('memotong di ruang', () => {
    const result = truncateSummary('satu dua tiga empat lima enam tujuh', 14);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
  });
});

describe('groupPatchHistoryByDate', () => {
  it('kumpul peristiwa pada tarikh yang sama', () => {
    const grouped = groupPatchHistoryByDate([
      { date: '2026-01-01', patchVersion: '1.1', changeType: 'buff', summary: '' },
      { date: '2026-01-01', patchVersion: '1.2', changeType: 'nerf', summary: '' },
      { date: '2026-01-02', patchVersion: '1.3', changeType: 'revamp', summary: '' },
    ]);
    expect(grouped.get('2026-01-01')).toHaveLength(2);
    expect(grouped.get('2026-01-02')).toHaveLength(1);
  });
});
