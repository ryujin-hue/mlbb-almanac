/**
 * Data - /data
 *
 * Transiparensi sahaja: status, sumber, snapshot, statistik arkib, jadual
 * rujukan, dokumen, dan pautan API. Tiada blok promosi.
 */
import { useEffect, useState } from 'react';

import { Markdown } from '../components/Markdown';
import { ReferenceSection } from '../components/ReferenceSection';
import { EmptyState, Panel, Stat } from '../components/ui';
import { useAlmanac } from '../data/AlmanacContext';
import { archiveApi, type ArchiveDocs, type ArchiveReference } from '../data/archive';
import { formatDateTime, formatRelative } from '../lib/format';

/**
 * Katalog API - dikelompokkan mengikut sumber data. Setiap endpoint ada
 * satu baris penerangan supaya senarai boleh digunakan tanpa membuka
 * dokumen.
 */
interface ApiEndpoint {
  path: string;
  desc: string;
}

interface ApiGroup {
  title: string;
  note: string;
  endpoints: ApiEndpoint[];
}

const API_GROUPS: ApiGroup[] = [
  {
    title: 'Meta live',
    note: 'Worker sendiri. Dikemas kini setiap hari 02:00 UTC, satu snapshot setiap hari.',
    endpoints: [
      { path: '/api/heroes?rank=all', desc: 'Senarai 133 hero dengan win, pick, ban rate dan tier' },
      { path: '/api/hero?id=lancelot', desc: 'Detail satu hero: rate, kemahiran, build, counter' },
      { path: '/api/meta', desc: 'Status runtime: patch, bila kemas kini, bila seterusnya' },
      { path: '/api/snapshots', desc: 'Senarai versi snapshot yang tersimpan' },
      { path: '/api/deltas?window=7d', desc: 'Perubahan tier/rate antara dua snapshot (1d/7d/30d)' },
    ],
  },
  {
    title: 'Komunitari',
    note: 'Sumber luar, diproksikan oleh Worker dan dicache di KV.',
    endpoints: [
      { path: '/api/patch-notes', desc: 'Artikel patch notes daripada MLBB Hub, dikemas kini harian' },
      { path: '/api/tournaments', desc: 'Tornean MLBB yang akan datang (PandaScore)' },
    ],
  },
  {
    title: 'Arkib (statik)',
    note: 'Dijana semasa build daripada CSV arkib - tanpa API, tanpa cache Worker.',
    endpoints: [
      { path: '/archive/core.json', desc: '87 versi patch, 350 perubahan hero, 99 perubahan item' },
      { path: '/archive/reference.json', desc: '13 jadual rujukan: role, lane, emblem, mata wang' },
      { path: '/archive/docs.json', desc: '5 dokumen: glosari, kronologi, sejarah meta, laporan' },
    ],
  },
];

export function DataPage() {
  const { manifest, snapshots, archive, archiveStatus, apiMeta } = useAlmanac();
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

  const counts = manifest?.counts;
  const archiveCounts = archive?.core.manifest.counts;

  return (
    <div className="page page--data">
      {/* 1. Status */}
      <Panel title="Status">
        <div className="kpirow">
          <Stat
            label="Crawl terakhir"
            value={formatRelative(apiMeta?.lastUpdated ?? manifest?.generated_at_utc ?? null)}
            note={formatDateTime(apiMeta?.lastUpdated ?? manifest?.generated_at_utc ?? null)}
          />
          <Stat label="Snapshot" value={snapshots.length} note="versi tersimpan" />
          <Stat label="Hero" value={counts?.heroes ?? '—'} note={`${counts?.rated_heroes ?? 0} ber-rate`} />
          <Stat label="Item" value={counts?.items ?? '—'} note="dalam dataset live" />
        </div>
      </Panel>

      {/* 2. Sumber + lesen */}
      <Panel title="Sumber">
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Lesen</th>
                <th>Diambil</th>
              </tr>
            </thead>
            <tbody>
              {(manifest?.sources ?? []).map((source) => (
                <tr key={source.url}>
                  <td>
                    <a href={source.url} target="_blank" rel="noreferrer noopener">
                      {source.name}
                    </a>
                  </td>
                  <td>{source.license}</td>
                  <td className="muted">{formatDateTime(source.retrieved_at_utc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* 3. Sejarah snapshot */}
      <Panel title="Sejarah snapshot" hint={`${snapshots.length} versi`}>
        {snapshots.length === 0 ? (
          <div className="state">Belum ada versi snapshot tersimpan.</div>
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Versi</th>
                  <th>Disimpan</th>
                  <th className="num">Hero</th>
                  <th className="num">Ber-rate</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.version}>
                    <td className="tbl__version">{snapshot.version}</td>
                    <td className="muted">{formatDateTime(snapshot.stored_at)}</td>
                    <td className="num">{snapshot.counts.heroes}</td>
                    <td className="num">{snapshot.counts.rated_heroes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* 4. Statistik arkib */}
      <Panel title="Statistik arkib" hint={archive?.core.manifest.source ?? undefined}>
        {archiveStatus === 'loading' ? (
          <div className="state">Memuat arkib…</div>
        ) : archiveCounts ? (
          <div className="kpirow">
            <Stat label="Versi patch" value={archiveCounts.patches} accent="archive" />
            <Stat label="Perubahan hero" value={archiveCounts.hero_changes} />
            <Stat label="Perubahan item" value={archiveCounts.item_changes} />
            <Stat label="Jadual rujukan" value={archiveCounts.reference_tables} />
          </div>
        ) : (
          <EmptyState title="Data unavailable" detail="Arkib tidak dapat dimuatkan." />
        )}
      </Panel>

      {/* 5. Jadual rujukan */}
      {reference && reference.tables.length > 0 ? (
        <Panel title="Jadual rujukan" hint={`${reference.tables.length} jadual`}>
          <ReferenceSection tables={reference.tables} />
        </Panel>
      ) : null}

      {/* 6. Dokumen */}
      {docs && docs.docs.length > 0 ? (
        <Panel title="Dokumen" hint={`${docs.docs.length} dokumen`}>
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
        </Panel>
      ) : null}

      {/* 7. Katalog API - dikelompokkan mengikut sumber */}
      <Panel title="API" hint="8 endpoint langsung + arkib penuh (78 endpoint)">
        <div className="apigroups">
          {API_GROUPS.map((group) => (
            <section className="apigroup" key={group.title}>
              <h3 className="apigroup__title">{group.title}</h3>
              <p className="apigroup__note">{group.note}</p>
              <ul className="apilist">
                {group.endpoints.map((endpoint) => (
                  <li key={endpoint.path}>
                    <a href={endpoint.path} target="_blank" rel="noreferrer noopener">
                      {endpoint.path}
                    </a>
                    <span className="apilist__desc">{endpoint.desc}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="panel__foot">
          Arkib penuh (78 endpoint, FastAPI) berada dalam repositori{' '}
          <a
            href="https://github.com/ryujin-hue/mlbb-almanac/tree/main/archive"
            target="_blank"
            rel="noreferrer noopener"
          >
            mlbb-almanac/archive
          </a>
          .
        </p>
      </Panel>
    </div>
  );
}
