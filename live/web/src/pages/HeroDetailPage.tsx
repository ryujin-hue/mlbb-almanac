/**
 * Detail hero - /heroes/:id
 *
 * Dua tab:
 *   Overview         - angka live, rate ikut rank, kemahiran
 *   Balance history  - rekod perubahan dari arkib (hero_changes)
 *
 * Desktop: panel dalam halaman. Mobile: page penuh.
 */
import { useEffect, useMemo, useState } from 'react';

import {
  Delta,
  EmptyState,
  ErrorState,
  PatchTag,
  Portrait,
  StateBlock,
  TierBadge,
} from '../components/ui';
import { API, fetchJson, type HeroDetailResponse } from '../data/client';
import { useAlmanac } from '../data/AlmanacContext';
import type { ArchiveIndex } from '../data/archive';
import { formatDateTime, formatPercent } from '../lib/format';
import { Link, navigate } from '../router';

interface Props {
  heroId: string;
  archive: ArchiveIndex | null;
  archiveStatus?: 'loading' | 'ready' | 'error';
  archiveError?: string | null;
  reloadArchive?: () => void;
}

type Tab = 'overview' | 'balance';

interface DetailHero {
  id: string;
  name: string;
  title: string | null;
  roles: string[];
  lanes: string[];
  speciality: string[];
  damage_type: string | null;
  attack_type: string | null;
  portrait_url: string | null;
  icon_url: string | null;
  release_year: number | null;
  difficulty: number | null;
  price: number | null;
  skills: { id: string; name: string; type: string; label: string | null; description: string | null; icon_url: string | null }[];
  stats: {
    tier: string | null;
    win_rate: number | null;
    pick_rate: number | null;
    ban_rate: number | null;
    rank_scope: string | null;
    rates_by_rank: Record<string, { win_rate: number | null; pick_rate: number | null; ban_rate: number | null; tier: string | null }> | null;
  } | null;
}

