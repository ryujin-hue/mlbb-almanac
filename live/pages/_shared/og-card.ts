/**
 * Kad Open Graph MLBB Almanac - 1200x630 PNG.
 *
 * Kad ini dijana pada masa permintaan (bukan build) supaya kadar win/pick/ban
 * sentiasa mengikut snapshot terkini.
 *
 * Rasterizer: resvg-wasm (WASM tulen - boleh jalan dalam Cloudflare Pages
 * Functions tanpa Node). Font: Liberation Sans Bold, sumbernya dahulu dalam
 * repo, jadi kad tidak bergantung pada CDN luar.
 */

/** Saiz kad. */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Palet - sama seperti token laman. */
const COLORS = {
  bg: '#0B0F1A',
  surface: '#121826',
  line: '#243044',
  text: '#E8EEF7',
  muted: '#8B9BB4',
  live: '#00E5FF',
  archive: '#F5C518',
  rise: '#34D399',
  fall: '#F87171',
} as const;

/** Warna pinggir mengikut tier. */
export function tierColor(tier: string | null | undefined): string {
  switch ((tier ?? '').toUpperCase()) {
    case 'S+':
      return COLORS.archive;
    case 'S':
      return COLORS.archive;
    case 'A':
      return COLORS.live;
    case 'B':
      return COLORS.muted;
    default:
      return COLORS.muted;
  }
}

/** Status patch terakhir. */
export type OgStatus = 'buffed' | 'nerfed' | 'stable';

export function statusLabel(status: OgStatus): string {
  if (status === 'buffed') return 'BUFFED';
  if (status === 'nerfed') return 'NERFED';
  return 'STABLE';
}

function statusColor(status: OgStatus): string {
  if (status === 'buffed') return COLORS.rise;
  if (status === 'nerfed') return COLORS.fall;
  return COLORS.muted;
}

