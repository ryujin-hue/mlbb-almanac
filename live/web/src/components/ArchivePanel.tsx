import { useEffect, useState } from 'react';

import { archiveApi, type ArchiveDocs, type ArchiveIndex, type ArchiveReference } from '../data/archive';
import { Markdown } from './Markdown';
import { ReferenceSection } from './ReferenceSection';

interface Props {
  /** Indeks arkib teras (sudah dimuat). */
  archive: ArchiveIndex | null;
}

/**
 * Panel arkib dalam tab Data.
 *
 * Menunjuk tiga hal yang tiada dalam meta live:
 *   - Provenans: berapa patch, berapa perubahan, dari mana datangnya.
 *   - Rujukan: 13 jadual statik (role, lane, emblem, spell, mata wang, ...).
 *   - Dokumen: kamus istilah, garis masa, sejarah meta, laporan research.
 */
export function ArchivePanel({ archive }: Props) {
  const [reference, setReference] = useState<ArchiveReference | null>(null);
  const [docs, setDocs] = useState<ArchiveDocs | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    archiveApi
      .reference()
      .then((data) => {
        if (!cancelled) setReference(data);
      })
      .catch(() => undefined);
    archiveApi
      .docs()
      .then((data) => {
        if (!cancelled) setDocs(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!archive) {
    return (
      <section className="panel">
        <div className="panel__head">
          <h2>Arkib Sejarah</h2>
        </div>
        <div className="state">Memuat arkib…</div>
      </section>
    );
  }

  const counts = archive.core.manifest.counts;
  const latest = archive.core.patches[archive.core.patches.length - 1];

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2>Arkib Sejarah Patch</h2>
          <span className="panel__hint">
            {archive.core.manifest.source} &middot; {archive.core.manifest.generated_at.slice(0, 10)}
          </span>
        </div>

        <div className="statgrid">
          <div className="stat">
            <div className="stat__label">Versi Patch</div>
            <div className="stat__value">{counts.patches}</div>
            <div className="stat__note">terkini {latest?.version ?? '—'}</div>
          </div>
          <div className="stat">
            <div className="stat__label">Perubahan Hero</div>
            <div className="stat__value">{counts.hero_changes}</div>
            <div className="stat__note">{counts.heroes} hero direkod</div>
          </div>
          <div className="stat">
            <div className="stat__label">Perubahan Item</div>
            <div className="stat__value">{counts.item_changes}</div>
            <div className="stat__note">{counts.items} item direkod</div>
          </div>
          <div className="stat">
            <div className="stat__label">Rujukan</div>
            <div className="stat__value">{counts.reference_tables}</div>
            <div className="stat__note">{counts.documents} dokumen</div>
          </div>
        </div>
      </section>

      {reference && reference.tables.length > 0 ? (
        <section className="panel">
          <div className="panel__head">
            <h2>Jadual Rujukan</h2>
            <span className="panel__hint">{reference.tables.length} jadual</span>
          </div>
          <ReferenceSection tables={reference.tables} />
        </section>
      ) : null}

      {docs && docs.docs.length > 0 ? (
        <section className="panel">
          <div className="panel__head">
            <h2>Dokumen</h2>
            <span className="panel__hint">{docs.docs.length} dokumen</span>
          </div>
          <ul className="doclist">
            {docs.docs.map((doc) => {
              const open = openDoc === doc.id;
              return (
                <li key={doc.id} className={`doclist__item${open ? ' doclist__item--open' : ''}`}>
                  <button
                    type="button"
                    className="doclist__head"
                    onClick={() => setOpenDoc(open ? null : doc.id)}
                    aria-expanded={open}
                  >
                    <span className="doclist__caret" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                    <span className="doclist__title">{doc.title}</span>
                    <span className="doclist__file">{doc.file}</span>
                  </button>
                  {open ? (
                    <div className="doclist__body">
                      <Markdown source={doc.markdown} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
