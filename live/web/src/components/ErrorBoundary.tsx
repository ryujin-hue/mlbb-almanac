/**
 * Error Boundary.
 *
 * React hanya boleh menangkap error render daripada komponen anak -
 * tidak boleh dari event handler atau async callback. Jadi setiap ciri
 * baharu dibalut dengan boundary ini: satu carta yang rosak tidak boleh
 * menjatuhkan keseluruhan halaman, dan pengguna dapat cuba lagi.
 *
 * Bahasa UI: Bahasa Indonesia (copy jenama: Bahasa Inggeris).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Nama ciri - muncul dalam mesej ralat supaya developer tahu mana. */
  feature?: string;
  children: ReactNode;
  /** Slot tersuai untuk ganti paparan ralat (default: panel standard). */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[almanac] ralat dalam ${this.props.feature ?? 'komponen'}:`,
      error,
      info.componentStack
    );
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="rounded-md border border-line bg-surface p-4 text-sm text-ink"
      >
        <p className="m-0 font-semibold text-live">Bahagian ini tidak dapat dipaparkan</p>
        <p className="mb-3 mt-1 text-muted">
          {this.props.feature
            ? `${this.props.feature} stopped. Data lain pada halaman ini masih berfungsi.`
            : 'Bahagian ini berhenti. Data lain pada halaman ini masih berfungsi.'}
        </p>
        <p className="mb-3 mt-0 break-words font-mono text-xs text-muted">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="min-h-11 cursor-pointer rounded-sm border border-line bg-surface2 px-4 py-2 text-sm font-semibold text-ink hover:border-live"
        >
          Cuba lagi
        </button>
      </div>
    );
  }
}
