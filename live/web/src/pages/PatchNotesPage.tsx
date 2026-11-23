/**
 * Patch Notes - artikel patch notes daripada MLBB Hub.
 *
 * Ini lapisan THIRD-PARTY: MLBB Hub bukan Moonton. Setiap artikel dipaut
 * ke sumber asalnya, dan versi patch dipaut ke rekod arkib Almanac supaya
 * dua lapisan встреча pada satu nombor versi.
 *
 * Worker cachekan hasilnya di KV (sitemap + ld+json + badan artikel), jadi
 * halaman ini tidak menarik mlbbhub.com untuk setiap pelawat.
 */
import { useMemo, useState } from 'react';

import { useAlmanac } from '../data/AlmanacContext';
import { formatDateTime } from '../lib/format';
import { Link } from '../router';
import { EmptyState, ErrorState, Panel, StateBlock } from '../components/ui';

export function PatchNotesPage() {
  const { patchNotes, patchNotesStatus, archive } = useAlmanac();
  const [query, setQuery] = useState('');
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  /** Versi patch yang ada dalam arkib Almanac (untuk pautan silang). */
  const archiveVersions = useMemo(() => {
    const set = new Set<string>();
    for (const patch of archive?.core.patches ?? []) set.add(patch.version);
    return set;
  }, [archive]);

  const articles = useMemo(() => {
    const list = patchNotes?.articles ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (article) =>
        article.title.toLowerCase().includes(needle) ||
        (article.version ?? '').toLowerCase().includes(needle) ||
        article.summary.toLowerCase().includes(needle)
    );
  }, [patchNotes, query]);

  if (patchNotesStatus === 'loading') {
    return (
      <div className="page page--patchnotes">
        <StateBlock label="Memuat patch notes…" />
      </div>
    );
  }

  if (patchNotesStatus === 'error' || !patchNotes) {
    return (
      <div className="page page--patchnotes">
        <ErrorState
          title="Data unavailable"
          detail={
            patchNotes?.message ??
            'Patch notes daripada MLBB Hub tidak dapat dimuatkan sekarang.'
          }
          source={patchNotes?.source}
          sourceUrl={patchNotes?.source_url}
        />
      </div>
    );
  }

  return (
    <div className="page page--patchnotes">
      <div className="pagehead">
        <h1 className="pagehead__title">Patch Notes</h1>
        <p className="pagehead__sub">
          {patchNotes.count} artikel daripada {patchNotes.source}. Ditarik{' '}
          {formatDateTime(patchNotes.fetched_at)} UTC. Teks adalah kandungan MLBB Hub -{' '}
          <a href={patchNotes.source_url} target="_blank" rel="noreferrer noopener">
            buka sumber
          </a>
          .
        </p>
      </div>

      <div className="toolbar toolbar--flat">
        <div className="toolbar__row">
          <div className="toolbar__search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder="Cari patch notes…"
              aria-label="Cari patch notes"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="toolbar__count">{articles.length} artikel</span>
        </div>
      </div>

      {articles.length === 0 ? (
        <EmptyState
          title="Tiada artikel sepadan"
          detail="Cuba versi patch lain, atau kosongkan carian."
        />
      ) : (
        <ul className="notelist">
          {articles.map((article) => {
            const inArchive = article.version ? archiveVersions.has(article.version) : false;
            const open = openUrl === article.url;
            return (
              <li className="notecard" key={article.url}>
                <div className="notecard__grid">
                  {article.image ? (
                    <img className="notecard__img" src={article.image} alt="" loading="lazy" />
                  ) : null}
                  <div className="notecard__body">
                    <div className="notecard__meta">
                      {article.version ? (
                        <Link to={`/patches/${encodeURIComponent(article.version)}`} className="notecard__version">
                          {article.version}
                        </Link>
                      ) : null}
                      {article.published_at ? (
                        <span className="muted">{formatDateTime(article.published_at)}</span>
                      ) : null}
                      {inArchive ? (
                        <span className="chip chip--tiny">Ada dalam arkib</span>
                      ) : null}
                    </div>
                    <h2 className="notecard__title">
                      <a href={article.url} target="_blank" rel="noreferrer noopener">
                        {article.title}
                      </a>
                    </h2>
                    {article.summary ? <p className="notecard__summary">{article.summary}</p> : null}
                    <div className="notecard__actions">
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setOpenUrl(open ? null : article.url)}
                        aria-expanded={open}
                      >
                        {open ? 'Tutup' : 'Baca penuh'}
                      </button>
                      <a
                        className="btn btn--sm"
                        href={article.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Sumber
                      </a>
                    </div>
                    {open ? (
                      <div className="notecard__body-text">
                        {article.blocks.map((block, index) =>
                          block.kind === 'h' ? (
                            <h3 key={index}>{block.text}</h3>
                          ) : (
                            <p key={index}>{block.text}</p>
                          )
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Panel title="Mengapa sumber luar?" className="panel--spaced">
        <p className="muted">
          Almanac menyimpan perubahan hero dan item yang diekstrak daripada nota patch rasmi. Artikel
          ini ialahCompanion penulisan daripada MLBB Hub - berguna untuk konteks dan sebab di sebalik
          perubahan, tetapi bukan sumber rasmi Moonton.
        </p>
      </Panel>
    </div>
  );
}
