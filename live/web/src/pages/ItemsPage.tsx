/**
 * Katalog item - /items
 *
 * Kad atau jadual. Setiap item bolehrainer patch yang menyentuh dirinya.
 */
import { useMemo, useState } from 'react';

import { EmptyState, PatchTag } from '../components/ui';
import type { ArchiveIndex } from '../data/archive';
import { Link } from '../router';

interface Props {
  archive: ArchiveIndex | null;
  archiveStatus: 'loading' | 'ready' | 'error';
}

type Mode = 'cards' | 'table';

export function ItemsPage({ archive, archiveStatus }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState<Mode>('cards');
  const [open, setOpen] = useState<string | null>(null);

  const items = archive?.core.items ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.category) set.add(item.category);
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!needle) return true;
      return (
        item.item.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle) ||
        item.build_path.toLowerCase().includes(needle) ||
        item.unique_passives.toLowerCase().includes(needle)
      );
    });
  }, [items, query, category]);

  if (archiveStatus === 'loading') {
    return (
      <div className="page">
        <div className="state">Memuat katalog item…</div>
      </div>
    );
  }

  if (archiveStatus === 'error' || !archive) {
    return (
      <div className="page">
        <EmptyState title="Data unavailable" detail="Katalog item tidak dapat dimuatkan." />
      </div>
    );
  }

  return (
    <div className="page page--items">
      <div className="toolbar">
        <div className="toolbar__row">
          <div className="toolbar__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder="Cari item…"
              aria-label="Cari item"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="toggle" role="group" aria-label="Paparan">
            <button
              type="button"
              className={`toggle__btn${mode === 'cards' ? ' toggle__btn--on' : ''}`}
              onClick={() => setMode('cards')}
            >
              Kad
            </button>
            <button
              type="button"
              className={`toggle__btn${mode === 'table' ? ' toggle__btn--on' : ''}`}
              onClick={() => setMode('table')}
            >
              Jadual
            </button>
          </div>

          <span className="toolbar__count">{filtered.length} item</span>
        </div>

        <div className="toolbar__row toolbar__scroll">
          <button
            type="button"
            className="chip"
            aria-pressed={category === 'all'}
            onClick={() => setCategory('all')}
          >
            Semua
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Tiada item yang sepadan" detail="Cuba nama lain atau pilih kategori Semua." />
      ) : mode === 'cards' ? (
        <div className="itemgrid">
          {filtered.map((item) => {
            const expanded = open === item.item;
            const history = archive.itemChangesByItem.get(item.item.toLowerCase()) ?? [];
            return (
              <article className={`icard${expanded ? ' icard--open' : ''}`} key={item.item}>
                <button
                  type="button"
                  className="icard__head"
                  onClick={() => setOpen(expanded ? null : item.item)}
                  aria-expanded={expanded}
                >
                  <span className="icard__img">
                    {item.image ? (
                      <img src={item.image} alt="" width={34} height={34} loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className="icard__id">
                    <span className="icard__name">{item.item}</span>
                    <span className="icard__meta">
                      {item.category || '—'}
                      {item.price_gold > 0 ? ` · ${item.price_gold} gold` : ''}
                    </span>
                  </span>
                  {item.change_count > 0 ? (
                    <PatchTag type={item.last_change_type} count={item.change_count} />
                  ) : null}
                </button>

                {expanded ? (
                  <div className="icard__body">
                    <dl className="kv">
                      <div>
                        <dt>Kategori</dt>
                        <dd>{item.category || '—'}</dd>
                      </div>
                      <div>
                        <dt>Harga</dt>
                        <dd>{item.price_gold > 0 ? `${item.price_gold} gold` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Build path</dt>
                        <dd>{item.build_path || '—'}</dd>
                      </div>
                      <div>
                        <dt>Passive unik</dt>
                        <dd>{item.unique_passives || '—'}</dd>
                      </div>
                    </dl>

                    {history.length > 0 ? (
                      <ul className="chglist">
                        {history.map((change, index) => (
                          <li className="chgrow" key={`${change.version}-${index}`}>
                            <PatchTag type={change.change_type} />
                            <Link to={`/patches/${encodeURIComponent(change.version)}`} className="chgrow__version">
                              {change.version}
                            </Link>
                            {change.date ? <span className="chgrow__date">{change.date}</span> : null}
                            <span className="chgrow__detail">{change.detail}</span>
                            {change.old_value ? (
                              <span className="chgrow__change">
                                <span className="tbl__old">{change.old_value}</span>
                                <span className="tbl__arrow" aria-hidden="true">
                                  →
                                </span>
                                <span className="tbl__new">{change.new_value}</span>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Tiada nota perubahan item ini dalam arkib.</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>Kategori</th>
                <th className="num">Gold</th>
                <th>Build path</th>
                <th>Patch terakhir</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.item}>
                  <td>{item.item}</td>
                  <td className="muted">{item.category || '—'}</td>
                  <td className="num">{item.price_gold > 0 ? item.price_gold : '—'}</td>
                  <td className="muted">{item.build_path || '—'}</td>
                  <td>
                    {item.change_count > 0 ? (
                      <span className="typetags">
                        <PatchTag type={item.last_change_type} />
                        <Link to={`/patches/${encodeURIComponent(item.last_change_version)}`} className="tbl__patch">
                          {item.last_change_version}
                        </Link>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