export function HeroDetailPage({
  heroId,
  archive,
  archiveStatus = 'ready',
  archiveError,
  reloadArchive,
}: Props) {
  const { heroes, deltas } = useAlmanac();
  const [detail, setDetail] = useState<HeroDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setStatus('loading');
    setDetail(null);

    fetchJson<HeroDetailResponse>(API.heroDetail(heroId), { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => controller.abort();
  }, [heroId]);

  const hero = detail?.hero as DetailHero | undefined;
  const live = heroes.find((h) => h.id === heroId) ?? null;
  const delta = deltas?.deltas.find((d) => d.id === heroId) ?? null;

  // Sejarah arkib untuk hero ini.
  const history = useMemo(() => {
    if (!archive || !hero) return [];
    const key = (hero.name || heroId).toLowerCase();
    return archive.heroChangesByHero.get(key) ?? [];
  }, [archive, hero, heroId]);

  const record = useMemo(() => {
    if (!archive || !hero) return null;
    return archive.heroByName.get((hero.name || heroId).toLowerCase()) ?? null;
  }, [archive, hero, heroId]);

  if (status === 'loading') {
    return (
      <div className="page">
        <div className="state">Memuat detail hero…</div>
      </div>
    );
  }

  if (status === 'error' || !hero) {
    return (
      <div className="page">
        <ErrorState
          detail={error}
          onRetry={() => navigate(`/heroes/${heroId}`)}
        />
        <Link to="/heroes" className="backlink">
          ← Kembali ke senarai hero
        </Link>
      </div>
    );
  }

  const name = hero.name;

  return (
    <div className="page page--detail">
      <Link to="/heroes" className="backlink">
        ← Kembali ke senarai hero
      </Link>

      <header className="detailhead">
        <Portrait
          name={name}
          iconUrl={hero.icon_url}
          portraitUrl={hero.portrait_url}
          roles={hero.roles}
          size={72}
        />
        <div className="detailhead__id">
          <h1 className="detailhead__name">{name}</h1>
          {hero.title ? <div className="detailhead__title">{hero.title}</div> : null}
          <div className="detailhead__meta">
            <TierBadge tier={hero.stats?.tier ?? live?.tier ?? null} />
            <span>{hero.roles.join(' · ') || '—'}</span>
            {hero.damage_type ? <span>{hero.damage_type}</span> : null}
            <Delta value={delta?.tier_score_delta ?? null} />
          </div>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`tabs__btn${tab === 'overview' ? ' tabs__btn--on' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'balance'}
          className={`tabs__btn${tab === 'balance' ? ' tabs__btn--on' : ''}`}
          onClick={() => setTab('balance')}
        >
          Balance history
          {history.length > 0 ? <span className="tabs__count">{history.length}</span> : null}
        </button>
      </div>

      {tab === 'overview' ? (
        <div className="detailbody">
          <div className="kpirow kpirow--detail">
            <div className="stat">
              <div className="stat__label">Win rate</div>
              <div className="stat__value">{formatPercent(hero.stats?.win_rate)}</div>
              <div className="stat__note">rank {hero.stats?.rank_scope ?? 'all'}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Pick rate</div>
              <div className="stat__value">{formatPercent(hero.stats?.pick_rate)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Ban rate</div>
              <div className="stat__value">{formatPercent(hero.stats?.ban_rate)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Rilis</div>
              <div className="stat__value stat__value--sm">
                {record?.release_version && /\d/.test(record.release_version)
                  ? record.release_version
                  : hero.release_year ?? '—'}
              </div>
              {record?.release_date ? <div className="stat__note">{record.release_date}</div> : null}
            </div>
          </div>

          {hero.stats?.rates_by_rank ? (
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Rate ikut rank</h2>
              </div>
              <div className="tablewrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th className="num">WR</th>
                      <th className="num">PR</th>
                      <th className="num">BR</th>
                      <th className="num">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(hero.stats.rates_by_rank).map(([rank, row]) => (
                      <tr key={rank}>
                        <td>{rank}</td>
                        <td className="num">{formatPercent(row.win_rate)}</td>
                        <td className="num">{formatPercent(row.pick_rate)}</td>
                        <td className="num">{formatPercent(row.ban_rate)}</td>
                        <td className="num">{row.tier ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel__head">
              <h2 className="panel__title">Info</h2>
            </div>
            <div className="tablewrap">
              <table className="tbl">
                <tbody>
                  <tr>
                    <td>Role</td>
                    <td>{hero.roles.join(', ') || '—'}</td>
                  </tr>
                  <tr>
                    <td>Lane</td>
                    <td>{hero.lanes.join(', ') || '—'}</td>
                  </tr>
                  <tr>
                    <td>Tipe damage</td>
                    <td>{hero.damage_type ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Tipe serangan</td>
                    <td>{hero.attack_type ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Kesulitan</td>
                    <td>{hero.difficulty ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Harga</td>
                    <td>{hero.price ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Lane / release</td>
                    <td>
                      {(record?.lane ?? hero.lanes.join(', ')) || '—'}
                      {record?.release_date ? ` · ${record.release_date}` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {hero.skills?.length ? (
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Skill ({hero.skills.length})</h2>
              </div>
              <ul className="skills">
                {hero.skills.map((skill) => (
                  <li className="skills__row" key={skill.id}>
                    {skill.icon_url ? (
                      <img className="skills__icon" src={skill.icon_url} alt="" width={36} height={36} loading="lazy" />
                    ) : (
                      <span className="skills__icon skills__icon--empty" aria-hidden="true" />
                    )}
                    <div className="skills__text">
                      <div className="skills__name">
                        {skill.name}
                        {skill.label ? <span className="tag">{skill.label}</span> : null}
                      </div>
                      {skill.description ? <div className="skills__desc">{skill.description}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="detailbody">
          {archiveStatus === 'loading' ? (
            <StateBlock label="Memuat sejarah imbangan…" rows={2} />
          ) : archiveStatus === 'error' ? (
            <ErrorState
              title="Data unavailable"
              detail={archiveError ?? 'Arkib tidak dapat dimuatkan.'}
              onRetry={reloadArchive}
            />
          ) : history.length === 0 ? (
            <EmptyState
              title="Tiada rekod perubahan"
              detail="Arkib tidak menyenaraikan perubahan patch untuk hero ini."
            />
          ) : (
            <section className="panel">
              <div className="panel__head">
                <h2 className="panel__title">Balance history</h2>
                <span className="panel__hint">{history.length} rekod</span>
              </div>
              <div className="tablewrap">
                <table className="tbl tbl--history">
                  <thead>
                    <tr>
                      <th>Tarikh</th>
                      <th>Patch</th>
                      <th>Jenis</th>
                      <th>Ringkasan</th>
                      <th>Lama → Baru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((change, index) => (
                      <tr key={`${change.version}-${index}`}>
                        <td className="muted">{change.date || '—'}</td>
                        <td>
                          <Link to={`/patches/${encodeURIComponent(change.version)}`} className="tbl__patch">
                            {change.version}
                          </Link>
                        </td>
                        <td>
                          <PatchTag type={change.change_type} />
                        </td>
                        <td className="tbl__summary">{change.detail || '—'}</td>
                        <td className="tbl__change">
                          {change.old_value ? (
                            <>
                              <span className="tbl__old">{change.old_value}</span>
                              <span className="tbl__arrow" aria-hidden="true">
                                →
                              </span>
                              <span className="tbl__new">{change.new_value}</span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="panel__foot">
                Sumber: arkib patch Mobile Legends &middot; data{' '}
                {formatDateTime(archive?.core.manifest.generated_at ?? null)}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
