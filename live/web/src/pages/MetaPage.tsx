/**
 * Meta - ringkasan keadaan sekarang.
 *
 * Empat sumber, satu halaman:
 *   1. StatusStrip  - patch, season, bila kemas kini, bila kemas kini seterusnya
 *   2. KpiRow       - 4 angka besar dari meta live
 *   3. RoleWrBars   - purata win rate ikut role
 *   4. MoversSnapshot - 5 naik / 5 turun
 *   5. RecentBalance  - 5 perubahan terakhirdari arkib
 */
import { useMemo } from 'react';

import { useAlmanac } from '../data/AlmanacContext';
import { compareVersions } from '../data/archive';
import { summarize } from '../data/store';
import { formatDateTime, formatPercent, formatRelative } from '../lib/format';
import { Link } from '../router';
import { Delta, Panel, PatchTag, Portrait, Stat, TierBadge } from '../components/ui';

export function MetaPage() {
  const { heroes, manifest, deltas, snapshots, archive, apiMeta, status } = useAlmanac();

  const stats = useMemo(() => summarize(heroes, manifest?.rates_summary ?? null, 'all'), [heroes, manifest]);

  const latestPatch = archive?.core.patches[archive.core.patches.length - 1] ?? null;
  const season = archive?.core.season ?? null;
  const latestSnapshot = snapshots[0] ?? null;
  const updatedAt = apiMeta?.lastUpdated ?? manifest?.generated_at_utc ?? latestSnapshot?.stored_at ?? null;

  const movers = useMemo(() => {
    const all = deltas?.deltas ?? [];
    const rising = all
      .filter((d) => (d.tier_score_delta ?? 0) > 0)
      .sort((a, b) => (b.tier_score_delta ?? 0) - (a.tier_score_delta ?? 0));
    const falling = all
      .filter((d) => (d.tier_score_delta ?? 0) < 0)
      .sort((a, b) => (a.tier_score_delta ?? 0) - (b.tier_score_delta ?? 0));
    return { rising: rising.slice(0, 5), falling: falling.slice(0, 5) };
  }, [deltas]);

  // Lima perubahan hero paling terkini dalam arkib.
  const recentBalance = useMemo(() => {
    if (!archive) return [];
    const ordered = [...archive.core.hero_changes].sort((a, b) =>
      compareVersions(b.version, a.version)
    );
    return ordered.slice(0, 5);
  }, [archive]);

  const heroByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const hero of heroes) map.set(hero.name.toLowerCase(), hero.id);
    return map;
  }, [ heroes]);

  if (status === 'loading' && heroes.length === 0) {
    return (
      <div className="page">
        <div className="state">Memuat dataset…</div>
      </div>
    );
  }

  return (
    <div className="page page--meta">
      {/* 1. StatusStrip */}
      <div className="statusstrip">
        <div className="statusstrip__main">
          <span className="statusstrip__patch">{latestPatch?.version ?? '—'}</span>
          {season?.season ? <span className="statusstrip__season">Season {season.season}</span> : null}
          <span className="statusstrip__updated">
            dikemas kini {formatRelative(updatedAt)}
            {apiMeta?.nextUpdateAt ? ` · seterusnya ${formatDateTime(apiMeta.nextUpdateAt)} UTC` : ''}
          </span>
        </div>
        <div className="statusstrip__meta">
          {latestPatch?.date ? <span>tarikh patch {latestPatch.date}</span> : null}
          {snapshots.length > 0 ? <span>{snapshots.length} snapshot</span> : null}
        </div>
      </div>

      {/* 2. KpiRow */}
      <div className="kpirow">
        <Stat
          label="Purata win rate"
          value={formatPercent(stats.avgWinRate)}
          note={`${stats.rated} hero ber-rate`}
        />
        <Stat
          label="Paling banyak di-ban"
          value={
            stats.mostBanned ? (
              <Link to={`/heroes/${stats.mostBanned.id}`} className="kpi__link">
                {stats.mostBanned.name}
              </Link>
            ) : (
              '—'
            )
          }
          note={stats.mostBanned ? `ban ${formatPercent(stats.mostBanned.value)}` : undefined}
          accent="fall"
        />
        <Stat
          label="Paling banyak di-pick"
          value={
            stats.mostPicked ? (
              <Link to={`/heroes/${stats.mostPicked.id}`} className="kpi__link">
                {stats.mostPicked.name}
              </Link>
            ) : (
              '—'
            )
          }
          note={stats.mostPicked ? `pick ${formatPercent(stats.mostPicked.value)}` : undefined}
          accent="live"
        />
        <Stat
          label="Hero ber-rate"
          value={stats.rated}
          note={`dari ${stats.total} hero`}
          accent="archive"
        />
      </div>

      {/* 3. RoleWrBars */}
      <Panel title="Purata win rate ikut role" hint="seluruh rank">
        {Object.keys(stats.avgWinRateByRole).length === 0 ? (
          <div className="state">Data unavailable</div>
        ) : (
          <div className="rolebars">
            {Object.entries(stats.avgWinRateByRole)
              .sort((a, b) => b[1] - a[1])
              .map(([role, value]) => (
                <div className="rolebar" key={role}>
                  <span className="rolebar__name">{role}</span>
                  <span className="rolebar__track">
                    <span className="rolebar__fill" style={{ width: `${Math.max(2, Math.min(100, ((value - 45) / 10) * 100))}%` }} />
                  </span>
                  <span className="rolebar__value">{formatPercent(value)}</span>
                </div>
              ))}
          </div>
        )}
      </Panel>

      {/* 4. MoversSnapshot */}
      <div className="metacols">
        <Panel
          title="Naik"
          hint={`${deltas?.window ?? '7d'}`}
          action={
            <Link to="/movers" className="panel__link">
              Semua movers
            </Link>
          }
        >
          {movers.rising.length === 0 ? (
            <div className="state">{deltas?.available === false ? deltas.message ?? 'Data unavailable' : 'Data unavailable'}</div>
          ) : (
            <ul className="minilist">
              {movers.rising.map((delta) => (
                <li key={delta.id} className="minilist__row">
                  <Link to={`/heroes/${delta.id}`} className="minilist__name">
                    {delta.name}
                  </Link>
                  <TierBadge tier={delta.tier} />
                  <span className="minilist__rate">{formatPercent(delta.win_rate)}</span>
                  <Delta value={delta.tier_score_delta} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Turun" hint={`${deltas?.window ?? '7d'}`}>
          {movers.falling.length === 0 ? (
            <div className="state">{deltas?.available === false ? deltas.message ?? 'Data unavailable' : 'Data unavailable'}</div>
          ) : (
            <ul className="minilist">
              {movers.falling.map((delta) => (
                <li key={delta.id} className="minilist__row">
                  <Link to={`/heroes/${delta.id}`} className="minilist__name">
                    {delta.name}
                  </Link>
                  <TierBadge tier={delta.tier} />
                  <span className="minilist__rate">{formatPercent(delta.win_rate)}</span>
                  <Delta value={delta.tier_score_delta} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* 5. RecentBalance */}
      <Panel
        title="Balance terbaru"
        hint={recentBalance[0] ? `patch ${recentBalance[0].version}` : 'arkib'}
        action={
          <Link to="/patches" className="panel__link">
            Semua patch
          </Link>
        }
      >
        {recentBalance.length === 0 ? (
          <div className="state">Data unavailable</div>
        ) : (
          <ul className="balancerows">
            {recentBalance.map((change, index) => {
              const heroId = heroByName.get(change.hero.toLowerCase());
              const hero = heroes.find((h) => h.id === heroId);
              return (
                <li className="balancerow" key={`${change.hero}-${change.version}-${index}`}>
                  <Link to={`/heroes/${heroId ?? change.hero}`} className="balancerow__hero">
                    {hero ? (
                      <Portrait
                        name={hero.name}
                        iconUrl={hero.icon_url}
                        portraitUrl={hero.portrait_url}
                        roles={hero.roles}
                        size={28}
                      />
                    ) : null}
                    <span>{change.hero}</span>
                  </Link>
                  <PatchTag type={change.change_type} />
                  <Link to={`/patches/${encodeURIComponent(change.version)}`} className="balancerow__patch">
                    {change.version}
                  </Link>
                  <span className="balancerow__summary">{change.detail}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
