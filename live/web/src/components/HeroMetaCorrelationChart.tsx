/**
 * Carta korelasi patch-meta.
 *
 * Memplot tiga rate (win / pick / ban) satu hero merentas masa, dengan
 * peristiwa patch dilukis sebagai garis menegak berwarna. Tujuan carta ini: menunjukkan hubungan antara patch dan
 * meta - adakah buff/nerf pada patch X ada hubungannya dengan Rates
 * bergerak selepas patch itu?
 *
 * Nota reka bentuk:
 *   - paksi X ialah tarikh kategori ("YYYY-MM-DD"). Patch dan tren
 *     duduk pada paksi yang sama, jadi ReferenceLine dilutiongkapkan
 *     pada tarikh yang tepat.
 *   - titik tanpa rate langsung dilangkau (bukan plotted sebagai 0).
 *   - density tick X dikawal supaya telefon tidak berakhir dengan
 *     14 label yang bersalin.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  PATCH_CHANGE_LABEL,
  PATCH_MARKER_COLOR,
  groupPatchHistoryByDate,
  truncateSummary,
  type LiveTrendPoint,
  type PatchChangeType,
  type PatchHistoryEntry,
} from '../lib/heroTrend';

export interface HeroMetaCorrelationChartProps {
  /** Siri tren live. Rate yang tiada mesti null - bukan 0. */
  liveTrendData: readonly LiveTrendPoint[];
  /** Peristiwa patch untuk dilukis sebagai marker. */
  patchHistory: readonly PatchHistoryEntry[];
  /** Nama hero - tajuk carta. */
  heroName?: string;
  /** URL portrait - dimuat lazy dengan width/height supaya tiada CLS. */
  portraitUrl?: string | null;
  /** tinggi carta dalam px (mobile lebih pendek). */
  height?: number;
}

type SeriesKey = 'winRate' | 'pickRate' | 'banRate';

interface SeriesDefinition {
  key: SeriesKey;
  label: string;
  color: string;
}

const SERIES: readonly SeriesDefinition[] = [
  { key: 'winRate', label: 'Win rate', color: '#00E5FF' },
  { key: 'pickRate', label: 'Pick rate', color: '#F5C518' },
  { key: 'banRate', label: 'Ban rate', color: '#8B9BB4' },
];

/**
 * Gunakan matchMedia - tanpa dependency luar.
 *
 * `matchMedia` tiada dalam jsdom, jadi hook ini mesti selamat apabila
 * fungsi itu tidak wujud ( ujian, SSR).
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(max-width: 719px)');
    setIsMobile(query.matches);

    const update = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}

/** Tick X ringkas pada telefon: "2026-11-11" -> "11-11". */
function compactDate(value: string): string {
  return value.length >= 10 ? value.slice(5) : value;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
  name?: string;
}

interface ChartTooltipProps {
  active?: boolean | undefined;
  label?: string | number | undefined;
  payload?: TooltipPayloadItem[] | undefined;
  patchEvents?: PatchHistoryEntry[] | undefined;
}