/** Data yang dipaparkan pada kad. */
export interface OgHeroCard {
  name: string;
  title?: string | null;
  tier: string | null;
  roles?: readonly string[];
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  status: OgStatus;
  patchVersion?: string | null;
  measuredAt?: string | null;
  /** Portrait sebagai data URI PNG - tiada portrait -> blok inisial. */
  portraitDataUri?: string | null;
  /** Laman asal - dicetak di kaki kad. */
  sourceUrl?: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${(parts[0] ?? '').charAt(0)}${(parts[1] ?? '').charAt(0)}`.toUpperCase();
}

/**
 * Bina SVG kad.
 *
 * Grid geometri halus + gradient gelap, portrait dengan pinggir warna
 * tier (emas berhalo untuk S+), nama besar, tiga kotak rate, dan lencana
 * status patch.
 */
export function buildOgSvg(card: OgHeroCard): string {
  const tier = tierColor(card.tier);
  const tierLabel = card.tier ?? '—';
  const status = statusLabel(card.status);
  const statusColorValue = statusColor(card.status);
  const name = escapeXml(card.name || 'MLBB Almanac');
  const subtitle = escapeXml(
    [card.title, ...(card.roles ?? [])].filter(Boolean).join(' · ')
  );
  const patchLine = escapeXml(
    [
      card.patchVersion ? `patch ${card.patchVersion}` : null,
      card.measuredAt ? `diukur ${card.measuredAt}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  );
  const footer = escapeXml(card.sourceUrl ?? 'mlbb-almanac.pages.dev');

  // Grid geometri halus - 40px.
  const gridLines: string[] = [];
  for (let x = 0; x <= OG_WIDTH; x += 40) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${OG_HEIGHT}" stroke="#121826" stroke-width="1"/>`);
  }
  for (let y = 0; y <= OG_HEIGHT; y += 40) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${OG_WIDTH}" y2="${y}" stroke="#121826" stroke-width="1"/>`);
  }

  // Portrait atau blok inisial.
  const portraitX = 90;
  const portraitY = 104;
  const portraitSize = 380;
  const portrait = card.portraitDataUri
    ? `<image href="${escapeXml(card.portraitDataUri)}" x="${portraitX}" y="${portraitY}" width="${portraitSize}" height="${portraitSize}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${portraitX}" y="${portraitY}" width="${portraitSize}" height="${portraitSize}" fill="#1A2332"/>
       <text x="${portraitX + portraitSize / 2}" y="${portraitY + portraitSize / 2 + 44}" text-anchor="middle" font-size="120" font-weight="bold" fill="${COLORS.muted}">${escapeXml(initials(card.name))}</text>`;

  // Halo emas untuk S+.
  const halo =
    (card.tier ?? '').toUpperCase() === 'S+'
      ? `<rect x="${portraitX - 14}" y="${portraitY - 14}" width="${portraitSize + 28}" height="${portraitSize + 28}" rx="18" fill="none" stroke="${COLORS.archive}" stroke-width="6" opacity="0.28"/>`
      : '';

  const statBox = (
    label: string,
    value: string,
    x: number
  ): string => `
    <g>
      <rect x="${x}" y="330" width="150" height="104" rx="10" fill="${COLORS.surface}" stroke="${COLORS.line}" stroke-width="1"/>
      <text x="${x + 18}" y="368" font-size="19" fill="${COLORS.muted}" letter-spacing="1.6">${label}</text>
      <text x="${x + 18}" y="410" font-size="34" font-weight="bold" fill="${COLORS.text}">${value}</text>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0F1A"/>
      <stop offset="1" stop-color="#101D35"/>
    </linearGradient>
  </defs>

  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  ${gridLines.join('\n  ')}

  <!-- Jenama -->
  <text x="90" y="66" font-size="24" font-weight="bold" fill="${COLORS.text}" letter-spacing="3">MLBB ALMANAC</text>
  <line x1="90" y1="86" x2="330" y2="86" stroke="${COLORS.archive}" stroke-width="3"/>

  <!-- Portrait + pinggir tier -->
  ${halo}
  <rect x="${portraitX - 6}" y="${portraitY - 6}" width="${portraitSize + 12}" height="${portraitSize + 12}" rx="16" fill="none" stroke="${tier}" stroke-width="4"/>
  ${portrait}
  <rect x="${portraitX}" y="${portraitY + portraitSize + 12}" width="74" height="30" rx="6" fill="${tier}"/>
  <text x="${portraitX + 37}" y="${portraitY + portraitSize + 33}" text-anchor="middle" font-size="19" font-weight="bold" fill="#0B0F1A">${escapeXml(tierLabel)}</text>

  <!-- Nama + status -->
  <text x="560" y="200" font-size="72" font-weight="bold" fill="${COLORS.text}">${name}</text>
  ${subtitle ? `<text x="560" y="248" font-size="26" fill="${COLORS.muted}">${subtitle}</text>` : ''}

  <rect x="560" y="276" width="150" height="38" rx="8" fill="${statusColorValue}" fill-opacity="0.16" stroke="${statusColorValue}" stroke-width="1.5"/>
  <text x="635" y="302" text-anchor="middle" font-size="20" font-weight="bold" fill="${statusColorValue}" letter-spacing="1.6">${status}</text>
  ${patchLine ? `<text x="726" y="302" font-size="20" fill="${COLORS.muted}">${patchLine}</text>` : ''}

  <!-- Rate -->
  ${statBox('WIN RATE', formatRate(card.winRate), 560)}
  ${statBox('PICK RATE', formatRate(card.pickRate), 726)}
  ${statBox('BAN RATE', formatRate(card.banRate), 892)}

  <!-- Kaki kad -->
  <line x1="90" y1="${OG_HEIGHT - 76}" x2="${OG_WIDTH - 90}" y2="${OG_HEIGHT - 76}" stroke="${COLORS.line}" stroke-width="1"/>
  <text x="90" y="${OG_HEIGHT - 42}" font-size="22" fill="${COLORS.muted}">${footer}</text>
  <text x="${OG_WIDTH - 90}" y="${OG_HEIGHT - 42}" text-anchor="end" font-size="22" fill="${COLORS.muted}">patch history + live meta</text>
</svg>`;
}

/** Kad lalai - apabila hero tidak dijumpai. */
export function buildFallbackSvg(sourceUrl?: string | null): string {
  return buildOgSvg({
    name: 'MLBB Almanac',
    title: 'patch history + live meta',
    tier: null,
    winRate: null,
    pickRate: null,
    banRate: null,
    status: 'stable',
    sourceUrl: sourceUrl ?? 'mlbb-almanac.pages.dev',
  });
}
