import { describe, expect, it } from 'vitest';

import { parseDraftState, writeDraftState } from '../src/data/useDraftState';
import { emptyDraft } from '../src/lib/draft';

describe('parseDraftState', () => {
  it('baca pick dan ban kedua-dua pasukan', () => {
    const state = parseDraftState('?bp=alucard~akai&rp=miya&bb=gusion&rb=benson');
    expect(state.picks.blue).toEqual(['alucard', 'akai']);
    expect(state.picks.red).toEqual(['miya']);
    expect(state.bans.blue).toEqual(['gusion']);
    expect(state.bans.red).toEqual(['benson']);
  });

  it('baca hero yang sedang dipilih', () => {
    expect(parseDraftState('?sel=alucard').selected).toBe('alucard');
    expect(parseDraftState('').selected).toBeNull();
  });

  it('query kosong bermula dengan draf kosong', () => {
    const state = parseDraftState('');
    expect(state.picks.blue).toHaveLength(0);
    expect(state.bans.red).toHaveLength(0);
  });

  it('nama berkomma tidak dipecah oleh pemisah senarai', () => {
    expect(parseDraftState('?bp=miya%2C%20layla').picks.blue).toEqual(['miya, layla']);
  });

  it('senarai dipisah dengan "~"', () => {
    expect(parseDraftState('?bp=alucard~akai').picks.blue).toEqual(['alucard', 'akai']);
  });
});

describe('writeDraftState', () => {
  it('tulis pick dan ban ke query string', () => {
    const state = emptyDraft();
    state.picks.blue = ['alucard'];
    state.bans.red = ['gusion'];
    const query = writeDraftState(state, '');
    expect(query).toBe('/draft?rb=gusion&bp=alucard');
    expect(query).not.toContain(',');
  });

  it('buang parameter kosong', () => {
    const query = writeDraftState(emptyDraft(), '?q=alucard');
    expect(query).toBe('/draft?q=alucard');
  });

  it('pusing round-trip', () => {
    const state = emptyDraft();
    state.picks.blue = ['alucard', 'akai'];
    state.picks.red = ['miya'];
    state.bans.blue = ['gusion'];
    state.bans.red = ['benson'];
    state.selected = 'layla';

    const query = writeDraftState(state, '');
    const parsed = parseDraftState(query.slice(query.indexOf('?')));
    expect(parsed.picks.blue).toEqual(['alucard', 'akai']);
    expect(parsed.bans.red).toEqual(['benson']);
    expect(parsed.selected).toBe('layla');
  });
});
