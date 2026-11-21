import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractUniqueDistricts,
  extractUniqueRegions,
  formatCoordinates,
  searchSites,
} from './siteSearch.ts';
import type { SiteRecord } from '../types/voltguard.ts';

const sitesPath = path.resolve(process.cwd(), 'public/data/sites.json');
const sites: SiteRecord[] = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

test('extracted PDF site dataset loads all 2296 sites with coordinates', () => {
  assert.equal(sites.length, 2296);
  const syadb1 = sites.find((s) => s.siteName === 'SYADB1');
  assert.ok(syadb1);
  assert.equal(syadb1.lat, 24.90694);
  assert.equal(syadb1.lon, 92.1275);
  assert.match(syadb1.address, /Vill Purbokhola/);
  assert.equal(syadb1.subCenter, 'SYLHET_EAST');
});

test('searchSites ranks exact siteName match first and supports address queries', () => {
  const exact = searchSites(sites, 'SNDOA1', {}, 10);
  assert.equal(exact[0].siteName, 'SNDOA1');
  assert.equal(exact[0].lat, 25.04933);
  assert.equal(exact[0].lon, 91.55775);

  const addrMatches = searchSites(sites, 'Doara Bazar', {}, 20);
  assert.ok(addrMatches.some((s) => s.siteName === 'SNDOA1'));
});

test('searchSites normalizes swapped KSMND1 coordinates and handles missing coords', () => {
  const ksmnd1 = searchSites(sites, 'KSMND1', {}, 5)[0];
  assert.equal(ksmnd1.siteName, 'KSMND1');
  assert.ok(ksmnd1.lat !== null && ksmnd1.lat < 30);
  assert.ok(ksmnd1.lon !== null && ksmnd1.lon > 88);

  const missingFormatted = formatCoordinates(null, null);
  assert.equal(missingFormatted.valid, false);
  assert.equal(missingFormatted.latText, 'Unavailable');

  const validFormatted = formatCoordinates(24.89811, 91.885);
  assert.equal(validFormatted.valid, true);
  assert.equal(validFormatted.combined, '24.89811, 91.88500');
});

test('region and district filter extraction works cleanly', () => {
  const regions = extractUniqueRegions(sites);
  const districts = extractUniqueDistricts(sites);
  assert.ok(regions.includes('Sylhet'));
  assert.ok(districts.includes('SY'));
});
