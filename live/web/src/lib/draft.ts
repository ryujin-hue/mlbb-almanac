/**
 * Logik Draft Pick Simulator (5v5).
 *
 * Semua keputusan ada di sini, bukan dalam komponen - supaya ia boleh
 * diuji tanpa browser dan tanpa DOM.
 *
 * Susunan draf (mengikut turutan competitive MLBB):
 *
 *   Ban Phase 1   : biru ban 3, merah ban 3
 *   Pick Phase 1  : biru pilih 2, merah pilih 2
 *   Ban Phase 2   : biru ban 2, merah ban 2
 *   Pick Phase 2  : biru pilih 3, merah pilih 3
 *
 * Hasilnya: 5 pick + 5 ban setiap pasukan, 20 langkah keseluruhan, dan
 * empat fasa mengikut turutan yang diminta.
 */
import { canonicalHeroKey } from '@shared/heroKey';

export type DraftTeam = 'blue' | 'red';
export type DraftPhase = 'ban1' | 'pick1' | 'ban2' | 'pick2';
export type DraftStepKind = 'ban' | 'pick';

export interface DraftHero {
  id: string;
  name: string;
  roles: string[];
  lanes: string[];
  damageType: string | null;
  tier: string | null;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  portraitUrl: string | null;
}

export interface DraftStep {
  phase: DraftPhase;
  kind: DraftStepKind;
  team: DraftTeam;
  /** Nombor slot dalam fasa tersebut (1-based). */
  slot: number;
}

export interface DraftState {
  bans: Record<DraftTeam, string[]>;
  picks: Record<DraftTeam, string[]>;
  /** Hero yang dikunci tetapi belum disahkan (butang "Lock Hero"). */
  selected: string | null;
}

/** Nama fasa untuk UI. */
export const PHASE_LABEL: Record<DraftPhase, string> = {
  ban1: 'Ban Phase 1',
  pick1: 'Pick Phase 1',
  ban2: 'Ban Phase 2',
  pick2: 'Pick Phase 2',
};

export const TEAM_LABEL: Record<DraftTeam, string> = {
  blue: 'Pasukan Biru',
  red: 'Pasukan Merah',
};

/**
 * Senarai 20 langkah. Biru mula setiap fasa (konvensi competitive
 * MLBB - pihak biru Ban pertama).
 */
export const DRAFT_STEPS: readonly DraftStep[] = (() => {
  const steps: DraftStep[] = [];
  const teams: DraftTeam[] = ['blue', 'red'];

  const phase = (
    id: DraftPhase,
    kind: DraftStepKind,
    perTeam: number
  ): void => {
    for (let round = 0; round < perTeam; round += 1) {
      for (const team of teams) {
        steps.push({ phase: id, kind, team, slot: round + 1 });
      }
    }
  };

  phase('ban1', 'ban', 3);
  phase('pick1', 'pick', 2);
  phase('ban2', 'ban', 2);
  phase('pick2', 'pick', 3);

  return steps;
})();

/** Jumlah ban dan pick setiap pasukan. */
export const TEAM_SLOTS = { bans: 5, picks: 5 } as const;

export function emptyDraft(): DraftState {
  return {
    bans: { blue: [], red: [] },
    picks: { blue: [], red: [] },
    selected: null,
  };
}

/** Langkah semasa - null bila draf sudah selesai. */
export function currentStep(state: DraftState): DraftStep | null {
  const used =
    state.bans.blue.length +
    state.bans.red.length +
    state.picks.blue.length +
    state.picks.red.length;
  return DRAFT_STEPS[used] ?? null;
}

/** Adakah hero ini masih boleh dipilih (belum dipick atau reban)? */
export function isHeroAvailable(state: DraftState, heroId: string): boolean {
  const key = canonicalHeroKey(heroId);
  const taken = [
    ...state.bans.blue,
    ...state.bans.red,
    ...state.picks.blue,
    ...state.picks.red,
  ].map(canonicalHeroKey);
  return !taken.includes(key);
}

/**
 * Kunci hero untuk langkah semasa.
 *
 * Memo: hero yang sama dalam dua pasukan - ia hanya satu
 * slot, jadi draf akan berhenti pada langkah itu.
 */
