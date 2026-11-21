import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  buildOfflineBundlePayload,
  buildOfflineZipArchive,
  buildSitesCsv,
  detectPlatformTarget,
  escapeCsvCell,
  getPlatformInstallSteps,
  resolvePwaBuilderUrl,
  resolveShareableAppUrl,
} from './appDownload.ts';
import { DEFAULT_ALERT_PREFERENCES } from './batteryEngine.ts';
import type { SiteRecord } from '../types/voltguard.ts';

const SAMPLE_SITE: SiteRecord = {
  id: 1,
  siteName: 'SYADB1',
  region: 'Sylhet',
  district: 'Sylhet',
  subCenter: 'Sylhet East',
  cluster: 'C1',
  towerCo: 'Edotco',
  towerCoClass: 'Macro',
  connectedSites: '2',
  platinumSite: 'No',
  agSite: 'Yes',
  battBackupHr: '8',
  onAirDate: '2020-01-01',
  throughput4gMbps: '42',
  fiberization: 'Fiber',
  address: 'Sylhet Sadar, "East" Block',
  lat: 24.8949,
  lon: 91.8687,
};

test('detectPlatformTarget identifies Android, iOS, and Desktop user agents', () => {
  assert.equal(
    detectPlatformTarget('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'),
    'android',
  );
  assert.equal(
    detectPlatformTarget('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'),
    'ios',
  );
  assert.equal(
    detectPlatformTarget('Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0'),
    'desktop',
  );
});

test('resolveShareableAppUrl returns clean http/https origin and rejects unsafe schemes', () => {
  assert.equal(
    resolveShareableAppUrl('https://voltguard.example.com/sites?q=SYADB1#top'),
    'https://voltguard.example.com',
  );
  assert.equal(
    resolveShareableAppUrl('http://localhost:3000/'),
    'http://localhost:3000',
  );
  assert.equal(resolveShareableAppUrl('javascript:alert(1)'), '');
  assert.equal(resolveShareableAppUrl('not-a-url'), '');
});

test('getPlatformInstallSteps tailors guidance for iframe and standalone contexts', () => {
  const androidIframe = getPlatformInstallSteps('android', true);
  assert.equal(androidIframe.steps.length, 3);
  assert.match(androidIframe.steps[0], /Open Direct App Link/i);

  const iosStandalone = getPlatformInstallSteps('ios', false);
  assert.equal(iosStandalone.steps.length, 3);
  assert.match(iosStandalone.steps[2], /Add to Home Screen/i);

  const desktopStandalone = getPlatformInstallSteps('desktop', false);
  assert.equal(desktopStandalone.steps.length, 3);
  assert.match(desktopStandalone.steps[0], /Install icon/i);
});

test('buildOfflineBundlePayload and buildSitesCsv format site data and CSV escaping safely', () => {
  const bundle = buildOfflineBundlePayload({
    deviceLabel: 'Pixel 8 Field',
    androidApiLevel: 34,
    autoOptimize: true,
    preferences: DEFAULT_ALERT_PREFERENCES,
    pinnedSiteNames: ['SYADB1', 'SNDOA1'],
    sites: [SAMPLE_SITE],
    exportedAtIso: '2026-11-20T21:45:00.000Z',
  });

  assert.equal(bundle.app, 'VoltGuard');
  assert.equal(bundle.formatVersion, 1);
  assert.equal(bundle.siteCount, 1);
  assert.deepEqual(bundle.pinnedSiteNames, ['SYADB1', 'SNDOA1']);

  assert.equal(escapeCsvCell('=SUM(A1)'), "'=SUM(A1)");
  const csv = buildSitesCsv([SAMPLE_SITE]);
  assert.match(csv, /^SiteName,Region,District/);
  assert.match(csv, /"Sylhet Sadar, ""East"" Block"/);
  assert.match(csv, /24\.8949,91\.8687/);
});

test('buildOfflineZipArchive generates valid readable ZIP with HTML viewer, CSV, JSON, and README', async () => {
  const result = await buildOfflineZipArchive({
    deviceLabel: 'Pixel 8 Field',
    androidApiLevel: 34,
    autoOptimize: true,
    preferences: DEFAULT_ALERT_PREFERENCES,
    pinnedSiteNames: ['SYADB1'],
    sites: [SAMPLE_SITE],
    appUrl: 'https://voltguard.example.com',
    exportedAtIso: '2026-11-20T22:00:00.000Z',
  });

  assert.equal(result.filename, 'voltguard-offline-app-2026-11-20.zip');
  assert.ok(result.data.byteLength > 200);

  const loaded = await JSZip.loadAsync(result.data);
  const files = Object.keys(loaded.files);
  assert.ok(files.includes('README.txt'));
  assert.ok(files.includes('voltguard-bundle.json'));
  assert.ok(files.includes('data/sites.csv'));
  assert.ok(files.includes('offline-viewer.html'));
  assert.ok(files.includes('android-apk/twa-manifest.json'));
  assert.ok(files.includes('android-apk/build-apk.sh'));
  assert.ok(files.includes('android-apk/build-apk.bat'));
  assert.equal(
    resolvePwaBuilderUrl('https://voltguard.example.com/sites'),
    'https://www.pwabuilder.com/reportcard?site=https%3A%2F%2Fvoltguard.example.com',
  );

  const jsonText = await loaded.file('voltguard-bundle.json')!.async('string');
  const parsed = JSON.parse(jsonText) as { siteCount: number; sites: SiteRecord[] };
  assert.equal(parsed.siteCount, 1);
  assert.equal(parsed.sites[0].siteName, 'SYADB1');

  const twaText = await loaded.file('android-apk/twa-manifest.json')!.async('string');
  const twa = JSON.parse(twaText) as { minSdkVersion: number; webManifestUrl: string };
  assert.equal(twa.minSdkVersion, 26);
  assert.equal(twa.webManifestUrl, 'https://voltguard.example.com/manifest.webmanifest');

  const htmlText = await loaded.file('offline-viewer.html')!.async('string');
  assert.match(htmlText, /VoltGuard Offline Site/);
  assert.match(htmlText, /SYADB1/);
});
