import type { SiteRecord } from '../types/voltguard.ts';

export interface SiteSearchFilters {
  region?: string;
  district?: string;
  onlyWithCoords?: boolean;
}

export function searchSites(
  sites: SiteRecord[],
  query: string,
  filters: SiteSearchFilters = {},
  limit: number = 60,
): SiteRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  const regionFilter = filters.region?.trim().toLowerCase() ?? '';
  const districtFilter = filters.district?.trim().toLowerCase() ?? '';

  const scored: { site: SiteRecord; score: number }[] = [];

  for (const site of sites) {
    if (filters.onlyWithCoords && (site.lat === null || site.lon === null)) {
      continue;
    }
    if (regionFilter && regionFilter !== 'all' && site.region.toLowerCase() !== regionFilter) {
      continue;
    }
    if (districtFilter && districtFilter !== 'all' && site.district.toLowerCase() !== districtFilter) {
      continue;
    }

    if (!normalizedQuery) {
      scored.push({ site, score: 1 });
      continue;
    }

    const name = site.siteName.toLowerCase();
    const addr = site.address.toLowerCase();
    const cluster = site.cluster.toLowerCase();
    const subCenter = site.subCenter.toLowerCase();
    const region = site.region.toLowerCase();
    const district = site.district.toLowerCase();
    const towerCo = site.towerCo.toLowerCase();

    let score = 0;
    if (name === normalizedQuery) {
      score = 1000;
    } else if (name.startsWith(normalizedQuery)) {
      score = 600;
    } else if (name.includes(normalizedQuery)) {
      score = 400;
    } else if (addr.includes(normalizedQuery)) {
      score = 220;
    } else if (cluster.includes(normalizedQuery) || subCenter.includes(normalizedQuery)) {
      score = 160;
    } else if (region.includes(normalizedQuery) || district.includes(normalizedQuery) || towerCo.includes(normalizedQuery)) {
      score = 110;
    }

    if (score > 0) {
      scored.push({ site, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.site.siteName.localeCompare(b.site.siteName);
  });

  return scored.slice(0, Math.max(1, limit)).map((item) => item.site);
}

export function formatCoordinates(
  lat: number | null,
  lon: number | null,
): { latText: string; lonText: string; combined: string; valid: boolean } {
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      latText: 'Unavailable',
      lonText: 'Unavailable',
      combined: 'Coordinates not recorded',
      valid: false,
    };
  }
  const latText = lat.toFixed(5);
  const lonText = lon.toFixed(5);
  return {
    latText,
    lonText,
    combined: `${latText}, ${lonText}`,
    valid: true,
  };
}

export function extractUniqueRegions(sites: SiteRecord[]): string[] {
  const set = new Set<string>();
  for (const s of sites) {
    if (s.region.trim()) set.add(s.region.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function extractUniqueDistricts(sites: SiteRecord[]): string[] {
  const set = new Set<string>();
  for (const s of sites) {
    if (s.district.trim()) set.add(s.district.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
