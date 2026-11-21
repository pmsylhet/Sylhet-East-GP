import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Compass,
  Copy,
  MapPin,
  RadioTower,
  Search,
  X,
} from 'lucide-react';
import type { SiteRecord } from '../types/voltguard.ts';
import {
  extractUniqueDistricts,
  extractUniqueRegions,
  formatCoordinates,
  searchSites,
} from '../utils/siteSearch.ts';

interface SiteLocatorViewProps {
  sites: SiteRecord[];
  sitesLoaded: boolean;
  sitesError: string;
  initialQuery: string;
  pinnedSiteNames: string[];
  onTogglePinSite: (siteName: string) => void;
}

export const SiteLocatorView: React.FC<SiteLocatorViewProps> = ({
  sites,
  sitesLoaded,
  sitesError,
  initialQuery,
  pinnedSiteNames,
  onTogglePinSite,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [regionFilter, setRegionFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [onlyWithCoords, setOnlyWithCoords] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [selectedSiteName, setSelectedSiteName] = useState<string>('');
  const [copiedCoords, setCopiedCoords] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setSelectedSiteName(initialQuery);
    }
  }, [initialQuery]);

  const regions = useMemo(() => extractUniqueRegions(sites), [sites]);
  const districts = useMemo(() => extractUniqueDistricts(sites), [sites]);

  const filteredSites = useMemo(() => {
    const base = onlyPinned
      ? sites.filter((s) => pinnedSiteNames.includes(s.siteName))
      : sites;
    return searchSites(
      base,
      query,
      {
        region: regionFilter,
        district: districtFilter,
        onlyWithCoords,
      },
      80,
    );
  }, [sites, query, regionFilter, districtFilter, onlyWithCoords, onlyPinned, pinnedSiteNames]);

  const selectedSite = useMemo(() => {
    if (selectedSiteName) {
      const match =
        filteredSites.find((s) => s.siteName === selectedSiteName) ??
        sites.find((s) => s.siteName === selectedSiteName);
      if (match) return match;
    }
    return filteredSites[0] ?? null;
  }, [filteredSites, sites, selectedSiteName]);

  const selectedCoords = selectedSite
    ? formatCoordinates(selectedSite.lat, selectedSite.lon)
    : null;

  const handleCopyCoordinates = async () => {
    if (!selectedCoords || !selectedCoords.valid) return;
    try {
      await navigator.clipboard.writeText(selectedCoords.combined);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 1800);
    } catch {
      // Clipboard denied in restricted context
    }
  };

  return (
    <div className="space-y-5">
      {/* Search Header & Filters */}
      <section
        aria-label="Site location and coordinate search controls"
        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sylhet East &amp; Regional Site Index · {sitesLoaded ? sites.length.toLocaleString() : '…'} Sites
            </p>
            <h1 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Site Name, Location &amp; Coordinates Search
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setOnlyPinned((prev) => !prev)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
              onlyPinned
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>Pinned ({pinnedSiteNames.length})</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-6">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedSiteName('');
              }}
              placeholder="Search Site Name (e.g. SYADB1, SNDOA1), Address, Cluster, or Sub Center..."
              aria-label="Search site name, location, latitude and longitude"
              className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-emerald-500 dark:focus:bg-slate-950"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search query"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by region"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by district code"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  District: {d}
                </option>
              ))}
            </select>
          </div>

          <label className="flex min-h-[46px] cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 lg:col-span-2">
            <span>Has Lat/Lon</span>
            <input
              type="checkbox"
              checked={onlyWithCoords}
              onChange={(e) => setOnlyWithCoords(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
          </label>
        </div>

        {sitesError && (
          <p role="alert" className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
            {sitesError}
          </p>
        )}
      </section>

      {/* Results & Detail Split Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Matching Sites List */}
        <section
          aria-label="Matching sites list"
          className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Showing {filteredSites.length} {filteredSites.length === 80 ? '(Top 80)' : 'matches'}
            </span>
          </div>

          {!sitesLoaded ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No sites match your search
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try clearing filters or searching another Site Name such as SYADB1 or SNDOA1.
              </p>
            </div>
          ) : (
            <ul className="max-h-[540px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {filteredSites.map((site) => {
                const coords = formatCoordinates(site.lat, site.lon);
                const isSelected = selectedSite?.id === site.id;
                return (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSiteName(site.siteName)}
                      className={`flex min-h-[56px] w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                        isSelected
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            {site.siteName}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {site.district} · {site.subCenter || site.region}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                          {site.address || 'Address not specified'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                        {coords.valid ? (
                          <>
                            <div>{coords.latText}</div>
                            <div>{coords.lonText}</div>
                          </>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Selected Site Coordinates, Location & Telemetry Detail */}
        <section
          aria-label="Selected site location and coordinate details"
          className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7"
        >
          {!selectedSite ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <Compass className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                Select a site to inspect its full location and coordinates.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <RadioTower className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="font-mono text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {selectedSite.siteName}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Region: {selectedSite.region || '—'} · Sub Center: {selectedSite.subCenter || '—'} · Cluster:{' '}
                    {selectedSite.cluster || '—'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onTogglePinSite(selectedSite.siteName)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                      pinnedSiteNames.includes(selectedSite.siteName)
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>
                      {pinnedSiteNames.includes(selectedSite.siteName) ? 'Pinned' : 'Pin Site'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Site Location & Exact Lat/Lon Coordinates */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Site Location</span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900 dark:text-white">
                    {selectedSite.address || 'No street/village address recorded'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    District Code: <span className="font-mono font-semibold">{selectedSite.district || '—'}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Actual Coordinates
                    </span>
                    {selectedCoords?.valid && (
                      <button
                        type="button"
                        onClick={() => void handleCopyCoordinates()}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {copiedCoords ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400">
                        Latitude (Lat)
                      </span>
                      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                        {selectedCoords?.latText}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400">
                        Longitude (Lon)
                      </span>
                      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                        {selectedCoords?.lonText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Site Backup & RF Details */}
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-4">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Battery Backup</span>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {selectedSite.battBackupHr ? `${selectedSite.battBackupHr} hr` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Tower Co / Class</span>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {selectedSite.towerCo || '—'} · Class {selectedSite.towerCoClass || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">4G Throughput</span>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {selectedSite.throughput4gMbps ? `${selectedSite.throughput4gMbps} Mbps` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Fiber / Connected</span>
                  <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {selectedSite.fiberization || '—'} · {selectedSite.connectedSites || '0'} sites
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Platinum / AG</span>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {selectedSite.platinumSite || 'No'} / {selectedSite.agSite || 'No'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">On-Air Date</span>
                  <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                    {selectedSite.onAirDate || '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">4T4R / Spectrum</span>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {selectedSite.mimo4t4r || '—'} · L2600: {selectedSite.l2600 || 'No'} · L2100:{' '}
                    {selectedSite.l2100 || 'No'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
