/**
 * Shell aplikasi: navigasi atas (desktop) dan bawah (mobile).
 *
 * Desktop  : MLBB ALMANAC | Meta Heroes Movers Patches Items Data | status | cari
 * Mobile   : bar bawah Meta | Heroes | Movers | Patches | More (Items, Data)
 */
import { useEffect, useState } from 'react';

import { Link, usePath } from '../router';
import { Sheet } from './ui';

export const NAV_ITEMS = [
  { path: '/', label: 'Meta' },
  { path: '/heroes', label: 'Heroes' },
  { path: '/movers', label: 'Movers' },
  { path: '/patches', label: 'Patches' },
  { path: '/items', label: 'Items' },
  { path: '/data', label: 'Data' },
] as const;

const MOBILE_NAV = [
  { path: '/', label: 'Meta' },
  { path: '/heroes', label: 'Heroes' },
  { path: '/movers', label: 'Movers' },
  { path: '/patches', label: 'Patches' },
] as const;

export const FOCUS_SEARCH_EVENT = 'almanac:focus-search';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="MLBB Almanac - Meta">
      <svg className="brand__mark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        {[2, 9, 16].map((x) =>
          [3, 8, 13, 18].map((y) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="6" height="2.5" fill="var(--line-strong)" />
          ))
        )}
        <rect x="16" y="18" width="6" height="2.5" fill="var(--live)" />
      </svg>
      <span className="brand__prefix">MLBB</span>
      <span className="brand__name">ALMANAC</span>
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
    target === '/' ? path === '/' : path === target || path.startsWith(`${target}/`);

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
            if (!window.location.pathname.startsWith('/heroes')) {
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
    target === '/' ? path === '/' : path === target || path.startsWith(`${target}/`);

  const moreActive = isActive('/items') || isActive('/data');

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
          {NAV_ITEMS.filter((item) => item.path === '/items' || item.path === '/data').map((item) => (
            <Link key={item.path} to={item.path} className="moremenu__link">
              {item.label}
            </Link>
          ))}
        </nav>
      </Sheet>
    </>
  );
}
