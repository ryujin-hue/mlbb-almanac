import { useMemo, useState } from 'react';

import type { ArchiveTable } from '../data/archive';

interface Props {
  tables: ArchiveTable[];
}

/**
 * Jadual referensi arkib - 13 jadual kecil (role, lane, emblem, spell,
 * mata wang, mod game, ranked ladder, dan lain-lain).
 *
 * Ini lapisan "rujukan" yang tiada dalam meta live: butiran statik yang
 * tidak berubah mengikut patch.
 */
export function ReferenceSection({ tables }: Props) {
  const [activeId, setActiveId] = useState<string>(tables[0]?.id ?? '');
  const [query, setQuery] = useState('');

  const active = useMemo(
    () => tables.find((table) => table.id === activeId) ?? tables[0] ?? null,
    [tables, activeId]
  );

  const rows = useMemo(() => {
    if (!active) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return active.rows;
    return active.rows.filter((row) =>
      Object.values(row).some((value) => (value ?? '').toLowerCase().includes(needle))
    );
  }, [active, query]);

  if (!active) {
    return <div className="state">Tiada jadual referensi.</div>;
  }

  return (
    <div className="ref">
      <div className="chips chips--scroll">
        {tables.map((table) => (
          <button
            key={table.id}
            type="button"
            className="chip"
            aria-pressed={table.id === active.id}
            onClick={() => setActiveId(table.id)}
          >
            {table.label}
            <span className="chip__count">{table.row_count}</span>
          </button>
        ))}
      </div>

      <div className="ref__bar">
        <input
          className="field"
          type="search"
          value={query}
          placeholder={`Cari dalam ${active.label}…`}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={`Cari dalam jadual ${active.label}`}
        />
        <span className="ref__count">
          {rows.length} / {active.row_count} baris
        </span>
      </div>

      <div className="md__tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              {active.columns.map((column) => (
                <th key={column}>{column.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {active.columns.map((column) => {
                  const value = row[column] ?? '';
                  const isLink = value.startsWith('http');
                  return (
                    <td key={column}>
                      {isLink ? (
                        <a href={value} target="_blank" rel="noreferrer noopener" className="ref__link">
                          {value.replace(/^https?:\/\//, '').split('/')[0]}
                        </a>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ref__foot">
        Sumber: <code>archive/{active.file}</code>
      </p>
    </div>
  );
}
