/**
 * Senarai hero - /heroes
 *
 * Dua paparan (Kad / Jadual), filter dalam drawer, dan setiap baris boleh
 * dibuka ke detail hero (Overview | Balance history).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { FOCUS_SEARCH_EVENT } from '../components/shell';
import { Delta, EmptyState, PatchTag, Portrait, Sheet, TierBadge } from '../components/ui';
import { useAlmanac } from '../data/AlmanacContext';
import type { ArchiveIndex } from '../data/archive';
import { RANK_OPTIONS, SORT_OPTIONS, WINDOW_OPTIONS, selectHeroes } from '../data/store';
import { useHeroFilters, useMoverParams } from '../data/useHeroFilters';
import { formatPercent } from '../lib/format';
import { Link } from '../router';

interface Props {
  archive: ArchiveIndex | null;
}

export function HeroesPage({ archive }: Props) {
  const { heroes, deltas, status } = useAlmanac();
  // Keadaan filter berada dalam URL - boleh dikongsi, boleh dikembalikan
  // dengan butang "kembali" pelayar.
  const meta = useHeroFilters();
  const mover = useMoverParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cari dari navigasi atas: fokus medan carian.
  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  const deltaMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof deltas>['deltas'][number]>();
    for (const delta of deltas?.deltas ?? []) map.set(delta.id, delta);
    return map;
  }, [deltas]);

  const archiveNotes = useMemo(() => {
    const map = new Map<string, { version: string; type: string; count: number }>();
    if (!archive) return map;
    for (const hero of heroes) {
      const key = hero.name.toLowerCase();
      const record = archive.heroByName.get(key);
      const changes = archive.heroChangesByHero.get(key) ?? [];
      const last = changes[changes.length - 1];
      if (!record && !last) continue;
      map.set(hero.id, {
        version: last?.version ?? record?.last_change_version ?? '',
        type: last?.change_type ?? record?.last_change_type ?? '',
        count: record?.change_count ?? changes.length,
      });
    }
    return map;
  }, [archive, heroes]);

  // Bilangan nota patch arkib - asas sort "Nota Patch".
  const archiveChanges = useMemo(() => {
    const map = new Map<string, number>();
    for (const hero of heroes) {
      const record = archive?.heroByName.get(hero.name.toLowerCase());
      if (record) map.set(hero.id, record.change_count);
    }
    return map;
  }, [archive, heroes]);

  const visible = useMemo(
    () =>
      selectHeroes({
        heroes,
        deltas: deltaMap,
        rank: meta.rank,
        query: meta.query,
        roles: meta.roles,
        lanes: meta.lanes,
        damageTypes: meta.damageTypes,
        sort: meta.sort,
        desc: meta.desc,
        threshold: 0.5,
        archiveChanges,
      }),
    [heroes, deltaMap, meta.rank, meta.query, meta.roles, meta.lanes, meta.damageTypes, meta.sort, meta.desc, archiveChanges]
  );

  const activeFilters = meta.roles.length + meta.lanes.length + meta.damageTypes.length;

  if (status === 'loading' && heroes.length === 0) {
    return (
      <div className="page">
        <div className="state">Memuat dataset…</div>
      </div>
    );
  }

  return (
    <div className="page page--heroes">
      <div className="toolbar">
        <div className="toolbar__row">
          <div className="toolbar__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={meta.queryText}
              placeholder="Cari hero…"
              aria-label="Cari hero"
              onChange={(event) => meta.setQueryText(event.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn--sm"
            onClick={() => meta.toggleDirection()}
            aria-label="Ubah arah pengurutan"
            title={meta.desc ? 'Turun' : 'Naik'}
          >
            {meta.desc ? '↓' : '↑'}
          </button>

          <button
            type="button"
            className="btn btn--sm toolbar__filter"
            onClick={() => setFilterOpen(true)}
            aria-label="Buka filter"
          >
            Filter
            {activeFilters > 0 ? <span className="btn__badge">{activeFilters}</span> : null}
          </button>
        </div>

        <div className="toolbar__row toolbar__scroll">
          <select
            value={meta.rank}
            aria-label="Rank"
            onChange={(event) => meta.setRank(event.target.value)}
          >
            {RANK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={mover.window}
            aria-label="Periode"
            onChange={(event) => mover.setWindow(event.target.value)}
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={meta.sort}
            aria-label="Urutkan"
            onChange={(event) => meta.setSort(event.target.value as typeof meta.sort)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="toggle" role="group" aria-label="Paparan">
            <button
              type="button"
              className={`toggle__btn${meta.view === 'cards' ? ' toggle__btn--on' : ''}`}
              onClick={() => meta.setView('cards')}
            >
              Kad
            </button>
            <button
              type="button"
              className={`toggle__btn${meta.view === 'table' ? ' toggle__btn--on' : ''}`}
              onClick={() => meta.setView('table')}
            >
              Jadual
            </button>
          </div>

          <span className="toolbar__count">{visible.length} hero</span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Tiada hero yang sepadan"
          detail="Cuba longgarkan filter rank, role, lane, atau carian."
        />
      ) : meta.view === 'cards' ? (
        <div className="herogrid">
          {visible.map((hero) => {
            const note = archiveNotes.get(hero.id);
            return (
              <article className="hcard" key={hero.id}>
                <Link to={`/heroes/${hero.id}`} className="hcard__link">
                  <div className="hcard__top">
                    <Portrait
                      name={hero.name}
                      iconUrl={hero.icon_url}
                      portraitUrl={hero.portrait_url}
                      roles={hero.roles}
                      size={38}
                    />
                    <div className="hcard__id">
                      <div className="hcard__name">
                        <span>{hero.name}</span>
                        <TierBadge tier={hero.tier} />
                      </div>
                      <div className="hcard__meta">
                        {hero.roles.slice(0, 2).join(' · ') || '—'}
                        {hero.damage_type ? ` · ${hero.damage_type}` : ''}
                      </div>
                    </div>
                    <Delta value={hero.delta?.tier_score_delta ?? null} />
                  </div>

                  <div className="hcard__rates">
                    <div className="metric">
                      <div className="metric__k">WR</div>
                      <div className="metric__v">{formatPercent(hero.win_rate)}</div>
                    </div>
                    <div className="metric">
                      <div className="metric__k">PR</div>
                      <div className="metric__v">{formatPercent(hero.pick_rate)}</div>
                    </div>
                    <div className="metric">
                      <div className="metric__k">BR</div>
                      <div className="metric__v">{formatPercent(hero.ban_rate)}</div>
                    </div>
                  </div>

                  {note && (note.version || note.type) ? (
                    <div className="hcard__arch">
                      <PatchTag type={note.type} />
                      <span className="hcard__arch-v">{note.version}</span>
                      {note.count > 1 ? <span className="hcard__arch-n">{note.count}×</span> : null}
                    </div>
                  ) : null}
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Hero</th>
                <th>Tier</th>
                <th className="num">WR</th>
                <th className="num">PR</th>
                <th className="num">BR</th>
                <th className="num">Delta</th>
                <th>Perubahan terakhir</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((hero) => {
                const note = archiveNotes.get(hero.id);
                return (
                  <tr key={hero.id}>
                    <td>
                      <Link to={`/heroes/${hero.id}`} className="tbl__hero">
                        <Portrait
                          name={hero.name}
                          iconUrl={hero.icon_url}
                          portraitUrl={hero.portrait_url}
                          roles={hero.roles}
                          size={26}
                        />
                        <span>{hero.name}</span>
                      </Link>
                    </td>
                    <td>
                      <TierBadge tier={hero.tier} />
                    </td>
                    <td className="num">{formatPercent(hero.win_rate)}</td>
                    <td className="num">{formatPercent(hero.pick_rate)}</td>
                    <td className="num">{formatPercent(hero.ban_rate)}</td>
                    <td className="num">
                      <Delta value={hero.delta?.tier_score_delta ?? null} />
                    </td>
                    <td>
                      {note && (note.version || note.type) ? (
                        <Link to={`/patches/${encodeURIComponent(note.version)}`} className="tbl__patch">
                          <PatchTag type={note.type} />
                          <span>{note.version}</span>
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{hero.roles.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)} heroes={heroes} />
    </div>
  );
}

function FilterDrawer({
  open,
  onClose,
  heroes,
}: {
  open: boolean;
  onClose: () => void;
  heroes: { roles: string[]; lanes: string[]; damage_type: string | null }[];
}) {
  const meta = useHeroFilters();

  const roles = useMemo(() => {
    const set = new Set<string>();
    for (const hero of heroes) for (const role of hero.roles) set.add(role);
    return [...set].sort();
  }, [heroes]);

  const lanes = useMemo(() => {
    const set = new Set<string>();
    for (const hero of heroes) for (const lane of hero.lanes) set.add(lane);
    return [...set].sort();
  }, [heroes]);

  const damageTypes = useMemo(() => {
    const set = new Set<string>();
    for (const hero of heroes) if (hero.damage_type) set.add(hero.damage_type);
    return [...set].sort();
  }, [heroes]);

  const reset = () => {
    meta.clearFilters();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Filter" side="right">
      <FilterGroup label="Role" options={roles} selected={meta.roles} onToggle={meta.toggleRole} />
      <FilterGroup label="Lane" options={lanes} selected={meta.lanes} onToggle={meta.toggleLane} />
      <FilterGroup
        label="Tipe damage"
        options={damageTypes}
        selected={meta.damageTypes}
        onToggle={meta.toggleDamageType}
      />
      <div className="sheet__actions">
        <button type="button" className="btn btn--sm" onClick={reset}>
          Reset
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={onClose}>
          Terapkan
        </button>
      </div>
    </Sheet>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="filtergroup">
      <div className="filtergroup__label">{label}</div>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className="chip"
            aria-pressed={selected.includes(option)}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
