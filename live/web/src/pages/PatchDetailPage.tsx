/**
 * Detail patch - /patches/:version
 *
 * Tiga seksyen: Hero | Item | System. Semua baris daripada arkib -
 * tiada apa-apa yang ditambah atau diteka.
 */
import { useMemo, useState } from 'react';

import { EmptyState, PatchTag } from '../components/ui';
import { heroSlug, type ArchiveIndex } from '../data/archive';
import { Link } from '../router';

interface Props {
  version: string;
  archive: ArchiveIndex | null;
  archiveStatus: 'loading' | 'ready' | 'error';
}

type Section = 'heroes' | 'items' | 'system';

export function PatchDetailPage({ version, archive, archiveStatus }: Props) {
  const [section, setSection] = useState<Section>('heroes');

  const patch = useMemo(
    () => archive?.core.patches.find((entry) => entry.version === version) ?? null,
    [archive, version]
  );

  const changes = useMemo(
    () => archive?.changesByVersion.get(version) ?? { heroes: [], items: [] },
    [archive, version]
  );

  const systems = useMemo(() => archive?.systemsByVersion.get(version) ?? [], [archive, version]);

  if (archiveStatus === 'loading') {
    return (
      <div className="page">
        <div className="state">Memuat arkib patch…</div>
      </div>
    );
  }

  if (archiveStatus === 'error' || !archive) {
    return (
      <div className="page">
        <EmptyState title="Data unavailable" detail="Arkib patch tidak dapat dimuatkan." />
      </div>
    );
  }

  if (!patch) {
    return (
      <div className="page">
        <EmptyState
          title="Versi patch tidak dijumpai"
          detail={`Tiada rekod untuk versi ${version}.`}
        />
        <Link to="/patches" className="backlink">
          ← Kembali ke senarai patch
        </Link>
      </div>
    );
  }

  const heroCount = changes.heroes.length;
  const itemCount = changes.items.length;

  return (
    <div className="page page--patchdetail">
      <Link to="/patches" className="backlink">
        ← Kembali ke senarai patch
      </Link>

      <header className="patchhead">
        <div>
          <h1 className="patchhead__version">{patch.version}</h1>
          <div className="patchhead__date">{patch.date || '—'}</div>
        </div>
        <div className="patchhead__counts">
          <span>{heroCount} perubahan hero</span>
          <span>{itemCount} perubahan item</span>
          <span>{systems.length} nota sistem</span>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={section === 'heroes'}
          className={`tabs__btn${section === 'heroes' ? ' tabs__btn--on' : ''}`}
          onClick={() => setSection('heroes')}
        >
          Hero
          {heroCount > 0 ? <span className="tabs__count">{heroCount}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'items'}
          className={`tabs__btn${section === 'items' ? ' tabs__btn--on' : ''}`}
          onClick={() => setSection('items')}
        >
          Item
          {itemCount > 0 ? <span className="tabs__count">{itemCount}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === 'system'}
          className={`tabs__btn${section === 'system' ? ' tabs__btn--on' : ''}`}
          onClick={() => setSection('system')}
        >
          System
          {systems.length > 0 ? <span className="tabs__count">{systems.length}</span> : null}
        </button>
      </div>

      {section === 'heroes' ? (
        changes.heroes.length === 0 ? (
          <EmptyState title="Tiada perubahan hero" detail="Arkib tidak menyenaraikan hero untuk patch ini." />
        ) : (
          <div className="tablewrap">
            <table className="tbl tbl--patch">
              <colgroup>
                <col className="col-hero" />
                <col className="col-type" />
                <col className="col-summary" />
                <col className="col-oldnew" />
              </colgroup>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Jenis</th>
                  <th>Ringkasan</th>
                  <th>Lama → Baru</th>
                </tr>
              </thead>
              <tbody>
                {changes.heroes.map((change, index) => (
                  <tr key={`${change.hero}-${index}`}>
                    <td>
                      <Link to={`/heroes/${encodeURIComponent(heroSlug(change.hero))}`} className="tbl__patch">
                        {change.hero}
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
        )
      ) : null}

      {section === 'items' ? (
        changes.items.length === 0 ? (
          <EmptyState title="Tiada perubahan item" detail="Arkib tidak menyenaraikan item untuk patch ini." />
        ) : (
          <div className="tablewrap">
            <table className="tbl tbl--patch">
              <colgroup>
                <col className="col-hero" />
                <col className="col-type" />
                <col className="col-summary" />
                <col className="col-oldnew" />
              </colgroup>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Jenis</th>
                  <th>Ringkasan</th>
                  <th>Lama → Baru</th>
                </tr>
              </thead>
              <tbody>
                {changes.items.map((change, index) => (
                  <tr key={`${change.item}-${index}`}>
                    <td>
                      <Link to="/items" className="tbl__patch">
                        {change.item}
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
        )
      ) : null}

      {section === 'system' ? (
        systems.length === 0 ? (
          <EmptyState
            title="Tiada nota sistem"
            detail="Arkib tidak menyenaraikan perubahan sistem untuk patch ini."
          />
        ) : (
          <ul className="syslist">
            {systems.map((note, index) => (
              <li className="sysrow" key={`${note.aspect}-${index}`}>
                <div className="sysrow__head">
                  <span className="sysrow__system">{note.system}</span>
                  <span className="sysrow__aspect">{note.aspect}</span>
                </div>
                <div className="sysrow__detail">{note.detail}</div>
                {note.source ? (
                  <a className="sysrow__source" href={note.source} target="_blank" rel="noreferrer noopener">
                    sumber
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
