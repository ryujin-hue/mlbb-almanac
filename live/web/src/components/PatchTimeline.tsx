import { useMemo, useState } from 'react';

import {
  changeTypeClass,
  compareVersions,
  type ArchiveIndex,
} from '../data/archive';

interface Props {
  index: ArchiveIndex;
  onOpenHero: (heroId: string) => void;
}

type Mode = 'all' | 'hero' | 'item';

/**
 * Garis masa patch.
 *
 * Sumber: archive/patch_index.csv (87 versi) digabung dengan
 * archive/hero_changes.csv (350 baris) dan archive/item_changes.csv (99 baris).
 * Ini lapisan "sejarah" - live meta (win rate, pick/ban) tetap di tab Hero.
 */
export function PatchTimeline({ index, onOpenHero }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('all');
  const [open, setOpen] = useState<string | null>(null);

  const { patches, manifest } = index.core;

  // Patch dengan perubahan, newest first.
  const ordered = useMemo(
    () => [...patches].sort((a, b) => compareVersions(b.version, a.version)),
    [patches]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((patch) => {
      if (patch.version.toLowerCase().includes(needle)) return true;
      const bucket = index.changesByVersion.get(patch.version);
      if (!bucket) return false;
      return (
        bucket.heroes.some(
          (change) =>
            change.hero.toLowerCase().includes(needle) ||
            change.detail.toLowerCase().includes(needle)
        ) ||
        bucket.items.some(
          (change) =>
            change.item.toLowerCase().includes(needle) ||
            change.detail.toLowerCase().includes(needle)
        )
      );
    });
  }, [ordered, query, index]);

  const withChanges = ordered.filter(
    (patch) => patch.hero_change_count > 0 || patch.item_change_count > 0
  ).length;

  return (
    <div className="patch">
      <div className="patch__head">
        <div>
          <h2 className="patch__title">Riwayat Patch</h2>
          <p className="patch__sub">
            {manifest.counts.patches} versi patch sejak 2016 &middot; {manifest.counts.hero_changes}{' '}
            perubahan hero &middot; {manifest.counts.item_changes} perubahan item
          </p>
        </div>
        <div className="patch__stats">
          <div className="patch__stat">
            <div className="patch__stat-v">{withChanges}</div>
            <div className="patch__stat-k">patch ada nota</div>
          </div>
          <div className="patch__stat">
            <div className="patch__stat-v">{ordered[0]?.version ?? '—'}</div>
            <div className="patch__stat-k">terkini</div>
          </div>
        </div>
      </div>

      <div className="patch__controls">
        <input
          className="field"
          type="search"
          value={query}
          placeholder="Cari patch, hero, atau item…"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Cari dalam riwayat patch"
        />
        <div className="chips">
          {(
            [
              ['all', 'Semua'],
              ['hero', 'Hero'],
              ['item', 'Item'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="state">
          <p>Tiada patch yang sepadan dengan &ldquo;{query}&rdquo;.</p>
          <p>Cuba nama hero, nama item, atau nombor versi patch.</p>
        </div>
      ) : null}

      <ol className="patch__list">
        {filtered.map((patch) => {
          const bucket = index.changesByVersion.get(patch.version);
          const heroChanges = mode === 'item' ? [] : (bucket?.heroes ?? []);
          const itemChanges = mode === 'hero' ? [] : (bucket?.items ?? []);
          const expanded = open === patch.version;

          return (
            <li key={patch.version} className={`pitem${expanded ? ' pitem--open' : ''}`}>
              <button
                type="button"
                className="pitem__head"
                onClick={() => setOpen(expanded ? null : patch.version)}
                aria-expanded={expanded}
              >
                <span className="pitem__caret" aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
                <span className="pitem__ver">{patch.version}</span>
                <span className="pitem__date">{patch.date || '—'}</span>
                <span className="pitem__counts">
                  {patch.hero_change_count > 0 ? (
                    <span className="pitem__count">{patch.hero_change_count} hero</span>
                  ) : null}
                  {patch.item_change_count > 0 ? (
                    <span className="pitem__count pitem__count--item">{patch.item_change_count} item</span>
                  ) : null}
                  {patch.hero_change_count === 0 && patch.item_change_count === 0 ? (
                    <span className="pitem__count pitem__count--none">tiada nota</span>
                  ) : null}
                </span>
              </button>

              {expanded ? (
                <div className="pitem__body">
                  {heroChanges.length > 0 ? (
                    <>
                      <div className="pitem__label">Perubahan Hero</div>
                      <ul className="chg">
                        {heroChanges.map((change, i) => (
                          <ChangeRow
                            key={`${change.hero}-${change.version}-${i}`}
                            name={change.hero}
                            type={change.change_type}
                            detail={change.detail}
                            date={change.date}
                            source={change.source}
                            onClick={onOpenHero}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {itemChanges.length > 0 ? (
                    <>
                      <div className="pitem__label">Perubahan Item</div>
                      <ul className="chg">
                        {itemChanges.map((change, i) => (
                          <ChangeRow
                            key={`${change.item}-${change.version}-${i}`}
                            name={change.item}
                            type={change.change_type}
                            detail={change.detail}
                            date={change.date}
                            source={change.source}
                          />
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {heroChanges.length === 0 && itemChanges.length === 0 ? (
                    <p className="pitem__none">
                      Patch ini tiada nota perubahan hero atau item dalam arkib. Sumber patch:{' '}
                      {patch.source ? (
                        <a href={patch.source} target="_blank" rel="noreferrer noopener">
                          halaman patch
                        </a>
                      ) : (
                        '—'
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ChangeRow({
  name,
  type,
  detail,
  date,
  source,
  onClick,
}: {
  name: string;
  type: string;
  detail: string;
  date: string;
  source: string;
  onClick?: (heroId: string) => void;
}) {
  const kind = changeTypeClass(type);
  const body = (
    <>
      <span className={`chg__type chg__type--${kind}`}>{type || '—'}</span>
      <span className="chg__name">{name}</span>
      {date ? <span className="chg__date">{date}</span> : null}
      {detail ? <span className="chg__detail">{detail}</span> : null}
      {source ? (
        <span className="chg__src">
          <a href={source} target="_blank" rel="noreferrer noopener" onClick={(event) => event.stopPropagation()}>
            sumber
          </a>
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <li className="chg__row chg__row--link">
        <button type="button" className="chg__btn" onClick={() => onClick(name)}>
          {body}
        </button>
      </li>
    );
  }

  return <li className="chg__row">{body}</li>;
}
