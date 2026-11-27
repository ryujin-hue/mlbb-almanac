import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  UNVERIFIED_TAG,
  alignKeys,
  canonicalHeroKey,
  canonicalHeroKeyCandidates,
  heroKeysMatch,
  isUnverified,
  safePercent,
  safeRate,
  stripUnverifiedTag,
} from '../heroKey';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

/**
 * Ambil lajur pertama daripada fail CSV.
 *
 * `hero_master.csv` mempunyai medan berpetikan (sources mengandungi
 * koma), jadi parser minimum yang hormat-quote diperlukan - split(',')
 * sahaja akan pecahkan baris.
 */
function firstColumn(csvPath: string): string[] {
  const text = readFileSync(csvPath, 'utf8');
  const values: string[] = [];
  let field = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.length > 1 && row[0] !== 'hero') values.push(row[0] ?? '');
      row = [];
      continue;
    }
    field += char;
  }

  return values;
}

interface LiveFixture {
  count: number;
  heroes: { id: string; name: string }[];
}

const liveFixture = JSON.parse(
  readFileSync(resolve(HERE, 'fixtures', 'live-hero-index.json'), 'utf8')
) as LiveFixture;

describe('canonicalHeroKey', () => {
  it('turunkan huruf dan tukar aksara bukan alfanumerik kepada tanda hubung', () => {
    expect(canonicalHeroKey('Alucard')).toBe('alucard');
    expect(canonicalHeroKey('Yi Sun Shin')).toBe('yi-sun-shin');
    expect(canonicalHeroKey('X.Borg')).toBe('x-borg');
    expect(canonicalHeroKey("Chang'e")).toBe('chang-e');
    expect(canonicalHeroKey('Lapu-Lapu')).toBe('lapu-lapu');
  });

  it('buang tanda hubung di hujung dan runtuhkan}hujung berulang', () => {
    expect(canonicalHeroKey('  Miya  ')).toBe('miya');
    expect(canonicalHeroKey('--Miya--')).toBe('miya');
    expect(canonicalHeroKey('Miya  Layla')).toBe('miya-layla');
  });

  it('kelakos nama null atau kosong', () => {
    expect(canonicalHeroKey(null)).toBe('');
    expect(canonicalHeroKey(undefined)).toBe('');
    expect(canonicalHeroKey('')).toBe('');
  });

  it('normalize tanda aksen supaya aksara sama dapat padan', () => {
    expect(canonicalHeroKey('Céline')).toBe('celine');
  });
});

describe('heroKeysMatch', () => {
  it('padan nama paparan dengan slug live', () => {
    expect(heroKeysMatch("Chang'e", 'chang-e')).toBe(true);
    expect(heroKeysMatch('Yi Sun Shin', 'yi-sun-shin')).toBe(true);
  });

  it('tidak padankan hero yang berbeza', () => {
    expect(heroKeysMatch('Sun', 'yi-sun-shin')).toBe(false);
    expect(heroKeysMatch('Alucard', 'akai')).toBe(false);
  });

  it('tidak padankan bila satu sisi kosong', () => {
    expect(heroKeysMatch('', 'alucard')).toBe(false);
    expect(heroKeysMatch('alucard', null)).toBe(false);
  });
});

describe('canonicalHeroKeyCandidates', () => {
  it('sentiasa mengandungi kunci kanonik', () => {
    expect(canonicalHeroKeyCandidates('Alucard')).toContain('alucard');
  });

  it('tambah alias untuk nama berprefix "the"', () => {
    const candidates = canonicalHeroKeyCandidates('The Rock');
    expect(candidates).toContain('the-rock');
    expect(candidates).toContain('rock');
  });
});

describe('safeRate', () => {
  it('menolak NaN dan Infinity', () => {
    expect(safeRate(Number.NaN)).toBeNull();
    expect(safeRate(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('tidak-treated null sebagai 0', () => {
    expect(safeRate(null)).toBeNull();
    expect(safeRate(undefined)).toBeNull();
  });

  it('parse string nombor', () => {
    expect(safeRate('54.71')).toBe(54.71);
    expect(safeRate('')).toBeNull();
    expect(safeRate('abc')).toBeNull();
  });

  it('loloskan 0 yang sah', () => {
    expect(safeRate(0)).toBe(0);
  });
});

describe('safePercent', () => {
  it('format dengan 2 angka perpuluhan', () => {
    // 54.705 disimpan sebagai 54.704999... dalam binary, jadi nilai itu
    // sendiri sudah menjadi kes floating point - guna 54.706.
    expect(safePercent(54.706)).toBe('54.71%');
    expect(safePercent(50)).toBe('50.00%');
  });

  it('tunjuk tanda hubung bila tiada nilai', () => {
    expect(safePercent(null)).toBe('—');
    expect(safePercent(Number.NaN)).toBe('—');
  });
});

describe('isUnverified / stripUnverifiedTag', () => {
  it('kenal pasti tag UNVERIFIED', () => {
    expect(isUnverified('UNVERIFIED')).toBe(true);
    expect(isUnverified('[unverified]')).toBe(true);
    expect(isUnverified('2.1.88')).toBe(false);
    expect(isUnverified(null)).toBe(false);
  });

  it('buang tag tetapi tinggalkan ayat', () => {
    expect(stripUnverifiedTag('Base HP +100 [UNVERIFIED]')).toBe('Base HP +100');
    expect(stripUnverifiedTag('(UNVERIFIED) Attack speed +10%')).toBe('Attack speed +10%');
    expect(stripUnverifiedTag('')).toBe('');
  });

  it('tag sentiasa uppercase', () => {
    expect(UNVERIFIED_TAG).toBe('UNVERIFIED');
  });
});

describe('keselarasan kunci arkib <-> live', () => {
  const archiveNames = firstColumn(resolve(REPO_ROOT, 'archive', 'hero_master.csv'));
  const archiveKeys = archiveNames.map((name) => canonicalHeroKey(name));
  const liveKeys = liveFixture.heroes.map((hero) => canonicalHeroKey(hero.id));

  it('arkib mengandungi 133 hero', () => {
    expect(archiveNames).toHaveLength(133);
  });

  it('fixture live mengandungi 133 hero', () => {
    expect(liveFixture.heroes).toHaveLength(133);
  });

  it('100% kunci arkib ada dalam snapshot live', () => {
    const alignment = alignKeys(archiveKeys, liveKeys);
    expect(alignment.archiveOnly).toEqual([]);
    expect(alignment.liveOnly).toEqual([]);
    expect(alignment.coverage).toBe(1);
    expect(alignment.matched).toHaveLength(133);
  });

  it('tiada kunci kosong selepas normalisasi', () => {
    expect(archiveKeys.filter((key) => key === '')).toEqual([]);
    expect(liveKeys.filter((key) => key === '')).toEqual([]);
  });
});

describe('alignKeys', () => {
  it('lapor kunci yang hanya ada dalam satu sisi', () => {
    const alignment = alignKeys(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(alignment.matched).toEqual(['b', 'c']);
    expect(alignment.archiveOnly).toEqual(['a']);
    expect(alignment.liveOnly).toEqual(['d']);
    expect(alignment.coverage).toBeCloseTo(2 / 3);
  });

  it('0% bila satu sisi kosong', () => {
    expect(alignKeys([], ['a']).coverage).toBe(0);
  });
});
