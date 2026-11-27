// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { HeroMetaCorrelationChart } from '../src/components/HeroMetaCorrelationChart';
import type { LiveTrendPoint, PatchHistoryEntry } from '../src/lib/heroTrend';

const TREND: LiveTrendPoint[] = [
  { date: '2026-11-10', winRate: 50.1, pickRate: 2.1, banRate: 4.2 },
  { date: '2026-11-11', winRate: 50.6, pickRate: 2.4, banRate: 4.0 },
  { date: '2026-11-12', winRate: 51.2, pickRate: 2.9, banRate: 3.6 },
];

const PATCHES: PatchHistoryEntry[] = [
  {
    date: '2026-11-11',
    patchVersion: '2.2.23',
    changeType: 'buff',
    summary: 'Base HP +100 and skill damage +8%',
  },
  {
    date: '2026-11-12',
    patchVersion: '2.2.24',
    changeType: 'nerf',
    summary: 'Attack speed -5%',
  },
];

afterEach(() => {
  cleanup();
});

describe('HeroMetaCorrelationChart', () => {
  it('tunjuk keadaan kosong bila tiada siri live', () => {
    render(<HeroMetaCorrelationChart liveTrendData={[]} patchHistory={PATCHES} />);
    expect(screen.getByText(/Belum ada siri live/i)).toBeTruthy();
  });

  it('tunjuk tiga kawalan siri', () => {
    render(<HeroMetaCorrelationChart liveTrendData={TREND} patchHistory={PATCHES} />);
    expect(screen.getByRole('button', { name: /Win rate/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pick rate/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ban rate/i })).toBeTruthy();
  });

  it('kawalan siri boleh dimatikan (aria-pressed berubah)', () => {
    render(<HeroMetaCorrelationChart liveTrendData={TREND} patchHistory={PATCHES} />);
    const button = screen.getByRole('button', { name: /Win rate/i });
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('tunjuk bilangan titik dan peristiwa patch', () => {
    render(
      <HeroMetaCorrelationChart
        liveTrendData={TREND}
        patchHistory={PATCHES}
        heroName="Alucard"
      />
    );
    expect(screen.getByText(/3 titik/)).toBeTruthy();
    expect(screen.getByText(/2 peristiwa patch/)).toBeTruthy();
  });

  it('patch di luar julat carta tidak dikira sebagai peristiwa yang dipapar', () => {
    render(
      <HeroMetaCorrelationChart
        liveTrendData={TREND}
        patchHistory={[
          ...PATCHES,
          {
            date: '2020-09-22',
            patchVersion: '1.5.16',
            changeType: 'adjustment',
            summary: 'Project NEXT phase 1 revamp',
          },
        ]}
      />
    );
    // Hanya patch pada tarikh yang ada dalam siri live dikira.
    expect(screen.getByText(/2 peristiwa patch/)).toBeTruthy();
    expect(screen.getByText(/1 patch lama di luar julat carta/)).toBeTruthy();
  });

  it('tiada patch dalam julat => tiada legenda patch', () => {
    render(
      <HeroMetaCorrelationChart
        liveTrendData={TREND}
        patchHistory={[
          {
            date: '2020-09-22',
            patchVersion: '1.5.16',
            changeType: 'adjustment',
            summary: 'Project NEXT phase 1 revamp',
          },
        ]}
      />
    );
    expect(screen.getByText(/0 peristiwa patch/)).toBeTruthy();
    expect(screen.queryByText('Buff')).toBeNull();
  });

  it('tunjuk legenda patch', () => {
    render(<HeroMetaCorrelationChart liveTrendData={TREND} patchHistory={PATCHES} />);
    expect(screen.getByText('Buff')).toBeTruthy();
    expect(screen.getByText('Nerf')).toBeTruthy();
    expect(screen.getByText('Adjustment')).toBeTruthy();
  });

  it('portrait dimuat lazy dengan width/height (tiada CLS)', () => {
    render(
      <HeroMetaCorrelationChart
        liveTrendData={TREND}
        patchHistory={PATCHES}
        portraitUrl="https://example.test/portrait.png"
      />
    );
    const image = screen.getByRole('presentation') as HTMLImageElement | null;
    const portrait = document.querySelector('.brand__logo, img');
    expect(portrait).toBeTruthy();
    expect(portrait?.getAttribute('loading')).toBe('lazy');
    expect(portrait?.getAttribute('width')).toBe('40');
    expect(portrait?.getAttribute('height')).toBe('40');
    expect(image).toBeTruthy();
  });


});
