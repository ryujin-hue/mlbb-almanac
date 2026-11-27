// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { ErrorBoundary } from '../src/components/ErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error('render gagal');
}

describe('ErrorBoundary', () => {
  it('tunjuk mesej ralat dan butang cuba lagi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary feature="Carta">
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText('Bahagian ini tidak dapat dipaparkan')).toBeTruthy();
    expect(screen.getByText(/Carta stopped/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cuba lagi' })).toBeTruthy();
    expect(screen.getByText('render gagal')).toBeTruthy();
  });

  it('butang cuba lagi memuat semula subtree', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    function Flaky(): JSX.Element {
      if (shouldThrow) throw new Error('sekali');
      return <span>ok</span>;
    }

    render(
      <ErrorBoundary feature="Uji">
        <Flaky />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: 'Cuba lagi' })).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Cuba lagi' }));

    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('children yang tidak ralat dipaparkan seperti biasa', () => {
    render(
      <ErrorBoundary feature="Uji">
        <span>kandungan</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('kandungan')).toBeTruthy();
  });

  it('fallback tersuai digunakan bila diberi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary feature="Uji" fallback={(error) => <span>ralat: {error.message}</span>}>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('ralat: render gagal')).toBeTruthy();
  });
});
