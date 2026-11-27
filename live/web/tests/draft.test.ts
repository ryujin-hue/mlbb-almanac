import { describe, expect, it } from 'vitest';

import {
  DRAFT_STEPS,
  TEAM_SLOTS,
  analyzeTeam,
  currentStep,
  emptyDraft,
  filterFacets,
  isHeroAvailable,
  lockHero,
  matchesFilter,
  sortHeroesForPool,
  undoStep,
  type DraftHero,
} from '../src/lib/draft';

function hero(id: string, overrides: Partial<DraftHero> = {}): DraftHero {
  return {
    id,
    name: id,
    roles: ['Fighter'],
    lanes: ['Exp'],
    damageType: 'Physical',
    tier: 'A',
    winRate: 50,
    pickRate: 1,
    banRate: 1,
    portraitUrl: null,
    ...overrides,
  };
}

describe('susunan langkah', () => {
  it('20 langkah, 10 setiap pasukan', () => {
    expect(DRAFT_STEPS).toHaveLength(20);
    expect(DRAFT_STEPS.filter((step) => step.team === 'blue')).toHaveLength(10);
    expect(DRAFT_STEPS.filter((step) => step.team === 'red')).toHaveLength(10);
  });

  it('5 ban + 5 pick setiap pasukan', () => {
    const bans = DRAFT_STEPS.filter((step) => step.kind === 'ban');
    const picks = DRAFT_STEPS.filter((step) => step.kind === 'pick');
    expect(bans.filter((step) => step.team === 'blue')).toHaveLength(TEAM_SLOTS.bans);
    expect(picks.filter((step) => step.team === 'blue')).toHaveLength(TEAM_SLOTS.picks);
    expect(bans.filter((step) => step.team === 'red')).toHaveLength(TEAM_SLOTS.bans);
    expect(picks.filter((step) => step.team === 'red')).toHaveLength(TEAM_SLOTS.picks);
  });

  it('turutan fasa: ban1 -> pick1 -> ban2 -> pick2', () => {
    const phases = DRAFT_STEPS.map((step) => step.phase);
    expect(phases[0]).toBe('ban1');
    expect(phases.indexOf('pick1')).toBeGreaterThan(phases.lastIndexOf('ban1'));
    expect(phases.indexOf('ban2')).toBeGreaterThan(phases.lastIndexOf('pick1'));
    expect(phases.indexOf('pick2')).toBeGreaterThan(phases.lastIndexOf('ban2'));
  });
});

describe('lockHero', () => {
  it('langkah pertama ialah ban biru', () => {
    expect(currentStep(emptyDraft())?.team).toBe('blue');
    expect(currentStep(emptyDraft())?.kind).toBe('ban');
  });

  it('banмеча tidak boleh dipilih semula', () => {
    let state = emptyDraft();
    state = lockHero(state, 'alucard');
    expect(state.bans.blue).toEqual(['alucard']);
    expect(isHeroAvailable(state, 'alucard')).toBe(false);
  });

  it('selepas ban, langkah seterusnya ban merah', () => {
    let state = lockHero(emptyDraft(), 'alucard');
    expect(currentStep(state)?.team).toBe('red');
    expect(currentStep(state)?.kind).toBe('ban');
  });

  it('selepas 3 ban setiap pasukan, fasa bertukar ke pick', () => {
    let state = emptyDraft();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      state = lockHero(state, id);
    }
    expect(currentStep(state)?.phase).toBe('pick1');
    expect(currentStep(state)?.kind).toBe('pick');
  });

  it('pick masuk ke slot pasukan yang betul', () => {
    let state = emptyDraft();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) state = lockHero(state, id);
    state = lockHero(state, 'alucard');
    expect(state.picks.blue).toEqual(['alucard']);
    expect(state.bans.blue).toHaveLength(3);
  });

  it('tolak hero yang sudah diambil', () => {
    let state = emptyDraft();
    state = lockHero(state, 'alucard');
    const before = JSON.stringify(state);
    state = lockHero(state, 'alucard');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('selepas 20 langkah draf tamat', () => {
    let state = emptyDraft();
    const ids = Array.from({ length: 20 }, (_, index) => `hero-${index}`);
    for (const id of ids) state = lockHero(state, id);
    expect(currentStep(state)).toBeNull();
    expect(state.picks.blue).toHaveLength(5);
    expect(state.picks.red).toHaveLength(5);
    expect(state.bans.blue).toHaveLength(5);
    expect(state.bans.red).toHaveLength(5);
  });
});

