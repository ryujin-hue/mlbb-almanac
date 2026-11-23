/**
 * Keadaan halaman hero disimpan dalam URL.
 *
 * Sebarang paparan boleh dikongsi (salin URL), dan butang "kembali" pelayar
 * berfungsi seperti biasa - menapisrank atau menaip carian tidak menambah
 * sejarah pelayar yang panjang.
 *
 * Param:
 *   rank  - bracket rank (all, mythic, ...)
 *   sort  - kunci pengurutan
 *   dir   - asc | desc
 *   q     - carian
 *   role  - role (boleh berulang: role=Assassin&role=Mage)
 *   lane  - lane
 *   dmg   - tipe damage
 *   view  - cards | table
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { currentPath, navigate, useSearch } from '../router';
import { SORT_OPTIONS, type SortKey } from './store';

export type HeroView = 'cards' | 'table';

export interface HeroFilterState {
  rank: string;
  sort: SortKey;
  desc: boolean;
  query: string;
  roles: string[];
  lanes: string[];
  damageTypes: string[];
  view: HeroView;
}

export interface HeroFilterApi extends HeroFilterState {
  setRank: (value: string) => void;
  setSort: (value: SortKey) => void;
  toggleDirection: () => void;
  toggleRole: (value: string) => void;
  toggleLane: (value: string) => void;
  toggleDamageType: (value: string) => void;
  clearFilters: () => void;
  setView: (value: HeroView) => void;
  /** Teks carian - dikemas kini secara lokal, URL ditulis selepas jeda. */
  queryText: string;
  setQueryText: (value: string) => void;
}

const VALID_SORTS = new Set<string>(SORT_OPTIONS.map((option) => option.value));

function readList(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).filter(Boolean);
}

export function useHeroFilters(): HeroFilterApi {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const rank = params.get('rank') ?? 'all';
  const rawSort = params.get('sort') ?? 'tier_score';
  const sort = (VALID_SORTS.has(rawSort) ? rawSort : 'tier_score') as SortKey;
  const desc = (params.get('dir') ?? 'desc') !== 'asc';
  const query = params.get('q') ?? '';
  const roles = readList(params, 'role');
  const lanes = readList(params, 'lane');
  const damageTypes = readList(params, 'dmg');
  const view: HeroView = params.get('view') === 'table' ? 'table' : 'cards';

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(window.location.search);
      mutate(next);
      const text = next.toString();
      navigate(`${currentPath()}${text ? `?${text}` : ''}`, { replace: true });
    },
    []
  );

  const setRank = useCallback(
    (value: string) => write((next) => next.set('rank', value)),
    [write]
  );
  const setSort = useCallback(
    (value: SortKey) =>
      write((next) => {
        if (next.get('sort') === value) {
          next.set('dir', next.get('dir') === 'asc' ? 'desc' : 'asc');
        } else {
          next.set('sort', value);
          next.set('dir', 'desc');
        }
      }),
    [write]
  );
  const toggleDirection = useCallback(
    () => write((next) => next.set('dir', next.get('dir') === 'asc' ? 'desc' : 'asc')),
    [write]
  );

  const toggleValue = useCallback(
    (key: string, value: string) =>
      write((next) => {
        const current = next.getAll(key);
        next.delete(key);
        const updated = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
        for (const item of updated) next.append(key, item);
      }),
    [write]
  );

  const toggleRole = useCallback((value: string) => toggleValue('role', value), [toggleValue]);
  const toggleLane = useCallback((value: string) => toggleValue('lane', value), [toggleValue]);
  const toggleDamageType = useCallback(
    (value: string) => toggleValue('dmg', value),
    [toggleValue]
  );

  const clearFilters = useCallback(
    () =>
      write((next) => {
        for (const key of ['role', 'lane', 'dmg', 'q']) next.delete(key);
      }),
    [write]
  );

  const setView = useCallback(
    (value: HeroView) => write((next) => next.set('view', value)),
    [write]
  );

  // Teks carian: state lokal supaya menaip tidak melantun, URL ditulis
  // selepas jeda supaya setiap huruf tidak jadi satu sejarah pelayar.
  const [queryText, setQueryText] = useState(query);
  const urlQuery = params.get('q') ?? '';

  useEffect(() => {
    setQueryText((current) => (current === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    if (queryText === urlQuery) return;
    const timer = setTimeout(() => {
      write((next) => {
        if (queryText) next.set('q', queryText);
        else next.delete('q');
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [queryText, urlQuery, write]);

  return {
    rank,
    sort,
    desc,
    query: urlQuery,
    roles,
    lanes,
    damageTypes,
    view,
    setRank,
    setSort,
    toggleDirection,
    toggleRole,
    toggleLane,
    toggleDamageType,
    clearFilters,
    setView,
    queryText,
    setQueryText,
  };
}

/**
 * Parameter movers (tempoh perbandingan + ambang delta) - juga dalam URL
 * supaya halaman Movers boleh dikongsi.
 *
 *   win  - tempoh (1d / 7d / 30d)
 *   thr  - ambang delta (poin)
 */
export interface MoverParams {
  window: string;
  threshold: number;
  setWindow: (value: string) => void;
  setThreshold: (value: number) => void;
}

export function useMoverParams(): MoverParams {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const windowValue = params.get('win') ?? '7d';
  const rawThreshold = Number(params.get('thr') ?? '0.5');
  const threshold = Number.isFinite(rawThreshold) && rawThreshold >= 0 ? rawThreshold : 0.5;

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(window.location.search);
      mutate(next);
      const text = next.toString();
      navigate(`${currentPath()}${text ? `?${text}` : ''}`, { replace: true });
    },
    []
  );

  const setWindow = useCallback(
    (value: string) => write((next) => next.set('win', value)),
    [write]
  );
  const setThreshold = useCallback(
    (value: number) => write((next) => next.set('thr', String(value))),
    [write]
  );

  return { window: windowValue, threshold, setWindow, setThreshold };
}
