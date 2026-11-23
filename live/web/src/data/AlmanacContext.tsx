/**
 * Data bersama untuk semua halaman MLBB Almanac.
 *
 * Satu pemuatan, banyak peminat:
 *   - indeks hero (rank=all)  -> senarai hero, KPI, role bars
 *   - deltas (ikut window)     -> movers
 *   - senarai snapshot        -> tab Data
 *   - arkib (CSV -> JSON)     -> patch, item, sejarah perubahan hero
 *
 * Muat arkib berjalan selari dengan API live dan tidak menghalang render -
 * jika ia gagal, meta live masih berfungsi sepenuhnya.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { archiveApi, indexArchive, type ArchiveIndex } from './archive';
import {
  API,
  fetchJson,
  fetchOfflineFirst,
  type DeltaResponse,
  type HeroIndexResponse,
  type SlimHero,
  type SnapshotMeta,
} from './client';
import { useMetaStore } from './store';

/** Status runtime Worker - sumber untuk status patch & jadual kemas kini. */
export interface ApiMeta {
  status: string;
  source: string;
  patch: string | null;
  totalHeroes: number;
  lastUpdated: string | null;
  lastAttemptAt: string | null;
  nextUpdateAt: string | null;
  scheduleUtc: string | null;
  lastError?: string | null;
}

export interface AlmanacData {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  fromCache: boolean;
  heroes: SlimHero[];
  manifest: HeroIndexResponse['manifest'] | null;
  deltas: DeltaResponse | null;
  snapshots: SnapshotMeta[];
  archive: ArchiveIndex | null;
  archiveStatus: 'loading' | 'ready' | 'error';
  apiMeta: ApiMeta | null;
  reload: () => void;
}

const AlmanacContext = createContext<AlmanacData | null>(null);

export function AlmanacProvider({ children }: { children: ReactNode }) {
  const windowKey = useMetaStore((state) => state.window);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [index, setIndex] = useState<HeroIndexResponse | null>(null);
  const [deltas, setDeltas] = useState<DeltaResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [archive, setArchive] = useState<ArchiveIndex | null>(null);
  const [apiMeta, setApiMeta] = useState<ApiMeta | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  // Indeks hero + snapshot: sekali sahaja (ganti rank dikira di client).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setStatus('loading');
    setError(null);

    Promise.allSettled([
      fetchOfflineFirst<HeroIndexResponse>(API.heroIndex('all'), {
        signal: controller.signal,
        cacheKey: 'rank:all',
      }),
      fetchOfflineFirst<{ entries: SnapshotMeta[] }>(API.snapshots(), {
        signal: controller.signal,
      }),
    ])
      .then(([indexResult, snapshotResult]) => {
        if (cancelled) return;

        if (indexResult.status === 'fulfilled') {
          setIndex(indexResult.value.data);
          setFromCache(indexResult.value.fromCache);
        } else {
          setError(
            indexResult.reason instanceof Error
              ? indexResult.reason.message
              : String(indexResult.reason)
          );
          setStatus('error');
          return;
        }

        if (snapshotResult.status === 'fulfilled') setSnapshots(snapshotResult.value.data.entries ?? []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  // Status runtime Worker.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetchJson<ApiMeta>(API.meta(), { signal: controller.signal })
      .then((data) => {
        if (!cancelled) setApiMeta(data);
      })
      .catch(() => {
        if (!cancelled) setApiMeta(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  // Deltas: ikut window (1d / 7d / 30d).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchOfflineFirst<DeltaResponse>(API.deltas(windowKey), {
      signal: controller.signal,
      cacheKey: `window:${windowKey}`,
    })
      .then((result) => {
        if (!cancelled) setDeltas(result.data);
      })
      .catch(() => {
        if (!cancelled) setDeltas(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [windowKey, nonce]);

  // Arkib: lapisan sejarah. Gagal tidak menjejaskan meta live.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setArchiveStatus('loading');
    archiveApi
      .core()
      .then((core) => {
        if (!cancelled) {
          setArchive(indexArchive(core));
          setArchiveStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setArchiveStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  const value = useMemo<AlmanacData>(
    () => ({
      status,
      error,
      fromCache,
      heroes: index?.heroes ?? [],
      manifest: index?.manifest ?? null,
      deltas,
      snapshots,
      archive,
      archiveStatus,
      apiMeta,
      reload,
    }),
    [status, error, fromCache, index, deltas, snapshots, archive, archiveStatus, apiMeta, reload]
  );

  return <AlmanacContext.Provider value={value}>{children}</AlmanacContext.Provider>;
}

export function useAlmanac(): AlmanacData {
  const context = useContext(AlmanacContext);
  if (!context) throw new Error('useAlmanac mesti digunakan dalam AlmanacProvider');
  return context;
}