function ChartTooltip({ active, label, payload, patchEvents }: ChartTooltipProps) {
  if (!active) return null;

  const date = String(label ?? '');
  const rows = (payload ?? []).filter(
    (item) => typeof item.value === 'number' && Number.isFinite(item.value)
  );
  const events = patchEvents ?? [];

  return (
    <div className="rounded-md border border-line bg-surface2 p-3 text-xs text-ink shadow-lg">
      <div className="mb-2 font-mono text-[11px] text-muted">{date}</div>

      {rows.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {rows.map((row) => {
            const definition = SERIES.find((series) => series.key === row.dataKey);
            return (
              <li key={String(row.dataKey)} className="flex items-center gap-2 py-0.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: row.color ?? definition?.color ?? '#8B9BB4' }}
                />
                <span className="text-muted">{definition?.label ?? String(row.dataKey)}</span>
                <span className="ml-auto font-mono tabular-nums text-ink">
                  {Number(row.value).toFixed(2)}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-muted">Tiada rate pada tarikh ini.</p>
      )}

      {events.length > 0 ? (
        <div className="mt-2 border-t border-line pt-2">
          {events.map((event) => (
            <div key={`${event.patchVersion}-${event.changeType}`} className="py-1">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    background: `${PATCH_MARKER_COLOR[event.changeType]}22`,
                    color: PATCH_MARKER_COLOR[event.changeType],
                  }}
                >
                  {PATCH_CHANGE_LABEL[event.changeType]}
                </span>
                <span className="font-mono text-[11px] text-ink">{event.patchVersion}</span>
              </div>
              {event.summary ? (
                <p className="mb-0 mt-1 max-w-64 text-[11px] text-muted">
                  {truncateSummary(event.summary)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface PatchTickProps {
  version: string;
  color: string;
  showText: boolean;
}

function PatchTick({ version, color, showText }: PatchTickProps) {
  if (!showText) return <g />;
  return (
    <g>
      <text
        x={0}
        y={-6}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {version}
      </text>
    </g>
  );
}

export function HeroMetaCorrelationChart({
  liveTrendData,
  patchHistory,
  heroName,
  portraitUrl,
  height = 320,
}: HeroMetaCorrelationChartProps) {
  const isMobile = useIsMobile();
  const [hidden, setHidden] = useState<Record<SeriesKey, boolean>>({
    winRate: false,
    pickRate: false,
    banRate: false,
  });

  const points = useMemo(() => [...liveTrendData], [liveTrendData]);
  const events = useMemo(() => [...patchHistory], [patchHistory]);
  const eventsByDate = useMemo(() => groupPatchHistoryByDate(events), [events]);

  const visibleSeries = SERIES.filter((series) => !hidden[series.key]);
  const tickStep = Math.max(
    1,
    Math.ceil(points.length / (isMobile ? 4 : 8))
  );
  const showPatchLabels = events.length > 0 && events.length <= (isMobile ? 4 : 8);

  const toggle = (key: SeriesKey) => {
    setHidden((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  if (points.length === 0) {
    return (
      <div className="rounded-md border border-line bg-surface p-6 text-center text-sm text-muted">
        Belum ada siri live untuk carta ini. Snapshot harian akan mengisi trend
        selepas beberapa hari.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 shrink-0 rounded-sm border border-line object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-ink">
            {heroName ? `${heroName} · patch vs meta` : 'Patch vs meta'}
          </h3>
          <p className="m-0 text-xs text-muted">
            {points.length} titik · {events.length} peristiwa patch
          </p>
        </div>
      </div>

      {/* Kawalan siri - ketuk untuk matikan/nyahzan. */}
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Siri carta">
        {SERIES.map((series) => {
          const isOn = !hidden[series.key];
          return (
            <button
              key={series.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(series.key)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold"
              style={{
                borderColor: isOn ? series.color : '#243044',
                color: isOn ? series.color : '#8B9BB4',
                background: isOn ? `${series.color}14` : 'transparent',
              }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: isOn ? series.color : '#243044' }}
              />
              {series.label}
            </button>
          );
        })}
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={points} margin={{ top: 16, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid stroke="#1A2332" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8B9BB4', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#243044' }}
              interval={tickStep - 1}
              tickFormatter={(value: string) => (isMobile ? compactDate(value) : value)}
              minTickGap={8}
            />
            <YAxis
              tick={{ fill: '#8B9BB4', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => `${value.toFixed(0)}%`}
            />
            <Tooltip
              cursor={{ stroke: '#243044' }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={props.label}
                  payload={props.payload as unknown as TooltipPayloadItem[] | undefined}
                  patchEvents={eventsByDate.get(String(props.label ?? '')) ?? []}
                />
              )}
            />

            {events.map((event) => (
              <ReferenceLine
                key={`${event.patchVersion}-${event.date}-${event.changeType}`}
                x={event.date}
                stroke={PATCH_MARKER_COLOR[event.changeType]}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={
                  <PatchTick
                    version={event.patchVersion}
                    color={PATCH_MARKER_COLOR[event.changeType]}
                    showText={showPatchLabels}
                  />
                }
              />
            ))}

            {visibleSeries.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda patch - kekal jelas walaupun label dilangkau. */}
      {events.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[11px] text-muted">
          {(['buff', 'nerf', 'adjustment'] as PatchChangeType[]).map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-5"
                style={{ background: PATCH_MARKER_COLOR[type] }}
              />
              {PATCH_CHANGE_LABEL[type]}
            </span>
          ))}
          <span className="ml-auto text-muted">
            {showPatchLabels ? 'Versi patch ditulis pada paksi' : 'Ketuk carta untuk versi patch'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
