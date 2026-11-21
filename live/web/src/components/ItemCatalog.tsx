import { useMemo, useState } from 'react';

import { changeTypeClass, type ArchiveIndex } from '../data/archive';

interface Props {
  index: ArchiveIndex;
}

/**
 * Katalog item.
 *
 * Sumber: archive/items_master.csv (104 item: kategori, harga, build path,
 * passive unik) digabung dengan archive/item_changes.csv (99 baris nota
 * perubahan). Item image datang daripada arkib (images/items).
 */
export function ItemCatalog({ index }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);

  const items = index.core.items;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.category) set.add(item.category);
    return [...set].sort((a, b) => a.localeCompare(b));
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

  return (
    <div className="catalog">
      <div className="patch__head">
        <div>
          <h2 className="patch__title">Katalog Item</h2>
          <p className="patch__sub">
            {items.length} item &middot; {categories.length} kategori &middot;{' '}
            {index.core.item_changes.length} nota perubahan
          </p>
        </div>
      </div>

      <div className="patch__controls">
        <input
          className="field"
          type="search"
          value={query}
          placeholder="Cari item, kategori, atau passive…"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Cari item"
        />
        <div className="chips chips--scroll">
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
        <div className="state">
          <p>Tiada item yang sepadan.</p>
          <p>Cuba nama lain atau pilih kategori &ldquo;Semua&rdquo;.</p>
        </div>
      ) : null}

      <ul className="catalog__list">
        {filtered.map((item) => {
          const history = index.itemChangesByItem.get(item.item.toLowerCase()) ?? [];
          const expanded = open === item.item;

          return (
            <li key={item.item} className={`icard${expanded ? ' icard--open' : ''}`}>
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
                  <span className="icard__badge" title="Nota perubahan dalam arkib">
                    {item.change_count}× patch
                  </span>
                ) : null}
                <span className="pitem__caret" aria-hidden="true">
                  {expanded ? '▾' : '▸'}
                </span>
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
                    <>
                      <div className="pitem__label">Riwayat Perubahan</div>
                      <ul className="chg">
                        {history.map((change, i) => (
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
                    </>
                  ) : (
                    <p className="pitem__none">Tiada nota perubahan item ini dalam arkib.</p>
                  )}

                  {item.sources ? (
                    <p className="icard__src">
                      Sumber:{' '}
                      {item.sources.split(';').map((source, i) => {
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
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
