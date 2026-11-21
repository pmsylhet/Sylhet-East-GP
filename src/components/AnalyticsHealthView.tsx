import React, { useMemo, useState } from 'react';
import { Calendar, Download, FileBarChart2, Flame, ShieldCheck, TrendingDown } from 'lucide-react';
import type { DrainHistoryPoint, MonthlyHealthReport } from '../types/voltguard.ts';
import { buildDrainHistory } from '../utils/batteryEngine.ts';

interface AnalyticsHealthViewProps {
  autoOptimize: boolean;
  currentLevelPct: number;
  monthlyReports: MonthlyHealthReport[];
}

export const AnalyticsHealthView: React.FC<AnalyticsHealthViewProps> = ({
  autoOptimize,
  currentLevelPct,
  monthlyReports,
}) => {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    monthlyReports[0]?.monthKey ?? '2026-11',
  );

  const series: DrainHistoryPoint[] = useMemo(
    () => buildDrainHistory(range, autoOptimize, currentLevelPct),
    [range, autoOptimize, currentLevelPct],
  );

  const activePoint =
    selectedIndex !== null && series[selectedIndex]
      ? series[selectedIndex]
      : series[series.length - 1];

  const activeReport =
    monthlyReports.find((r) => r.monthKey === selectedMonthKey) ?? monthlyReports[0];

  // SVG chart dimensions
  const width = 760;
  const height = 240;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxRate = Math.max(8, ...series.map((d) => d.drainRatePctHr + 1));

  const levelPoints = series
    .map((pt, idx) => {
      const x = padL + (idx / Math.max(1, series.length - 1)) * plotW;
      const y = padT + ((100 - pt.batteryLevelPct) / 100) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = useMemo(() => {
    if (series.length === 0) return '';
    const coords = series.map((pt, idx) => {
      const x = padL + (idx / Math.max(1, series.length - 1)) * plotW;
      const y = padT + ((100 - pt.batteryLevelPct) / 100) * plotH;
      return { x, y };
    });
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `M ${first.x.toFixed(1)},${(padT + plotH).toFixed(1)} ` +
      coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
      ` L ${last.x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  }, [series, plotW, plotH]);

  const handleDownloadReport = () => {
    if (!activeReport) return;
    const blob = new Blob([JSON.stringify(activeReport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voltguard-health-${activeReport.monthKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Battery Drain History Chart */}
      <section
        aria-label="Battery drain history chart"
        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Detailed Drain Telemetry
            </p>
            <h1 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Battery Drain History Chart
            </h1>
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Chart time range">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRange(r);
                  setSelectedIndex(null);
                }}
                className={`min-h-[40px] rounded-xl px-3.5 text-xs font-semibold uppercase transition ${
                  range === r
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Active Data Point Summary Strip */}
        {activePoint && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-5">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Interval</span>
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {activePoint.label}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Battery Level</span>
              <p className="font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {activePoint.batteryLevelPct}%
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Drain</span>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                {activePoint.drainRatePctHr}% / hr
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Screen vs BG</span>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                {activePoint.screenOnDrainPct}% · {activePoint.backgroundDrainPct}%
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Cell Temp</span>
              <p className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {activePoint.tempC.toFixed(1)}°C
              </p>
            </div>
          </div>
        )}

        {/* Responsive SVG Chart */}
        <div className="mt-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-60 w-full min-w-[540px]"
            role="img"
            aria-label={`Battery drain history chart for ${range}`}
          >
            <defs>
              <linearGradient id="voltguardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = padT + ((100 - tick) / 100) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={width - padR}
                    y2={y}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 font-mono text-[10px]"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {/* Background drain bars */}
            {series.map((pt, idx) => {
              const x = padL + (idx / Math.max(1, series.length - 1)) * plotW;
              const barH = (pt.drainRatePctHr / maxRate) * (plotH * 0.55);
              const bgH = (pt.backgroundDrainPct / maxRate) * (plotH * 0.55);
              return (
                <g key={`bar-${pt.label}`}>
                  <rect
                    x={x - 10}
                    y={padT + plotH - barH}
                    width={20}
                    height={barH}
                    rx={4}
                    className="fill-slate-200/80 dark:fill-slate-700/70"
                  />
                  <rect
                    x={x - 10}
                    y={padT + plotH - bgH}
                    width={20}
                    height={bgH}
                    rx={4}
                    className="fill-amber-500/80"
                  />
                </g>
              );
            })}

            {/* Area & Battery level curve */}
            <path d={areaPath} fill="url(#voltguardAreaGrad)" />
            <polyline
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={levelPoints}
            />

            {/* Interactive Nodes & X Labels */}
            {series.map((pt, idx) => {
              const x = padL + (idx / Math.max(1, series.length - 1)) * plotW;
              const y = padT + ((100 - pt.batteryLevelPct) / 100) * plotH;
              const isSelected = activePoint?.label === pt.label;
              return (
                <g key={pt.label}>
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                  >
                    {pt.label}
                  </text>
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 6 : 4}
                    fill={isSelected ? '#10B981' : '#FFFFFF'}
                    stroke="#10B981"
                    strokeWidth="2.5"
                    className="cursor-pointer"
                    onClick={() => setSelectedIndex(idx)}
                  />
                  <rect
                    x={x - 20}
                    y={padT}
                    width={40}
                    height={plotH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => setSelectedIndex(idx)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Battery Charge Level (%)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
            Total Drain Rate (%/hr)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
            Background Drain Portion (%/hr)
          </span>
        </div>
      </section>

      {/* Monthly Battery Health Reports */}
      <section
        aria-label="Monthly battery health reports"
        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cell Longevity Diagnostics
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Monthly Battery Health Reports
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Select monthly report">
              {monthlyReports.map((rep) => (
                <button
                  key={rep.monthKey}
                  type="button"
                  onClick={() => setSelectedMonthKey(rep.monthKey)}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                    activeReport?.monthKey === rep.monthKey
                      ? 'bg-slate-900 text-white dark:bg-emerald-600'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{rep.monthLabel}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {activeReport && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Capacity Health</span>
                </div>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {activeReport.capacityRetentionPct.toFixed(1)}%
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {activeReport.estimatedHealthStatus}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <FileBarChart2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>Charge Cycles</span>
                </div>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeReport.chargeCycles}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Full equivalents</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <TrendingDown className="h-3.5 w-3.5 text-slate-400" />
                  <span>Avg Daily Drain</span>
                </div>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeReport.avgDailyDrainPct}%
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Per 24h window</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span>Thermal Peak</span>
                </div>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeReport.peakTempC.toFixed(1)}°C
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Avg {activeReport.avgTempC.toFixed(1)}°C
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-xs text-slate-500 dark:text-slate-400">Saved via Guard</span>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {activeReport.totalSavedMah.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">mAh reclaimed</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-xs text-slate-500 dark:text-slate-400">Alerts Resolved</span>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {activeReport.alertsResolved}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  Top: {activeReport.topDrainApp}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Diagnostic Summary · {activeReport.monthLabel}
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {activeReport.recommendation}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
