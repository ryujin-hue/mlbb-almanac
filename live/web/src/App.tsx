import { AlmanacProvider, useAlmanac } from './data/AlmanacContext';
import { BottomNav, TopNav } from './components/shell';
import { DataPage } from './pages/DataPage';
import { DraftPage } from './pages/DraftPage';
import { HeroDetailPage } from './pages/HeroDetailPage';
import { HeroesPage } from './pages/HeroesPage';
import { ItemsPage } from './pages/ItemsPage';
import { MetaPage } from './pages/MetaPage';
import { MoversPage } from './pages/MoversPage';
import { PatchDetailPage } from './pages/PatchDetailPage';
import { PatchesPage } from './pages/PatchesPage';
import { PatchNotesPage } from './pages/PatchNotesPage';
import { formatDateTime, formatRelative } from './lib/format';
import { matchRoute, usePath, useScrollReset } from './router';

export default function App() {
  return (
    <AlmanacProvider>
      <Shell />
    </AlmanacProvider>
  );
}

function Shell() {
  const path = usePath();
  useScrollReset(path);

  return (
    <div className="app">
      <TopNav {...useStatus()} />
      <main className="main">
        <div className="wrap">
          <Routes path={path} />
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

/** Label status untuk navigasi: patch terkini + bila data kemas kini. */
function useStatus(): { statusLabel: string; statusTone: 'live' | 'stale' | 'error' } {
  const { apiMeta, archive, snapshots, status } = useAlmanac();
  const latestPatch = archive?.core.patches[archive?.core.patches.length - 1]?.version;
  const updatedAt = apiMeta?.lastUpdated ?? snapshots[0]?.stored_at ?? null;

  if (status === 'error') return { statusLabel: 'Data unavailable', statusTone: 'error' };
  if (!updatedAt) return { statusLabel: 'Memuat…', statusTone: 'stale' };

  return {
    statusLabel: `${latestPatch ? `${latestPatch} · ` : ''}${formatRelative(updatedAt)}`,
    statusTone: apiMeta?.status === 'live' ? 'live' : 'stale',
  };
}

function Routes({ path }: { path: string }) {
  const { archive, archiveStatus, archiveError, reloadArchive } = useAlmanac();
  const route = matchRoute(path);

  switch (route.name) {
    case 'hero':
      return (
        <HeroDetailPage
          heroId={route.params.id ?? ''}
          archive={archive}
          archiveStatus={archiveStatus}
          archiveError={archiveError}
          reloadArchive={reloadArchive}
        />
      );
    case 'movers':
      return <MoversPage />;
    case 'patches':
      return (
        <PatchesPage
          archive={archive}
          archiveStatus={archiveStatus}
          archiveError={archiveError}
          reloadArchive={reloadArchive}
        />
      );
    case 'patch':
      return (
        <PatchDetailPage
          version={route.params.version ?? ''}
          archive={archive}
          archiveStatus={archiveStatus}
          archiveError={archiveError}
          reloadArchive={reloadArchive}
        />
      );
    case 'patch-notes':
      return <PatchNotesPage />;
    case 'items':
      return (
        <ItemsPage
          archive={archive}
          archiveStatus={archiveStatus}
          archiveError={archiveError}
          reloadArchive={reloadArchive}
        />
      );
    case 'draft':
      return <DraftPage />;
    case 'data':
      return <DataPage />;
    case 'meta':
      return <MetaPage />;
    case 'heroes':
    default:
      return <HeroesPage archive={archive} />;
  }
}

function Footer() {
  const { apiMeta, manifest } = useAlmanac();
  const updated = apiMeta?.lastUpdated ?? manifest?.generated_at_utc ?? null;

  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          Data:{' '}
          <a href="https://github.com/achedon12/mlbb" target="_blank" rel="noreferrer noopener">
            MLBBDex mirror
          </a>{' '}
          (CC BY-SA 4.0 via Mobile Legends Wiki). Diperbarui {formatDateTime(updated)} UTC.
          Tidak berafiliasi dengan Moonton.
        </p>
      </div>
    </footer>
  );
}
