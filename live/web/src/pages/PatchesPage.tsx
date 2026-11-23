/**
 * Indeks patch - /patches
 *
 * Patch terkini dipin di atas; senarai penuh di bawah. Semua data dari
 * arkib: patch_index + hero_changes + item_changes.
 */
import { useMemo, useState } from 'react';

import { EmptyState, PatchTag } from '../components/ui';
import type { ArchiveIndex } from '../data/archive';
import { Link } from '../router';

interface Props {
  archive: ArchiveIndex | null;
  archiveStatus: 'loading' | 'ready' | 'error';
}

export function PatchesPage({ archive, archiveStatus }: Props) {
  const [query, setQuery] = useState('');

  const patches = archive?.core.patches ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return patches;
    return patches.filter(
      (patch) =>
        patch.version.toLowerCase().includes(needle) ||
        patch.date.toLowerCase().includes(needle)
    );
  }, [patches, query]);

  const current = patches[patches.length - 1] ?? null;

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

  return (
    <div className="page page--patches">
      {current ? (
        <Link to={`/patches/${encodeURIComponent(current.version)}`} className="pin">
          <div className="pin__label">Patch terkini</div>
          <div className="pin__version">{current.version}</div>
          <div className="pin__meta">
            <span>{current.date || '—'}</span>
            <span>{current.hero_change_count} perubahan hero</span>
            <span>{current.item_change_count} perubahan item</span>
          </div>
        </Link>
      ) : null}

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
              placeholder="Cari versi patch…"
              aria-label="Cari versi patch"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="toolbar__count">{filtered.length} versi</span>
        </div>
      </div>

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Versi</th>
              <th>Tarikh</th>
              <th className="num">Hero</th>
              <th className="num">Item</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice()
              .reverse()
              .map((patch) => (
                <tr key={patch.version}>
                  <td>
                    <Link to={`/patches/${encodeURIComponent(patch.version)}`} className="tbl__patch">
                      <span className="tbl__version">{patch.version}</span>
                    </Link>
                  </td>
                  <td className="muted">{patch.date || '—'}</td>
                  <td className="num">{patch.hero_change_count || '—'}</td>
                  <td className="num">{patch.item_change_count || '—'}</td>
                  <td>
                    {patch.types.length > 0 ? (
                      <span className="typetags">
                        {patch.types.slice(0, 4).map((entry) => (
                          <PatchTag key={entry.type} type={entry.type} count={entry.count} />
                        ))}
                        {patch.types.length > 4 ? (
                          <span className="muted">+{patch.types.length - 4}</span>
                        ) : null}
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
    </div>
  );
}
