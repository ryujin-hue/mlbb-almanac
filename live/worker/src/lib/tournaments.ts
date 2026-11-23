/**
 * Turnamen MLBB daripada PandaScore.
 *
 * Endpoint: GET https://api.pandascore.co/mlbb/tournaments/upcoming
 * Auth:     Authorization: Bearer <PANDASCORE_API_TOKEN>
 *
 * Token datang daripada secret Worker. Tanpa token, endpoint pulangkan
 * `available: false` dengan sebab yang jelas - bukan 500, bukan senarai kosong
 * yang Blogger sangka "tiada tender".
 */

const BASE = 'https://api.pandascore.co/mlbb';
export const TOURNAMENTS_KEY = 'mlbb:tournaments:latest';
const CACHE_TTL_SECONDS = 60 * 60;

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

interface PandaScoreTournament {
  id?: number;
  name?: string;
  begin_at?: string | null;
  end_at?: string | null;
  status?: string | null;
  number_of_teams?: number | null;
  prizepool?: string | null;
  url?: string | null;
  league?: { name?: string; image?: string | null } | null;
  winner?: { name?: string } | null;
}

export async function readTournaments(kv?: KVNamespace): Promise<TournamentsPayload | null> {
  if (!kv) return null;
  return (await kv.get<TournamentsPayload>(TOURNAMENTS_KEY, 'json')) ?? null;
}

export async function writeTournaments(
  kv: KVNamespace | undefined,
  payload: TournamentsPayload
): Promise<void> {
  if (!kv) return;
  await kv.put(TOURNAMENTS_KEY, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 });
}

function normalize(raw: PandaScoreTournament): Tournament {
  return {
    id: raw.id ?? 0,
    name: raw.name ?? 'Tanpa nama',
    begin_at: raw.begin_at ?? null,
    end_at: raw.end_at ?? null,
    league: raw.league?.name ?? null,
    league_image: raw.league?.image ?? null,
    status: raw.status ?? null,
    number_of_teams: raw.number_of_teams ?? null,
    prizepool: raw.prizepool ?? null,
    winner_name: raw.winner?.name ?? null,
    url: raw.url ?? null,
  };
}

/**
 * Senarai tender akan datang. Token tiada -> `available: false` dengan
 * sebab; token ada tetapi API down -> reason 'upstream_error'.
 */
export async function fetchTournaments(token: string | undefined): Promise<TournamentsPayload> {
  const base: Omit<TournamentsPayload, 'count' | 'tournaments'> = {
    available: false,
    source: 'PandaScore',
    source_url: `${BASE}/tournaments/upcoming`,
    fetched_at: new Date().toISOString(),
  };

  if (!token || !token.trim()) {
    return {
      ...base,
      count: 0,
      tournaments: [],
      reason: 'no_token',
      message:
        'Token PandaScore belum ditetapkan (secret PANDASCORE_API_TOKEN). Token percuma boleh diambil di pandascore.co/developers.',
    };
  }

  try {
    const response = await fetch(`${BASE}/tournaments/upcoming?per_page=20`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        ...base,
        count: 0,
        tournaments: [],
        reason: response.status === 401 || response.status === 403 ? 'bad_token' : 'upstream_error',
        message: `PandaScore HTTP ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`,
      };
    }
    const raw = (await response.json()) as PandaScoreTournament[];
    const list = Array.isArray(raw) ? raw.map(normalize) : [];
    return {
      ...base,
      available: true,
      count: list.length,
      tournaments: list,
    };
  } catch (error) {
    return {
      ...base,
      count: 0,
      tournaments: [],
      reason: 'upstream_error',
      message: String(error).slice(0, 160),
    };
  }
}
