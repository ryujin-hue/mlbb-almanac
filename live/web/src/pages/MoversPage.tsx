/**
 * Movers - /movers
 *
 * Dua lajur padat: naik | turun. Ambang delta boleh laras; senarai penuh
 * `deltas` datang sekali dari Worker, jadi menukar ambang tidak perlu
 * request semula.
 */
import { useMemo } from 'react';

import { Delta, EmptyState, TierBadge } from '../components/ui';
import { useAlmanac } from '../data/AlmanacContext';
import { WINDOW_OPTIONS, useMetaStore } from '../data/store';
import { formatPercent } from '../lib/format';
import { Link } from '../router';

export function MoversPage() {
  const { deltas, heroes } = useAlmanac();
  const meta = useMetaStore();

  const heroById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);

  const groups = useMemo(() => {
    const all = deltas?.deltas ?? [];
    const threshold = meta.moverThreshold;
    const rising = all
      .filter((delta) => (delta.tier_score_delta ?? 0) >= threshold)
      .sort((a, b) => (b.tier_score_delta ?? 0) - (a.tier_score_delta ?? 0));
    const falling = all
      .filter((delta) => (delta.tier_score_delta ?? 0) <= -threshold)
      .sort((a, b) => (a.tier_score_delta ?? 0) - (b.tier_score_delta ?? 0));
    const steady = all.filter((delta) => {
      const value = delta.tier_score_delta ?? 0;
      return value > -threshold && value < threshold;
    }).length;
    const fresh = all.filter((delta) => delta.trend === 'new').length;
    return { rising, falling, steady, fresh };
  }, [deltas, meta.moverThreshold]);

  return (
    <div className="page page--movers">
      <div className="toolbar toolbar--flat">
        <div className="toolbar__row">
          <div className="toolbar__controls">
            <label className="ctl">
              <span className="ctl__label">Periode</span>
              <select
                value={meta.window}
                onChange={(event) => meta.setWindow(event.target.value)}
                aria-label="Periode"
              >
                {WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ctl">
              <span className="ctl__label">Ambang</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={meta.moverThreshold}
                onChange={(event) => meta.setMoverThreshold(Number(event.target.value) || 0)}
                aria-label="Ambang delta"
              />
            </label>
          </div>

          <div className="counts">
            <span className="counts__item counts__item--up">{groups.rising.length} naik</span>
            <span className="counts__item counts__item--down">{groups.falling.length} turun</span>
            <span className="counts__item">{groups.steady} stabil</span>
            {groups.fresh > 0 ? <span className="counts__item">{groups.fresh} baru</span> : null}
          </div>
        </div>
      </div>

      {!deltas ? (
        <EmptyState title="Data unavailable" detail="Snapshot perbandingan belum tersedia." />
      ) : deltas.available === false ? (
        <EmptyState
          title="Data unavailable"
          detail={deltas.message ?? 'Belum ada snapshot perbandingan.'}
        />
      ) : (
        <div className="movers">
          <section className="movercol">
            <h2 className="movercol__title movercol__title--up">Naik</h2>
            {groups.rising.length === 0 ? (
              <div className="state">Tiada hero melewati ambang.</div>
            ) : (
              <ul className="moverlist">
                {groups.rising.map((delta, index) => {
                  const hero = heroById.get(delta.id);
                  return (
                    <li className="moverrow" key={delta.id}>
                      <span className="moverrow__rank">{index + 1}</span>
                      <Link to={`/heroes/${delta.id}`} className="moverrow__name">
                        {delta.name}
                      </Link>
                      <TierBadge tier={delta.tier} />
                      <span className="moverrow__rate">{formatPercent(delta.win_rate)}</span>
                      <Delta value={delta.tier_score_delta} />
                      {hero ? null : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="movercol">
            <h2 className="movercol__title movercol__title--down">Turun</h2>
            {groups.falling.length === 0 ? (
              <div className="state">Tiada hero melewati ambang.</div>
            ) : (
              <ul className="moverlist">
                {groups.falling.map((delta, index) => (
                  <li className="moverrow" key={delta.id}>
                    <span className="moverrow__rank">{index + 1}</span>
                    <Link to={`/heroes/${delta.id}`} className="moverrow__name">
                      {delta.name}
                    </Link>
                    <TierBadge tier={delta.tier} />
                    <span className="moverrow__rate">{formatPercent(delta.win_rate)}</span>
                    <Delta value={delta.tier_score_delta} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
