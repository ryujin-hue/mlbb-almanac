/**
 * Draft Pick Simulator - /draft
 *
 * Draf 5v5 dengan keadaan dalam URL: boleh dikongsi, boleh di-undo,
 * dan heuristik komposisi dijalankan selepas setiap lock.
 */
import { DraftPickSimulator } from '../components/DraftPickSimulator';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function DraftPage() {
  return (
    <div className="page">
      <header className="pagehead">
        <h1 className="pagehead__title">Draft Pick Simulator</h1>
        <p className="pagehead__sub">
          5 pick + 5 ban setiap pasukan. Keadaan draf duduk dalam URL, jadi
          pautan ini boleh dihantar terus kepada rakan.
        </p>
      </header>

      <ErrorBoundary feature="Draft Pick Simulator">
        <DraftPickSimulator />
      </ErrorBoundary>
    </div>
  );
}