export function lockHero(
  state: DraftState,
  heroId: string,
  hero?: DraftHero
): DraftState {
  const step = currentStep(state);
  if (!step) return state;
  if (!isHeroAvailable(state, heroId)) return state;

  const key = hero?.id ?? heroId;

  if (step.kind === 'ban') {
    const bans = { ...state.bans };
    bans[step.team] = [...bans[step.team], key];
    return { ...state, bans, selected: null };
  }

  const picks = { ...state.picks };
  picks[step.team] = [...picks[step.team], key];
  return { ...state, picks, selected: null };
}

/** Undur satu langkah (ban atau pick terakhir). */
export function undoStep(state: DraftState): DraftState {
  const used =
    state.bans.blue.length +
    state.bans.red.length +
    state.picks.blue.length +
    state.picks.red.length;
  if (used === 0) return emptyDraft();

  const last = DRAFT_STEPS[used - 1];
  if (!last) return state;

  if (last.kind === 'ban') {
    const bans = { ...state.bans };
    bans[last.team] = bans[last.team].slice(0, -1);
    return { ...state, bans, selected: null };
  }

  const picks = { ...state.picks };
  picks[last.team] = picks[last.team].slice(0, -1);
  return { ...state, picks, selected: null };
}

/** Tolak pilih semasa (hero yang dikunci tetapi belum disahkan). */
export function clearSelection(state: DraftState): DraftState {
  return { ...state, selected: null };
}

// ------------------------------------------------------------- penapis pool

export interface HeroFilter {
  query: string;
  role: string | null;
  lane: string | null;
  damageType: string | null;
}

/** Adakah hero lalu Through penapis? */
export function matchesFilter(hero: DraftHero, filter: HeroFilter): boolean {
  if (filter.role && !hero.roles.includes(filter.role)) return false;
  if (filter.lane && !hero.lanes.includes(filter.lane)) return false;
  if (filter.damageType && hero.damageType !== filter.damageType) return false;

  const query = filter.query.trim().toLowerCase();
  if (!query) return true;
  return hero.name.toLowerCase().includes(query);
}

/** Senarai unik semua nilai filter yang ada dalam pool. */
export function filterFacets(heroes: readonly DraftHero[]): {
  roles: string[];
  lanes: string[];
  damageTypes: string[];
} {
  const roles = new Set<string>();
  const lanes = new Set<string>();
  const damageTypes = new Set<string>();

  for (const hero of heroes) {
    for (const role of hero.roles) roles.add(role);
    for (const lane of hero.lanes) lanes.add(lane);
    if (hero.damageType) damageTypes.add(hero.damageType);
  }

  return {
    roles: [...roles].sort(),
    lanes: [...lanes].sort(),
    damageTypes: [...damageTypes].sort(),
  };
}

// ------------------------------------------------------------ heuristik

export type WarningKind = 'frontline' | 'cc' | 'damage' | 'counter';

export interface DraftWarning {
  kind: WarningKind;
  /** Arahan ringkas - satu ayat, tanpa jargon. */
  message: string;
  /** Ketinggian (0..1) - untuk susun mengikut kepentingan. */
  severity: number;
}

/** Role yang dianggap barisan depan. */
const FRONTLINE_ROLES = ['Tank'];
/** Role yang membawa crowd control. */
const CC_ROLES = ['Support', 'Tank'];

export interface TeamAnalysis {
  picks: DraftHero[];
  /** Bilangan hero barisan depan. */
  frontline: number;
  /** Bilangan hero yang membawa CC. */
  cc: number;
  /** Bahagian damage physical (0..1). */
  physicalShare: number;
  /** Bahagian damage magic (0..1). */
  magicShare: number;
  /** Hero lawan yang paling "diprioriti" (ban rate / tier tinggi). */
  threats: DraftHero[];
  /** Cadangan counter untuk hero lawan yang diprioriti. */
  counterSuggestions: { against: DraftHero; with: DraftHero; advantage: number }[];
  warnings: DraftWarning[];
}

export interface CounterEdge {
  from: string;
  to: string;
  strength: number | null;
  advantage: number | null;
}

/**
 * Analisis satu pasukan.
 *
 * `counters` ialah matriks counter ("from" menang lawan "to").
 * `opponentPicks` ialah hero yang sudah dikunci lawan - supaya
 * cadangan counter boleh memberi tahu hero yang perlu di-counters.
 */
