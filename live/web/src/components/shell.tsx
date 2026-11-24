/**
 * Shell aplikasi: navigasi atas (desktop) dan bawah (mobile).
 *
 * Susunan: Heroes dulu, Meta kemudian - senarai hero ialah kerja harian,
 * ringkasan meta adalah rujukan.
 *
 * Desktop  : MLBB ALMANAC | Heroes Meta Movers Patches Patch Notes Items Data
 * Mobile   : bar bawah Heroes | Meta | Movers | Patches | More (Patch Notes,
 *            Items, Data)
 */
import { useEffect, useState } from 'react';

import { Link, usePath } from '../router';
import { Sheet } from './ui';

export const NAV_ITEMS = [
  { path: '/heroes', label: 'Heroes' },
  { path: '/meta', label: 'Meta' },
  { path: '/movers', label: 'Movers' },
  { path: '/patches', label: 'Patches' },
  { path: '/patch-notes', label: 'Patch Notes' },
  { path: '/items', label: 'Items' },
  { path: '/data', label: 'Data' },
] as const;

const MOBILE_NAV = [
  { path: '/heroes', label: 'Heroes' },
  { path: '/meta', label: 'Meta' },
  { path: '/movers', label: 'Movers' },
  { path: '/patches', label: 'Patches' },
] as const;

/** Item yang hanya muncul dalam sheet "More" pada mobile. */
const MORE_ITEMS = NAV_ITEMS.filter(
  (item) => item.path === '/patch-notes' || item.path === '/items' || item.path === '/data'
);

export const FOCUS_SEARCH_EVENT = 'almanac:focus-search';

/**
 * Jenama: wordmark origami "MLBB-A" (emas & perak, lipatan kertas).
 * Varian lutsinar supaya duduk terus pada latar gelap tanpa kotak.
 */
function Brand() {
  return (
    <Link to="/heroes" className="brand">
      <img
        className="brand__logo"
        src="/brand/mlbb-a-transparent.svg"
        alt="MLBB Almanac"
        width="125"
        height="38"
      />
    </Link>
  );
}

export function TopNav({
  statusLabel,
  statusTone,
}: {
  statusLabel: string;
  statusTone: 'live' | 'stale' | 'error';
}) {
  const path = usePath();

  const isActive = (target: string) =>
    target === '/heroes'
      ? path === '/' || path === '/heroes'
      : path === target || path.startsWith(`${target}/`);

  return (
    <header className="topbar">
      <Brand />

      <nav className="topnav" aria-label="Navigasi utama">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`topnav__link${isActive(item.path) ? ' topnav__link--on' : ''}`}
            aria-current={isActive(item.path) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="topbar__right">
        <span className={`pill pill--${statusTone}`}>
          <span className="pill__dot" aria-hidden="true" />
          {statusLabel}
        </span>
        <button
          type="button"
          className="iconbtn"
          aria-label="Cari hero"
          onClick={() => {
            window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
            if (!window.location.pathname.startsWith('/heroes') && window.location.pathname !== '/') {
              window.history.pushState({}, '', '/heroes');
              window.dispatchEvent(new Event('almanac:navigate'));
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePath();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  const isActive = (target: string) =>
    target === '/heroes'
      ? path === '/' || path === '/heroes'
      : path === target || path.startsWith(`${target}/`);

  const moreActive = MORE_ITEMS.some((item) => isActive(item.path));

  return (
    <>
      <nav className="tabbar" aria-label="Navigasi">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`tabbar__link${isActive(item.path) ? ' tabbar__link--on' : ''}`}
            aria-current={isActive(item.path) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          className={`tabbar__link${moreActive ? ' tabbar__link--on' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Lagi" side="bottom">
        <nav className="moremenu">
          {MORE_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} className="moremenu__link">
              {item.label}
            </Link>
          ))}
        </nav>
      </Sheet>
    </>
  );
}
