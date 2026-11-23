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
import { useMoverParams } from './useHeroFilters';

/** Artikel patch notes daripada MLBB Hub (Worker cachekan di KV). */
export interface PatchNoteArticle {
  version: string | null;
  title: string;
  url: string;
  published_at: string | null;
  summary: string;
  image: string | null;
  blocks: { kind: 'h' | 'p'; text: string }[];
}

export interface PatchNotesPayload {
  available: boolean;
  source: string;
  source_url: string;
  fetched_at: string;
  count: number;
  articles: PatchNoteArticle[];
  reason?: string;
  message?: string;
}

/** Turnamen MLBB daripada PandaScore. */
export interface Tournament {
  id: number;
  name: string;
  begin_at: string | null;
  end_at: string | null;
  league: string | null;
  league_image: string | null;
  status: string | null;
  number_of_teams: number | null;
  prizepool: string | null;
  winner_name: string | null;
  url: string | null;
}

export interface TournamentsPayload {
  available: boolean;
  source: string;
  source_url: string;
  fetched_at: string;
  count: number;
  tournaments: Tournament[];
  reason?: string;
  message?: string;
}

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
  /** Sebab arkib gagal dimuatkan (untuk paparan "Data unavailable"). */
  archiveError: string | null;
  apiMeta: ApiMeta | null;
  patchNotes: PatchNotesPayload | null;
  patchNotesStatus: 'loading' | 'ready' | 'error';
  tournaments: TournamentsPayload | null;
  tournamentsStatus: 'loading' | 'ready' | 'error';
  reload: () => void;
  reloadArchive: () => void;
}

const AlmanacContext = createContext<AlmanacData | null>(null);

export function AlmanacProvider({ children }: { children: ReactNode }) {
  // Tempoh perbandingan dibaca dari URL - dikongsi antara Movers dan Heroes.
  const { window: windowKey } = useMoverParams();

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [index, setIndex] = useState<HeroIndexResponse | null>(null);
  const [deltas, setDeltas] = useState<DeltaResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [archive, setArchive] = useState<ArchiveIndex | null>(null);
  const [apiMeta, setApiMeta] = useState<ApiMeta | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [patchNotes, setPatchNotes] = useState<PatchNotesPayload | null>(null);
  const [patchNotesStatus, setPatchNotesStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [tournaments, setTournaments] = useState<TournamentsPayload | null>(null);
  const [tournamentsStatus, setTournamentsStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [nonce, setNonce] = useState(0);
  const [archiveNonce, setArchiveNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const reloadArchive = useCallback(() => setArchiveNonce((value) => value + 1), []);

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
    setArchiveError(null);
    archiveApi
      .core()
      .then((core) => {
        if (!cancelled) {
          setArchive(indexArchive(core));
          setArchiveStatus('ready');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setArchiveError(error instanceof Error ? error.message : String(error));
        setArchiveStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [archiveNonce]);

  // Patch notes MLBB Hub - Worker cachekan, jadi ini murah.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setPatchNotesStatus('loading');
    fetchJson<PatchNotesPayload>('/api/patch-notes', { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setPatchNotes(data);
        setPatchNotesStatus(data.available ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setPatchNotesStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  // Turnamen MLBB (PandaScore).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setTournamentsStatus('loading');
    fetchJson<TournamentsPayload>('/api/tournaments', { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setTournaments(data);
        setTournamentsStatus(data.available ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setTournamentsStatus('error');
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
      archiveError,
      apiMeta,
      patchNotes,
      patchNotesStatus,
      tournaments,
      tournamentsStatus,
      reload,
      reloadArchive,
    }),
    [
      status,
      error,
      fromCache,
      index,
      deltas,
      snapshots,
      archive,
      archiveStatus,
      archiveError,
      apiMeta,
      patchNotes,
      patchNotesStatus,
      tournaments,
      tournamentsStatus,
      reload,
      reloadArchive,
    ]
  );

  return <AlmanacContext.Provider value={value}>{children}</AlmanacContext.Provider>;
}

export function useAlmanac(): AlmanacData {
  const context = useContext(AlmanacContext);
  if (!context) throw new Error('useAlmanac mesti digunakan dalam AlmanacProvider');
  return context;
}