export function analyzeTeam(
  picks: readonly DraftHero[],
  opponentPicks: readonly DraftHero[],
  counters: readonly CounterEdge[]
): TeamAnalysis {
  const frontline = picks.filter((hero) =>
    hero.roles.some((role) => FRONTLINE_ROLES.includes(role))
  ).length;

  const cc = picks.filter((hero) =>
    hero.roles.some((role) => CC_ROLES.includes(role))
  ).length;

  let physical = 0;
  let magic = 0;
  let counted = 0;
  for (const hero of picks) {
    if (hero.damageType === 'Physical') {
      physical += 1;
      counted += 1;
    } else if (hero.damageType === 'Magic') {
      magic += 1;
      counted += 1;
    }
  }
  const physicalShare = counted === 0 ? 0 : physical / counted;
  const magicShare = counted === 0 ? 0 : magic / counted;

  // Ancaman lawan: ban rate tinggi atau tier S/S+.
  const threats = [...opponentPicks]
    .filter((hero) => (hero.banRate ?? 0) >= 8 || hero.tier === 'S' || hero.tier === 'S+')
    .sort((a, b) => (b.banRate ?? 0) - (a.banRate ?? 0));

  const counterSuggestions: TeamAnalysis['counterSuggestions'] = [];
  for (const threat of threats) {
    const threatKey = canonicalHeroKey(threat.id);
    for (const ours of picks) {
      const ourKey = canonicalHeroKey(ours.id);
      const edge = counters.find((candidate) => {
        const from = canonicalHeroKey(candidate.from);
        const to = canonicalHeroKey(candidate.to);
        return from === ourKey && to === threatKey;
      });
      if (!edge) continue;
      counterSuggestions.push({
        against: threat,
        with: ours,
        advantage: edge.advantage ?? edge.strength ?? 0,
      });
    }
  }
  counterSuggestions.sort((a, b) => b.advantage - a.advantage);

  const warnings: DraftWarning[] = [];

  if (picks.length >= 3) {
    if (frontline === 0) {
      warnings.push({
        kind: 'frontline',
        message: 'Tiada barisan depan — tiada Tank untuk tampal damage.',
        severity: 0.9,
      });
    } else if (frontline === 1 && picks.length >= 4) {
      warnings.push({
        kind: 'frontline',
        message: 'Hanya satu barisan depan — ruang untuk diromak.',
        severity: 0.5,
      });
    }

    if (cc === 0) {
      warnings.push({
        kind: 'cc',
        message: 'Tiada crowd control — fight tidak boleh dimulakan.',
        severity: 0.9,
      });
    } else if (cc === 1 && picks.length >= 4) {
      warnings.push({
        kind: 'cc',
        message: 'Hanya satu pembawa CC — ganjuran kelabu selepas init.',
        severity: 0.45,
      });
    }

    if (counted >= 3 && physicalShare >= 0.8) {
      warnings.push({
        kind: 'damage',
        message: 'Damage hampir semua physical — mudah vulnerabiliti kepada magic damage.',
        severity: 0.6,
      });
    } else if (counted >= 3 && magicShare >= 0.8) {
      warnings.push({
        kind: 'damage',
        message: 'Damage hampir semua magic — mudah vulnerabiliti kepada physical damage.',
        severity: 0.6,
      });
    }
  }

  return {
    picks: [...picks],
    frontline,
    cc,
    physicalShare,
    magicShare,
    threats,
    counterSuggestions: counterSuggestions.slice(0, 5),
    warnings: warnings.sort((a, b) => b.severity - a.severity),
  };
}

/** Urutan sortiran pool: tier dahulu, kemudian win rate. */
export function sortHeroesForPool(heroes: readonly DraftHero[]): DraftHero[] {
  const tierRank: Record<string, number> = { 'S+': 0, S: 1, A: 2, B: 3, C: 4 };
  return [...heroes].sort((a, b) => {
    const tier = (tierRank[a.tier ?? ''] ?? 9) - (tierRank[b.tier ?? ''] ?? 9);
    if (tier !== 0) return tier;
    return (b.winRate ?? 0) - (a.winRate ?? 0);
  });
}