describe('undoStep', () => {
  it('buang pick terakhir', () => {
    let state = emptyDraft();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) state = lockHero(state, id);
    state = lockHero(state, 'alucard');
    state = undoStep(state);
    expect(state.picks.blue).toHaveLength(0);
    expect(currentStep(state)?.phase).toBe('pick1');
  });

  it('buang ban terakhir', () => {
    let state = lockHero(emptyDraft(), 'alucard');
    state = undoStep(state);
    expect(state.bans.blue).toHaveLength(0);
  });

  it('tidak buat apa-apa pada draf kosong', () => {
    const state = undoStep(emptyDraft());
    expect(state.bans.blue).toHaveLength(0);
    expect(state.picks.blue).toHaveLength(0);
  });
});

describe('penapis pool', () => {
  const pool = [
    hero('alucard', { roles: ['Fighter'], lanes: ['Exp'], damageType: 'Physical' }),
    hero('francisco', { roles: ['Tank', 'Support'], lanes: ['Roam'], damageType: 'Magic' }),
  ];

  it('tapis ikut role', () => {
    expect(
      pool.filter((entry) => matchesFilter(entry, { query: '', role: 'Tank', lane: null, damageType: null }))
    ).toHaveLength(1);
  });

  it('tapis ikut lane', () => {
    expect(
      pool.filter((entry) => matchesFilter(entry, { query: '', role: null, lane: 'Roam', damageType: null }))
    ).toHaveLength(1);
  });

  it('tapis ikut damage type', () => {
    expect(
      pool.filter((entry) =>
        matchesFilter(entry, { query: '', role: null, lane: null, damageType: 'Magic' })
      )
    ).toHaveLength(1);
  });

  it('carian tidak peka huruf besar', () => {
    expect(
      pool.filter((entry) => matchesFilter(entry, { query: 'ALU', role: null, lane: null, damageType: null }))
    ).toHaveLength(1);
  });

  it('facet unik dan tersusun', () => {
    const facets = filterFacets(pool);
    expect(facets.roles).toEqual(['Fighter', 'Support', 'Tank']);
    expect(facets.lanes).toEqual(['Exp', 'Roam']);
    expect(facets.damageTypes).toEqual(['Magic', 'Physical']);
  });
});

describe('sortHeroesForPool', () => {
  it('tier dahulu, win rate kemudian', () => {
    const sorted = sortHeroesForPool([
      hero('c', { tier: 'B', winRate: 60 }),
      hero('a', { tier: 'S+', winRate: 50 }),
      hero('b', { tier: 'S+', winRate: 55 }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('analyzeTeam', () => {
  it('amaran bila tiada barisan depan', () => {
    const analysis = analyzeTeam(
      [hero('a'), hero('b'), hero('c')],
      [],
      []
    );
    expect(analysis.warnings.some((warning) => warning.kind === 'frontline')).toBe(true);
  });

  it('amaran bila tiada crowd control', () => {
    const analysis = analyzeTeam(
      [hero('a', { roles: ['Marksman'] }), hero('b', { roles: ['Marksman'] }), hero('c', { roles: ['Marksman'] })],
      [],
      []
    );
    expect(analysis.warnings.some((warning) => warning.kind === 'cc')).toBe(true);
  });

  it('tiada amaran bila komposisi lengkap', () => {
    const analysis = analyzeTeam(
      [
        hero('a', { roles: ['Tank'], damageType: 'Physical' }),
        hero('b', { roles: ['Support'], damageType: 'Magic' }),
        hero('c', { roles: ['Marksman'], damageType: 'Physical' }),
      ],
      [],
      []
    );
    expect(analysis.warnings).toHaveLength(0);
  });

  it('amaran damage terlalu condong ke physical', () => {
    const analysis = analyzeTeam(
      [
        hero('a', { roles: ['Tank'], damageType: 'Physical' }),
        hero('b', { roles: ['Support'], damageType: 'Physical' }),
        hero('c', { roles: ['Marksman'], damageType: 'Physical' }),
      ],
      [],
      []
    );
    expect(analysis.warnings.some((warning) => warning.kind === 'damage')).toBe(true);
    expect(analysis.physicalShare).toBe(1);
  });

  it('cadangan counter apabila lawan mengunci hero prioritas', () => {
    const ours = hero('alucard');
    const theirs = hero('gusion', { banRate: 20, tier: 'S+' });
    const analysis = analyzeTeam([ours], [theirs], [
      { from: 'alucard', to: 'gusion', strength: null, advantage: 8.5 },
    ]);
    expect(analysis.threats.map((entry) => entry.id)).toEqual(['gusion']);
    expect(analysis.counterSuggestions).toHaveLength(1);
    expect(analysis.counterSuggestions[0]?.against.id).toBe('gusion');
    expect(analysis.counterSuggestions[0]?.advantage).toBe(8.5);
  });

  it('tiada cadangan counter tanpa edge', () => {
    const analysis = analyzeTeam([hero('alucard')], [hero('gusion', { banRate: 20 })], []);
    expect(analysis.counterSuggestions).toHaveLength(0);
  });
});
