/**
 * Draft Pick Simulator 5v5.
 *
 * Tiga lajur pada desktop (Biru | Pool | Merah); pada telefon: kepala
 * pasukan yang melekat atas, grid hero, dan bar "Lock Hero" di bawah.
 *
 * Semua keadaan draf duduk dalam URL, jadi draf boleh dikongsi.
 */
import { useEffect, useMemo, useState } from 'react';

import { useAlmanac } from '../data/AlmanacContext';
import { API, fetchJson, type CounterEdge, type CountersResponse } from '../data/client';
import { useDraftState } from '../data/useDraftState';
import {
  PHASE_LABEL,
  TEAM_LABEL,
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
  type DraftState,
  type DraftTeam,
  type HeroFilter,
} from '../lib/draft';
import { TierBadge } from './ui';

function toDraftHero(hero: {
  id: string;
  name: string;
  roles: string[];
  lanes: string[];
  damage_type: string | null;
  tier: string | null;
  win_rate: number | null;
  pick_rate: number | null;
  ban_rate: number | null;
  portrait_url: string | null;
}): DraftHero {
  return {
    id: hero.id,
    name: hero.name,
    roles: hero.roles ?? [],
    lanes: hero.lanes ?? [],
    damageType: hero.damage_type ?? null,
    tier: hero.tier ?? null,
    winRate: hero.win_rate ?? null,
    pickRate: hero.pick_rate ?? null,
    banRate: hero.ban_rate ?? null,
    portraitUrl: hero.portrait_url ?? null,
  };
}

function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

interface TeamColumnProps {
  team: DraftTeam;
  state: DraftState;
  heroes: Map<string, DraftHero>;
  analysis: ReturnType<typeof analyzeTeam>;
  counters: readonly CounterEdge[];
  active: boolean;
}

