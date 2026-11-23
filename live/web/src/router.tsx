/**
 * Routerspath kecil untuk MLBB Almanac.
 *
 * Tiada dependency: guna History API + satu event supaya React boleh
 * mengikuti perubahan URL. Route:
 *
 *   /                  Meta
 *   /heroes            Senarai hero
 *   /heroes/:id        Detail hero (Overview | Balance history)
 *   /movers            Meta movers
 *   /patches           Indeks patch
 *   /patches/:version  Detail patch
 *   /items             Katalog item
 *   /data              Data, sumber, snapshot
 */
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export const NAV_EVENT = 'almanac:navigate';

export function currentPath(): string {
  const path = window.location.pathname;
  return path === '' ? '/' : path;
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === currentPath()) return;
  if (options.replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);

  return path;
}

export type RouteName = 'meta' | 'heroes' | 'hero' | 'movers' | 'patches' | 'patch' | 'items' | 'data';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

export function matchRoute(path: string): Route {
  const clean = path.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean);

  if (segments.length === 0) return { name: 'meta', params: {} };
  if (segments[0] === 'heroes') {
    if (segments.length === 1) return { name: 'heroes', params: {} };
    return { name: 'hero', params: { id: decodeURIComponent(segments[1] ?? '') } };
  }
  if (segments[0] === 'movers') return { name: 'movers', params: {} };
  if (segments[0] === 'patches') {
    if (segments.length === 1) return { name: 'patches', params: {} };
    return { name: 'patch', params: { version: decodeURIComponent(segments[1] ?? '') } };
  }
  if (segments[0] === 'items') return { name: 'items', params: {} };
  if (segments[0] === 'data') return { name: 'data', params: {} };
  return { name: 'meta', params: {} };
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * Tatal ke atas bila laluan berubah - halaman baru tidak boleh bermula
 * di tengah scroll lama.
 */
export function useScrollReset(path: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [path]);
}
