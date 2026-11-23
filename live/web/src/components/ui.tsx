/**
 * Komponen UI asas MLBB Almanac.
 *
 * Semua visual di laman ini dibina daripada token yang sama (lihat
 * styles.css): satu palet, satu tipografi, satu radius.
 */
import { useEffect, type ReactNode } from 'react';

import { formatPercent } from '../lib/format';

// ------------------------------------------------------------------- patch

export type PatchType = 'NEW' | 'BUFF' | 'NERF' | 'REWORK' | 'ADJUST';

/** Normalkan jenis perubahan arkib kepada lima jenis yang konsisten. */
export function normalizePatchType(raw: string): PatchType {
  const key = (raw || '').toUpperCase();
  if (key.includes('NEW') || key === 'ADDED') return 'NEW';
  if (key.includes('BUFF')) return 'BUFF';
  if (key.includes('NERF')) return 'NERF';
  if (key.includes('REWORK') || key.includes('REVAMP')) return 'REWORK';
  return 'ADJUST';
}

export function PatchTag({ type, count }: { type: string; count?: number }) {
  const kind = normalizePatchType(type);
  return (
    <span className="ptag" data-kind={kind}>
      {kind}
      {typeof count === 'number' && count > 0 ? <span className="ptag__count">{count}</span> : null}
    </span>
  );
}

// ------------------------------------------------------------------- delta

/** Nilai bertanda dengan 1 desimal: "+3,4" / "-3,4". */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const text = Math.abs(value).toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

export function Delta({ value, suffix }: { value: number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="delta delta--flat">—</span>;
  }
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span className={`delta delta--${direction}`}>
      {formatDelta(value)}
      {suffix ?? ''}
    </span>
  );
}

// -------------------------------------------------------------------- tier

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span className="tier tier--none">—</span>;
  const key = tier.trim();
  return (
    <span className="tier" data-tier={key}>
      {key}
    </span>
  );
}

// ---------------------------------------------------------------- portrait

const ROLE_COLORS: Record<string, string> = {
  fighter: '#E88B6B',
  tank: '#6B9BD4',
  assassin: '#B07CD6',
  mage: '#5FC9C9',
  marksman: '#E0B84C',
  support: '#7FA88C',
};

function roleColor(roles: readonly string[] | undefined): string {
  const first = roles?.[0]?.toLowerCase() ?? '';
  return ROLE_COLORS[first] ?? '#8B9BB4';
}

/**
 * Potret hero. Kalau imej tiada (atau gagal dimuat),-show inisial dengan
 * blok warna role - tiada ruang hitam kosong.
 */
export function Portrait({
  name,
  iconUrl,
  portraitUrl,
  roles,
  size = 40,
}: {
  name: string;
  iconUrl?: string | null;
  portraitUrl?: string | null;
  roles?: readonly string[];
  size?: number;
}) {
  const color = roleColor(roles);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const src = iconUrl ?? portraitUrl ?? null;

  return (
    <span
      className="portrait"
      style={{ width: size, height: size, ['--role' as string]: color }}
      aria-hidden="true"
    >
      <span className="portrait__fallback">{initial}</span>
      {src ? (
        <img
          className="portrait__img"
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </span>
  );
}

// ------------------------------------------------------------------- sheet

/**
 * Panel luar (drawer desktop, bottom sheet mobile).
 * Tutup dengan ESC atau klik latar.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'right' | 'bottom';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet" data-side={side} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet__backdrop" onClick={onClose} aria-label="Tutup" />
      <div className="sheet__panel">
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- empty state

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {detail ? <p className="empty__detail">{detail}</p> : null}
    </div>
  );
}

/**
 * Keadaan ralat: "Data unavailable" + sebab (bukan sekadar kosong), sumber
 * jika ada, masa kemas kini terakhir yang diketahui, dan butang cuba lagi.
 */
export function ErrorState({
  title = 'Data unavailable',
  detail,
  onRetry,
  source,
  sourceUrl,
  lastUpdated,
}: {
  title?: string;
  detail?: string | null | undefined;
  onRetry?: (() => void) | undefined;
  source?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  lastUpdated?: string | null | undefined;
}) {
  return (
    <div className="empty empty--error">
      <p className="empty__title">{title}</p>
      {detail ? <p className="empty__detail">{detail}</p> : null}
      {source ? (
        <p className="empty__detail">
          Sumber:{' '}
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
              {source}
            </a>
          ) : (
            source
          )}
        </p>
      ) : null}
      {lastUpdated ? (
        <p className="empty__detail">Kemaskini terakhir: {lastUpdated}</p>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          Cuba lagi
        </button>
      ) : null}
    </div>
  );
}

/**
 * Keadaan memuat -Fx. Boneka (skeleton) lebih baik daripada teks "Memuat..."
 * kerana ia menunjukkan bentuk kandungan yang akan tiba.
 */
export function StateBlock({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div className="stateblock" role="status" aria-live="polite">
      <p className="stateblock__label">{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <div className="stateblock__row" key={index}>
          <span className="stateblock__bar stateblock__bar--wide" />
          <span className="stateblock__bar" />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ blocks

export function Panel({
  title,
  hint,
  action,
  children,
  className,
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      {title ? (
        <div className="panel__head">
          <h2 className="panel__title">{title}</h2>
          {hint ? <span className="panel__hint">{hint}</span> : null}
          {action ? <span className="panel__action">{action}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  accent?: 'live' | 'archive' | 'rise' | 'fall';
}) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value" data-accent={accent}>
        {value}
      </div>
      {note ? <div className="stat__note">{note}</div> : null}
    </div>
  );
}

export { formatPercent };