function TeamColumn({ team, state, heroes, analysis, active }: TeamColumnProps) {
  const picks = state.picks[team].map((id) => heroes.get(id)).filter(Boolean) as DraftHero[];
  const bans = state.bans[team];

  return (
    <section
      aria-label={TEAM_LABEL[team]}
      className={`rounded-md border bg-surface p-3 ${
        active ? 'border-live' : 'border-line'
      }`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: team === 'blue' ? '#00E5FF' : '#F87171' }}
          />
          {TEAM_LABEL[team]}
        </h3>
        <span className="font-mono text-xs text-muted">
          {picks.length}/5 pick · {bans.length}/5 ban
        </span>
      </header>

      {/* Slot pick - 5 kotak, kosong dipaparkan sebagai "--". */}
      <ul className="m-0 mb-2 flex list-none flex-col gap-1 p-0">
        {Array.from({ length: 5 }, (_, index) => {
          const hero = picks[index];
          return (
            <li
              key={`${team}-pick-${index}`}
              className="flex min-h-11 items-center gap-2 rounded-sm border border-line bg-surface2 px-2 py-1"
            >
              {hero?.portraitUrl ? (
                <img
                  src={hero.portraitUrl}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  className="h-7 w-7 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-block h-7 w-7 shrink-0 rounded-sm border border-line"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-ink">
                {hero ? hero.name : <span className="text-muted">—</span>}
              </span>
              {hero ? <TierBadge tier={hero.tier} /> : null}
            </li>
          );
        })}
      </ul>

      {/* Slot ban - baris kecil. */}
      <div className="mb-2 flex flex-wrap gap-1">
        {Array.from({ length: 5 }, (_, index) => {
          const banId = bans[index];
          const hero = banId ? heroes.get(banId) : undefined;
          return (
            <span
              key={`${team}-ban-${index}`}
              title={hero ? `${hero.name} di-ban` : 'Slot ban kosong'}
              className="inline-flex min-h-6 items-center rounded-sm border border-line bg-surface2 px-1.5 text-[10px] text-muted"
            >
              {hero ? hero.name : '—'}
            </span>
          );
        })}
      </div>

      {/* Amaran heuristik. */}
      {analysis.warnings.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {analysis.warnings.map((warning) => (
            <li
              key={warning.kind + warning.message}
              className="mb-1 rounded-sm border border-line px-2 py-1 text-[11px] text-muted"
              style={{
                borderColor: warning.severity >= 0.8 ? '#F87171' : '#F5C518',
              }}
            >
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Cadangan counter. */}
      {analysis.counterSuggestions.length > 0 ? (
        <div className="mt-2 border-t border-line pt-2">
          <p className="m-0 mb-1 text-[11px] font-bold text-ink">Counter cadangan</p>
          <ul className="m-0 list-none p-0">
            {analysis.counterSuggestions.map((suggestion) => (
              <li key={`${suggestion.with.id}-${suggestion.against.id}`} className="text-[11px] text-muted">
                <span className="text-ink">{suggestion.with.name}</span> vs{' '}
                {suggestion.against.name}
                {suggestion.advantage ? ` (+${suggestion.advantage.toFixed(1)})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function DraftPickSimulator() {
  const { heroes: slimHeroes } = useAlmanac();
  const [state, write] = useDraftState();
  const [counters, setCounters] = useState<CounterEdge[]>([]);
  const [filter, setFilter] = useState<HeroFilter>({
    query: '',
    role: null,
    lane: null,
    damageType: null,
  });
  const [searchText, setSearchText] = useState('');

  // Matriks counter - dimuat sekali, murah (hanya edge).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchJson<CountersResponse>(API.counters(), { signal: controller.signal })
      .then((data) => {
        if (!cancelled && data.available) setCounters(data.edges);
      })
      .catch(() => {
        if (!cancelled) setCounters([]);
      });
    return () => controller.abort();
  }, []);

  const pool = useMemo(
    () => slimHeroes.map((hero) => toDraftHero(hero as Parameters<typeof toDraftHero>[0])),
    [slimHeroes]
  );

  const heroesById = useMemo(() => {
    const map = new Map<string, DraftHero>();
    for (const hero of pool) map.set(hero.id, hero);
    return map;
  }, [pool]);

  const facets = useMemo(() => filterFacets(pool), [pool]);

  const visiblePool = useMemo(() => {
    const active = { ...filter, query: searchText };
    return sortHeroesForPool(pool.filter((hero) => matchesFilter(hero, active)));
  }, [pool, filter, searchText]);

  const step = currentStep(state);
  const bluePicks = state.picks.blue.map((id) => heroesById.get(id)).filter(Boolean) as DraftHero[];
  const redPicks = state.picks.red.map((id) => heroesById.get(id)).filter(Boolean) as DraftHero[];
  const blueAnalysis = analyzeTeam(bluePicks, redPicks, counters);
  const redAnalysis = analyzeTeam(redPicks, bluePicks, counters);

  const selectedHero = state.selected ? heroesById.get(state.selected) : undefined;

  const toggleFilter = (key: 'role' | 'lane' | 'damageType', value: string) => {
    setFilter((previous) => ({
      ...previous,
      [key]: previous[key] === value ? null : value,
    }));
  };

  const select = (hero: DraftHero) => {
    if (!isHeroAvailable(state, hero.id)) return;
    write({ ...state, selected: hero.id });
  };

  const confirm = () => {
    if (!state.selected) return;
    write(lockHero(state, state.selected, heroesById.get(state.selected)));
  };

  const undo = () => write(undoStep(state));
  const reset = () => write(emptyDraft());

  const filterButton = (
    label: string,
    value: string | null,
    activeValue: string | null,
    onToggle: () => void
  ) => (
    <button
      key={label + value}
      type="button"
      aria-pressed={activeValue === value}
      onClick={onToggle}
      className="min-h-11 cursor-pointer rounded-sm border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: activeValue === value ? '#00E5FF' : '#243044',
        color: activeValue === value ? '#00E5FF' : '#8B9BB4',
      }}
    >
      {label}
    </button>
  );

  const poolGrid = (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
      {visiblePool.map((hero) => {
        const available = isHeroAvailable(state, hero.id);
        const isSelected = state.selected === hero.id;
        return (
          <button
            key={hero.id}
            type="button"
            disabled={!available}
            onClick={() => select(hero)}
            className="flex min-h-11 cursor-pointer flex-col items-center gap-0.5 rounded-sm border p-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-35"
            style={{
              borderColor: isSelected ? '#00E5FF' : '#243044',
              background: isSelected ? 'rgba(0,229,255,0.12)' : '#121826',
            }}
            title={
              available
                ? `${hero.name} · ${hero.roles.join(', ')} · WR ${percent(hero.winRate)}`
                : `${hero.name} sudah diambil`
            }
          >
            {hero.portraitUrl ? (
              <img
                src={hero.portraitUrl}
                alt=""
                width={36}
                height={36}
                loading="lazy"
                decoding="async"
                className="h-9 w-9 rounded-sm object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-block h-9 w-9 rounded-sm border border-line bg-surface2"
              />
            )}
            <span className="w-full truncate text-center text-ink">{hero.name}</span>
          </button>
        );
      })}
      {visiblePool.length === 0 ? (
        <p className="col-span-full py-6 text-center text-sm text-muted">
          Tiada hero sepadan dengan penapis.
        </p>
      ) : null}
    </div>
  );

  const filters = (
    <div className="flex flex-wrap gap-1.5">
      {facets.roles.map((role) =>
        filterButton(role, role, filter.role, () => toggleFilter('role', role))
      )}
      {facets.lanes.map((lane) =>
        filterButton(lane, lane, filter.lane, () => toggleFilter('lane', lane))
      )}
      {facets.damageTypes.map((damage) =>
        filterButton(damage, damage, filter.damageType, () =>
          toggleFilter('damageType', damage)
        )
      )}
    </div>
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Biru */}
      <TeamColumn
        team="blue"
        state={state}
        heroes={heroesById}
        analysis={blueAnalysis}
        counters={counters}
        active={step?.team === 'blue'}
      />

      {/* Pool */}
      <section aria-label="Pool hero" className="order-first lg:order-none">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-bold text-ink">Pool hero</h3>
          <span className="font-mono text-xs text-muted">{visiblePool.length} hero</span>
        </div>

        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Cari hero…"
          aria-label="Cari hero"
          className="mb-2 min-h-11 w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
        />

        <div className="mb-2">{filters}</div>
        {poolGrid}
      </section>

      {/* Merah */}
      <TeamColumn
        team="red"
        state={state}
        heroes={heroesById}
        analysis={redAnalysis}
        counters={counters}
        active={step?.team === 'red'}
      />

      {/* Bar kawalan - desktop bawah grid, telefon bar melekat bawah. */}
      <div className="lg:col-span-3">
        <div className="sticky bottom-0 z-20 -mx-3 mt-1 border-t border-line bg-bg/95 px-3 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-h-11 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink">
              {step ? (
                <>
                  {PHASE_LABEL[step.phase]} · giliran {TEAM_LABEL[step.team]}
                </>
              ) : (
                'Draf selesai'
              )}
            </span>

            <button
              type="button"
              onClick={confirm}
              disabled={!state.selected}
              className="min-h-11 min-w-11 cursor-pointer rounded-sm border border-live bg-live/10 px-4 py-2 text-sm font-bold text-live disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lock Hero
              {selectedHero ? ` · ${selectedHero.name}` : ''}
            </button>

            <button
              type="button"
              onClick={undo}
              className="min-h-11 cursor-pointer rounded-sm border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink"
            >
              Undo
            </button>

            <button
              type="button"
              onClick={reset}
              className="min-h-11 cursor-pointer rounded-sm border border-line bg-surface px-4 py-2 text-sm font-semibold text-muted"
            >
              Reset Draft
            </button>

            {selectedHero ? (
              <span className="text-xs text-muted">
                {selectedHero.roles.join(' · ') || '—'} · WR {percent(selectedHero.winRate)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
