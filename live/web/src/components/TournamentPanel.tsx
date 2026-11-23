/**
 * Panel turnamen MLBB (PandaScore).
 *
 * Keadaan ralat dikendalikan dengan jujur: tanpa token PandaScore, panel
 * memberitahu apa yang tidak dapat diperoleh - bukan senarai kosong yang
 * kelihatan seperti "tiada solen".
 */
import { useAlmanac } from '../data/AlmanacContext';
import { formatDateTime } from '../lib/format';
import { EmptyState, ErrorState, Panel, StateBlock } from './ui';

export function TournamentPanel() {
  const { tournaments, tournamentsStatus } = useAlmanac();

  if (tournamentsStatus === 'loading') {
    return (
      <Panel title="Turnamen seterusnya">
        <StateBlock label="Memuat jadual turnamen…" rows={2} />
      </Panel>
    );
  }

  if (tournamentsStatus === 'error' || !tournaments) {
    return (
      <Panel title="Turnamen seterusnya">
        <ErrorState
          title="Data unavailable"
          detail={
            tournaments?.reason === 'no_token'
              ? 'Token PandaScore belum ditetapkan pada Worker, jadi senarai turnamen belum boleh ditarik.'
              : (tournaments?.message ?? 'Senarai turnamen tidak dapat dimuatkan sekarang.')
          }
          source={tournaments?.source}
          sourceUrl={tournaments?.source_url}
          lastUpdated={tournaments?.fetched_at ? formatDateTime(tournaments.fetched_at) : null}
        />
      </Panel>
    );
  }

  if (tournaments.tournaments.length === 0) {
    return (
      <Panel title="Turnamen seterusnya">
        <EmptyState
          title="Tiada turnamen"
          detail={
            tournaments.message ??
            'PandaScore tidak menyenaraikan turnamen MLBB yang akan datang.'
          }
        />
      </Panel>
    );
  }

  // PandaScore ada liputan MLBB yang jarang dikemas kini - kalau tiada
  // tournament akan datang, yang ditunjuk ialah senarai terkini.
  const isRecent = tournaments.scope === 'recent';

  return (
    <Panel
      title={isRecent ? 'Turnamen terkini' : 'Turnamen seterusnya'}
      hint={`${tournaments.count} dari ${tournaments.source}`}
    >
      {isRecent && tournaments.message ? (
        <p className="panel__note">{tournaments.message}</p>
      ) : null}
      <ul className="tourlist">
        {tournaments.tournaments.slice(0, 6).map((tournament) => (
          <li className="tourrow" key={tournament.id}>
            <div className="tourrow__main">
              <span className="tourrow__name">{tournament.name}</span>
              <span className="tourrow__meta">
                {tournament.league ? `${tournament.league} · ` : ''}
                {tournament.begin_at ? formatDateTime(tournament.begin_at) : 'tarikh belum diumum'}
                {tournament.number_of_teams ? ` · ${tournament.number_of_teams} pasukan` : ''}
              </span>
            </div>
            {tournament.prizepool ? <span className="tourrow__prize">{tournament.prizepool}</span> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
