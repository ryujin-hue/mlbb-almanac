/**
 * Router laluan kecil untuk MLBB Almanac.
 *
 * Tiada dependency: guna History API + satu event supaya React boleh
 * mengikuti perubahan URL. Route:
 *
 *   /                  Senarai hero (halaman假如 masuk)
 *   /heroes            Senarai hero (sama seperti /)
 *   /heroes/:id        Detail hero (Overview | Balance history)
 *   /meta              Ringkasan meta semasa
 *   /movers            Meta movers
 *   /patches           Indeks patch
 *   /patches/:version  Detail patch
 *   /patch-notes       Patch notes daripada MLBB Hub
 *   /items             Katalog item
 *   /data              Data, sumber, snapshot
 *
 * Query string digunakan untuk menyimpan keadaan paparan (rank, sort, carian,
 * filter, mod kad/jadual) supaya setiap paparan boleh dikongsi dan butang "kembali" berfungsi seperti biasa.
 */
import { useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export const NAV_EVENT = 'almanac:navigate';

export function currentPath(): string {
  const path = window.location.pathname;
  return path === '' ? '/' : path;
}

export function currentSearch(): string {
  return window.location.search;
}

/** URL penuh semasa (path + query), untuk perbandingan navigate. */
export function currentUrl(): string {
  return currentPath() + currentSearch();
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === currentUrl()) return;
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

/** Query string semasa - dikemas kini bila URL berubah. */
export function useSearch(): string {
  const [search, setSearch] = useState(currentSearch);

  useEffect(() => {
    const update = () => setSearch(currentSearch());
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);

  return search;
}

export type RouteName =
  | 'heroes'
  | 'hero'
  | 'meta'
  | 'movers'
  | 'patches'
  | 'patch'
  | 'patch-notes'
  | 'items'
  | 'data';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

export function matchRoute(path: string): Route {
  const clean = path.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean);

  // Halaman masuk ialah senarai hero.
  if (segments.length === 0) return { name: 'heroes', params: {} };
  if (segments[0] === 'heroes') {
    if (segments.length === 1) return { name: 'heroes', params: {} };
    return { name: 'hero', params: { id: decodeURIComponent(segments[1] ?? '') } };
  }
  if (segments[0] === 'meta') return { name: 'meta', params: {} };
  if (segments[0] === 'movers') return { name: 'movers', params: {} };
  if (segments[0] === 'patches') {
    if (segments.length === 1) return { name: 'patches', params: {} };
    return { name: 'patch', params: { version: decodeURIComponent(segments[1] ?? '') } };
  }
  if (segments[0] === 'patch-notes') return { name: 'patch-notes', params: {} };
  if (segments[0] === 'items') return { name: 'items', params: {} };
  if (segments[0] === 'data') return { name: 'data', params: {} };
  return { name: 'heroes', params: {} };
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

/**
 * Baca/tulis satu parameter query tanpa memuat semula halaman.
 * `write` guna `replace` supaya menapis tidak memenuhi sejarah pelayar.
 */
export function useQueryParam(
  name: string,
  fallback: string
): [string, (value: string | null) => void] {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const value = params.get(name) ?? fallback;

  const write = (next: string | null) => {
    const current = new URLSearchParams(window.location.search);
    if (next === null || next === '') current.delete(name);
    else current.set(name, next);
    const query = current.toString();
    navigate(`${currentPath()}${query ? `?${query}` : ''}`, { replace: true });
  };

  return [value, write];
}
