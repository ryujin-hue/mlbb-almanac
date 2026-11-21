import { useMemo } from 'react';

import {
  changeTypeClass,
  compareVersions,
  type ArchiveHero,
  type ArchiveHeroChange,
  type ArchiveIndex,
} from '../data/archive';

interface Props {
  index: ArchiveIndex;
  heroName: string;
}

/**
 * Riwayat patch satu hero.
 *
 * Ini titik pertemuan dua sumber: live meta (win rate, pick/ban, tier)
 * berada di atas, sejarah patch (bilangan buff/nerf, nota setiap patch)
 * di bawah. Sumber sejarah: archive/hero_changes.csv + archive/hero_master.csv.
 */
export function HeroHistory({ index, heroName }: Props) {
  const key = heroName.trim().toLowerCase();

  const record: ArchiveHero | undefined = useMemo(
    () => index.heroByName.get(key),
    [index, key]
  );

  const changes: ArchiveHeroChange[] = useMemo(
    () => index.heroChangesByHero.get(key) ?? [],
    [index, key]
  );

  if (!record && changes.length === 0) {
    return (
      <>
        <div className="section-title">Riwayat Patch</div>
        <p className="pitem__none">
          Tiada rekod arkib untuk {heroName}. Sejarah patch arkib meliputi 87 versi sejak 2016.
        </p>
      </>
    );
  }

  const ordered = [...changes].sort((a, b) => compareVersions(b.version, a.version));

  return (
    <>
      <div className="section-title">Riwayat Patch</div>

      {record ? (
        <dl className="kv kv--tight">
          <div>
            <dt>Rilis</dt>
            <dd>
              {/\d/.test(record.release_version) ? record.release_version : '—'}
              {record.release_date ? ` · ${record.release_date}` : ''}
            </dd>
          </div>
          <div>
            <dt>Role / Lane</dt>
            <dd>
              {record.role || '—'}
              {record.lane ? ` · ${record.lane}` : ''}
            </dd>
          </div>
          <div>
            <dt>Buff / Nerf / Adjust</dt>
            <dd>
              {record.total_buffs > 0 ? (
                <span className="chg__type chg__type--buff">{record.total_buffs} buff</span>
              ) : null}
              {record.total_nerfs > 0 ? (
                <span className="chg__type chg__type--nerf">{record.total_nerfs} nerf</span>
              ) : null}
              {record.total_adjusts > 0 ? (
                <span className="chg__type chg__type--adjust">{record.total_adjusts} adjust</span>
              ) : null}
              {record.reworked ? (
                <span className="chg__type chg__type--rework">rework</span>
              ) : null}
              {record.total_buffs === 0 &&
              record.total_nerfs === 0 &&
              record.total_adjusts === 0 &&
              !record.reworked ? (
                <span className="pitem__none" style={{ margin: 0 }}>
                  tiada rekod buff/nerf
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Nota patch</dt>
            <dd>{changes.length} rekod dalam arkib</dd>
          </div>
        </dl>
      ) : null}

      {ordered.length > 0 ? (
        <ul className="chg chg--boxed">
          {ordered.map((change, i) => (
            <li key={`${change.version}-${i}`} className="chg__row">
              <span className={`chg__type chg__type--${changeTypeClass(change.change_type)}`}>
                {change.change_type || '—'}
              </span>
              <span className="chg__name">{change.version}</span>
              {change.date ? <span className="chg__date">{change.date}</span> : null}
              {change.detail ? <span className="chg__detail">{change.detail}</span> : null}
              {change.source ? (
                <span className="chg__src">
                  <a href={change.source} target="_blank" rel="noreferrer noopener">
                    sumber
                  </a>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {record?.sources ? (
        <p className="icard__src">
          Sumber arkib:{' '}
          {record.sources.split(';').map((source, i) => {
            const url = source.trim();
            if (!url.startsWith('http')) return <span key={i}>{url} </span>;
            return (
              <a key={i} href={url} target="_blank" rel="noreferrer noopener">
                {url.replace(/^https?:\/\//, '').split('/')[0]}
              </a>
            );
          })}
        </p>
      ) : null}
    </>
  );
}
