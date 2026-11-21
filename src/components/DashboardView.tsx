import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BatteryCharging,
  BatteryFull,
  Cpu,
  MapPin,
  Search,
  ShieldCheck,
  Sliders,
  Thermometer,
  Zap,
} from 'lucide-react';
import type {
  AndroidDeviceProfile,
  BackgroundProcess,
  BatteryTelemetry,
  PowerAlert,
  SiteRecord,
} from '../types/voltguard.ts';
import {
  formatDurationMinutes,
  type OptimizationResult,
} from '../utils/batteryEngine.ts';
import { formatCoordinates, searchSites } from '../utils/siteSearch.ts';

export type WorkloadMode = 'balanced' | 'field_gps' | 'thermal_stress';

interface DashboardViewProps {
  device: AndroidDeviceProfile;
  telemetry: BatteryTelemetry;
  optimization: OptimizationResult;
  autoOptimize: boolean;
  workloadMode: WorkloadMode;
  activeAlerts: PowerAlert[];
  sites: SiteRecord[];
  sitesLoaded: boolean;
  onToggleAutoOptimize: () => void;
  onChangeWorkload: (mode: WorkloadMode) => void;
  onToggleProcessStatus: (processId: string) => void;
  onOpenSiteInLocator: (siteName: string) => void;
  onNavigateTab: (tab: 'analytics' | 'alerts' | 'sites') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  device,
  telemetry,
  optimization,
  autoOptimize,
  workloadMode,
  activeAlerts,
  sites,
  sitesLoaded,
  onToggleAutoOptimize,
  onChangeWorkload,
  onToggleProcessStatus,
  onOpenSiteInLocator,
  onNavigateTab,
}) => {
  const [quickSiteQuery, setQuickSiteQuery] = useState('');

  const quickResults = useMemo(() => {
    if (!quickSiteQuery.trim()) {
      return [];
    }
    return searchSites(sites, quickSiteQuery, {}, 5);
  }, [sites, quickSiteQuery]);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, telemetry.levelPct));
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  const batteryAccent =
    clampedPct <= 20
      ? 'text-rose-600 dark:text-rose-400'
      : clampedPct <= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  const ringStroke =
    clampedPct <= 20
      ? '#DC2626'
      : clampedPct <= 40
        ? '#D97706'
        : '#10B981';

  return (
    <div className="space-y-6">
      {/* Top Hero Grid: Battery Ring + Auto-Optimization + Quick Site Finder */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Battery & Thermal Telemetry Card */}
        <section
          aria-label="Battery telemetry overview"
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {device.deviceLabel} · API {device.androidApiLevel}
              </p>
              <h1 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                Power &amp; Thermal State
              </h1>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {telemetry.sourceMode === 'hardware' ? 'Device Battery API' : 'Calibrated Sensor'}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-6">
            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`font-display text-2xl font-extrabold tabular-nums ${batteryAccent}`}>
                  {Math.round(clampedPct)}%
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {telemetry.isCharging ? 'Charging' : 'On Battery'}
                </span>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {telemetry.isCharging ? (
                    <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <BatteryFull className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>Remaining</span>
                </div>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatDurationMinutes(
                    telemetry.estimatedMinutesRemaining + optimization.projectedExtraMinutes,
                  )}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Thermometer className="h-3.5 w-3.5 text-slate-400" />
                  <span>Cell Temp</span>
                </div>
                <p
                  className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                    telemetry.temperatureC >= 39
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {telemetry.temperatureC.toFixed(1)}°C
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Zap className="h-3.5 w-3.5 text-slate-400" />
                  <span>Draw / Volt</span>
                </div>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  {telemetry.currentDrawMa}mA · {(telemetry.voltageMv / 1000).toFixed(2)}V
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Cpu className="h-3.5 w-3.5 text-slate-400" />
                  <span>App Overhead</span>
                </div>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {telemetry.selfCpuOverheadPct.toFixed(1)}% CPU
                </p>
              </div>
            </div>
          </div>

          {/* Workload Test Profile Selector */}
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Workload Profile
              </span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workload simulation profile">
                {(
                  [
                    { id: 'balanced', label: 'Balanced' },
                    { id: 'field_gps', label: 'Field GPS/LTE' },
                    { id: 'thermal_stress', label: 'High Load' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeWorkload(mode.id)}
                    className={`min-h-[36px] rounded-lg px-2.5 text-xs font-medium transition ${
                      workloadMode === mode.id
                        ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Automatic Battery Optimizer Panel */}
        <section
          aria-label="Automatic battery optimizer"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Android 8.0+ Doze Guard
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                  Auto Battery Optimizer
                </h2>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoOptimize}
                aria-label="Toggle automatic battery optimization"
                onClick={onToggleAutoOptimize}
                className={`relative inline-flex min-h-[44px] min-w-[64px] shrink-0 items-center justify-center rounded-xl px-2 text-xs font-bold transition ${
                  autoOptimize
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {autoOptimize ? 'ON' : 'OFF'}
              </button>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {autoOptimize
                ? 'Automatically restricts non-essential wake locks and high-frequency background jobs to extend standby endurance.'
                : 'Automatic throttling is paused. Enable optimization to clamp background wake-locks and reduce thermal draw.'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Power Saved</span>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {optimization.savedMahPerHr} mAh/h
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Life Gain</span>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                +{formatDurationMinutes(optimization.projectedExtraMinutes)}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Throttled</span>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                {optimization.throttledCount} apps
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onToggleAutoOptimize}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{autoOptimize ? 'Optimization Active' : 'Optimize Battery Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reports
            </button>
          </div>
        </section>

        {/* Quick Site Search Widget (Search Site Name -> Location + Lat/Lon) */}
        <section
          aria-label="Quick site location and coordinate search"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Site Lookup
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('sites')}
                className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
              >
                All {sitesLoaded ? sites.length.toLocaleString() : '2,296'} sites →
              </button>
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Site Coordinates
            </h2>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                inputMode="search"
                value={quickSiteQuery}
                onChange={(e) => setQuickSiteQuery(e.target.value)}
                placeholder="Site name (e.g. SYADB1)..."
                aria-label="Quick search site name, location, and coordinates"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-500 dark:focus:bg-slate-950"
              />
            </div>

            <div className="mt-3 space-y-2">
              {!quickSiteQuery.trim() ? (
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Enter a site code such as <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">SYADB1</span>,{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">SNDOA1</span>, or{' '}
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">SYAGP1</span> to inspect exact address, latitude, and longitude.
                </p>
              ) : quickResults.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No matching site found for &ldquo;{quickSiteQuery}&rdquo;.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quickResults.map((site) => {
                    const coords = formatCoordinates(site.lat, site.lon);
                    return (
                      <li key={site.id} className="py-2 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => onOpenSiteInLocator(site.siteName)}
                          className="w-full text-left transition hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {site.siteName}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">
                              {coords.valid ? `${coords.latText}, ${coords.lonText}` : 'No coords'}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {site.address || `${site.subCenter} · ${site.region}`}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('sites')}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Open Full Site Locator</span>
          </button>
        </section>
      </div>

      {/* Real-Time Alerts Banner + Background Process Resource Monitor */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Background Resource Usage Monitor */}
        <section
          aria-label="Real-time background resource usage"
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Background Resource Monitor
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Active wake locks &amp; background mAh/hr draw · Total{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {optimization.totalBackgroundMahHr} mAh/h
                </span>{' '}
                ·{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {optimization.totalCpuPct.toFixed(1)}% CPU
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('alerts')}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Alert Thresholds</span>
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2.5 pr-3">Process</th>
                  <th className="px-2 pb-2.5 text-right">CPU</th>
                  <th className="px-2 pb-2.5 text-right">Wake Lock</th>
                  <th className="px-2 pb-2.5 text-right">Drain</th>
                  <th className="pb-2.5 pl-3 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {optimization.processes.map((proc: BackgroundProcess) => (
                  <tr key={proc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900 dark:text-white">{proc.appName}</div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {proc.packageName} · {proc.category}
                      </div>
                    </td>
                    <td
                      className={`px-2 py-3 text-right font-mono text-xs font-semibold tabular-nums ${
                        proc.cpuPct >= 18
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {proc.cpuPct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                      {proc.wakeLockMin}m
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {proc.backgroundDrainMahHr} mAh/h
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {proc.isEssential ? (
                        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                          System
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleProcessStatus(proc.id)}
                          className={`min-h-[36px] rounded-lg px-2.5 text-xs font-semibold transition ${
                            proc.status === 'throttled' || proc.status === 'restricted'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {proc.status === 'throttled' || proc.status === 'restricted'
                            ? 'Throttled'
                            : 'Throttle'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Live Threshold Alerts Feed */}
        <section
          aria-label="Active real-time resource alerts"
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Real-Time Resource Alerts
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('alerts')}
              className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Manage Rules →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {activeAlerts.length === 0 ? (
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  All Thresholds Nominal
                </p>
                <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-400/90">
                  Background CPU, wake-locks, thermal envelope, and cell reserve are within your configured limits.
                </p>
              </div>
            ) : (
              activeAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle
                        className={`h-4 w-4 shrink-0 ${
                          alert.severity === 'critical'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {alert.title}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-semibold uppercase ${
                        alert.severity === 'critical'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {alert.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
