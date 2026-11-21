/**
 * Penyerbantai markdown yang ringkas.
 *
 * Cukup untuk dokumen arkib (kamus istilah, garis masa, sejarah meta):
 * heading, jadual, senarai, petikan, imej, pautan, kod, emphasis.
 *
 * Written by hand - tiada dependency luar - supaya bundle tidak bertambah
 * dan_CONTENT SECURITY POLICY 'self' kekal tanpa CDN.
 */
import { Fragment, type ReactNode } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Teks sebaris: `**bold**`, `*italic*`, `` `code` ``, [teks](pautan). */
function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
  );
  return out;
}

interface Block {
  kind: 'p' | 'ul' | 'ol' | 'quote' | 'hr' | 'h' | 'table' | 'pre';
  level?: number;
  lines: string[];
  rows?: string[][];
  head?: string[];
  align?: string[];
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line) && line.includes('-');
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (!line.trim()) {
      index += 1;
      continue;
    }

    // Kod tiga backtick
    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      index += 1;
      blocks.push({ kind: 'pre', lines: body });
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'h',
        level: (heading[1] ?? '#').length,
        lines: [heading[2] ?? ''],
      });
      index += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      blocks.push({ kind: 'hr', lines: [] });
      index += 1;
      continue;
    }

    // Imej
    if (/^!\[/.test(line.trim())) {
      blocks.push({ kind: 'p', lines: [line.trim()] });
      index += 1;
      continue;
    }

    // Jadual: baris paip + baris pemisah
    if (line.includes('|') && isTableSeparator(lines[index + 1] ?? '')) {
      const head = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').includes('|')) {
        rows.push(splitRow(lines[index] ?? ''));
        index += 1;
      }
      blocks.push({ kind: 'table', head, rows, lines: [] });
      continue;
    }

    // Petikan
    if (line.trim().startsWith('>')) {
      const body: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('>')) {
        body.push((lines[index] ?? '').trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ kind: 'quote', lines: body });
      continue;
    }

    // Senarai
    if (/^\s*[-*+]\s+/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index] ?? '')) {
        body.push((lines[index] ?? '').replace(/^\s*[-*+]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ul', lines: body });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index] ?? '')) {
        body.push((lines[index] ?? '').replace(/^\s*\d+[.)]\s+/, ''));
        index += 1;
      }
      blocks.push({ kind: 'ol', lines: body });
      continue;
    }

    // Perenggan
    const body: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^(#{1,6})\s/.test(lines[index] ?? '') &&
      !/^\s*[-*+]\s+/.test(lines[index] ?? '') &&
      !/^\s*\d+[.)]\s+/.test(lines[index] ?? '') &&
      !(lines[index] ?? '').trim().startsWith('>') &&
      !(lines[index] ?? '').trim().startsWith('```')
    ) {
      body.push((lines[index] ?? '').trim());
      index += 1;
    }
    blocks.push({ kind: 'p', lines: body });
  }

  return blocks;
}

function renderImage(line: string): ReactNode {
  const match = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
  if (!match) return <p dangerouslySetInnerHTML={{ __html: inline(line) }} />;
  const alt = match[1] ?? '';
  const src = match[2] ?? '';
  return (
    <figure className="md__figure">
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      {alt ? <figcaption>{alt}</figcaption> : null}
    </figure>
  );
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="md">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === 'h') {
          const level = Math.min(Math.max(block.level ?? 2, 2), 5);
          const Tag = (`h${level}` as unknown) as 'h2';
          const text = block.lines[0] ?? '';
          return <Tag key={key} dangerouslySetInnerHTML={{ __html: inline(text) }} />;
        }

        if (block.kind === 'hr') return <hr key={key} />;

        if (block.kind === 'pre') {
          return (
            <pre key={key}>
              <code>{block.lines.join('\n')}</code>
            </pre>
          );
        }

        if (block.kind === 'quote') {
          return (
            <blockquote key={key} dangerouslySetInnerHTML={{ __html: inline(block.lines.join(' ')) }} />
          );
        }

        if (block.kind === 'ul' || block.kind === 'ol') {
          const Tag = block.kind === 'ul' ? 'ul' : 'ol';
          return (
            <Tag key={key}>
              {block.lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`} dangerouslySetInnerHTML={{ __html: inline(line) }} />
              ))}
            </Tag>
          );
        }

        if (block.kind === 'table') {
          const head = block.head ?? [];
          return (
            <div className="md__tablewrap" key={key}>
              <table className="tbl">
                <thead>
                  <tr>
                    {head.map((cell, cellIndex) => (
                      <th key={`${key}-h-${cellIndex}`} dangerouslySetInnerHTML={{ __html: inline(cell) }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(block.rows ?? []).map((row, rowIndex) => (
                    <tr key={`${key}-r-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${key}-r-${rowIndex}-c-${cellIndex}`} dangerouslySetInnerHTML={{ __html: inline(cell) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        // Paragraf: baris bermula dengan `!` adalah imej kendiri.
        const text = block.lines.join(' ');
        if (text.startsWith('![')) return <Fragment key={key}>{renderImage(text)}</Fragment>;
        return <p key={key} dangerouslySetInnerHTML={{ __html: inline(text) }} />;
      })}
    </div>
  );
}
