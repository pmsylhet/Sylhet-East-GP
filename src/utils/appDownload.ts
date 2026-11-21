import JSZip from 'jszip';
import type {
  AlertPreferences,
  MonthlyHealthReport,
  SiteRecord,
} from '../types/voltguard.ts';

export type PlatformTarget = 'android' | 'ios' | 'desktop';

export interface PlatformInstallGuide {
  title: string;
  subtitle: string;
  steps: string[];
}

export interface OfflineBundleInput {
  deviceLabel: string;
  androidApiLevel: number;
  autoOptimize: boolean;
  preferences: AlertPreferences;
  pinnedSiteNames: string[];
  sites: SiteRecord[];
  monthlyReports?: MonthlyHealthReport[];
  appUrl?: string;
  exportedAtIso: string;
}

export interface OfflineBundlePayload {
  app: 'VoltGuard';
  formatVersion: 1;
  exportedAtIso: string;
  device: {
    deviceLabel: string;
    androidApiLevel: number;
    autoOptimize: boolean;
  };
  preferences: AlertPreferences;
  pinnedSiteNames: string[];
  monthlyReports: MonthlyHealthReport[];
  siteCount: number;
  sites: SiteRecord[];
}

export function detectPlatformTarget(userAgent: string): PlatformTarget {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

export function resolveShareableAppUrl(currentHref: string): string {
  try {
    const parsed = new URL(currentHref);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function getPlatformInstallSteps(
  platform: PlatformTarget,
  isInIframe: boolean,
): PlatformInstallGuide {
  if (platform === 'ios') {
    return {
      title: 'iPhone & iPad (Safari)',
      subtitle: 'Installs as a full-screen home screen app with offline cache',
      steps: [
        isInIframe
          ? 'Tap "Open Direct App Link" above so VoltGuard opens directly in Safari.'
          : 'Make sure you are viewing VoltGuard in Safari on iOS/iPadOS.',
        'Tap the Share icon in the Safari toolbar.',
        'Scroll down, tap "Add to Home Screen", then tap "Add".',
      ],
    };
  }

  if (platform === 'android') {
    return {
      title: 'Android 8.0+ (Chrome / Edge)',
      subtitle: 'Installs as a standalone WebAPK with offline site index & alerts',
      steps: [
        isInIframe
          ? 'Scan the QR code or tap "Open Direct App Link" to open in Android Chrome.'
          : 'Open the browser menu (three dots) in the top-right corner of Chrome.',
        'Tap "Install app" or "Add to Home screen".',
        'Confirm "Install" to add VoltGuard to your Android app drawer.',
      ],
    };
  }

  return {
    title: 'Desktop (Chrome / Edge / Brave)',
    subtitle: 'Runs in its own app window with cached offline telemetry & 2,296 sites',
    steps: [
      isInIframe
        ? 'Click "Open Direct App Link" above to launch outside the preview frame.'
        : 'Look for the Install icon on the right side of the browser address bar.',
      'Click "Install VoltGuard" (or open browser menu > Save and share > Install page as app).',
      'Launch VoltGuard anytime from your desktop, dock, or Start menu.',
    ],
  };
}

export function buildOfflineBundlePayload(input: OfflineBundleInput): OfflineBundlePayload {
  return {
    app: 'VoltGuard',
    formatVersion: 1,
    exportedAtIso: input.exportedAtIso,
    device: {
      deviceLabel: input.deviceLabel,
      androidApiLevel: input.androidApiLevel,
      autoOptimize: input.autoOptimize,
    },
    preferences: input.preferences,
    pinnedSiteNames: [...input.pinnedSiteNames],
    monthlyReports: input.monthlyReports ? [...input.monthlyReports] : [],
    siteCount: input.sites.length,
    sites: input.sites,
  };
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildSitesCsv(sites: SiteRecord[]): string {
  const headers = [
    'SiteName',
    'Region',
    'District',
    'SubCenter',
    'Cluster',
    'TowerCo',
    'Address',
    'Latitude',
    'Longitude',
    'BattBackupHr',
    'Fiberization',
  ];

  const lines = [headers.join(',')];
  for (const s of sites) {
    lines.push(
      [
        escapeCsvCell(s.siteName),
        escapeCsvCell(s.region),
        escapeCsvCell(s.district),
        escapeCsvCell(s.subCenter),
        escapeCsvCell(s.cluster),
        escapeCsvCell(s.towerCo),
        escapeCsvCell(s.address),
        escapeCsvCell(s.lat ?? ''),
        escapeCsvCell(s.lon ?? ''),
        escapeCsvCell(s.battBackupHr),
        escapeCsvCell(s.fiberization),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function escapeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function buildOfflineViewerHtml(
  bundle: OfflineBundlePayload,
  appUrl: string = '',
): string {
  const safeDataJson = escapeJsonForHtmlScript({
    exportedAtIso: bundle.exportedAtIso,
    device: bundle.device,
    pinnedSiteNames: bundle.pinnedSiteNames,
    siteCount: bundle.siteCount,
    appUrl,
    sites: bundle.sites.map((s) => ({
      siteName: s.siteName,
      region: s.region,
      district: s.district,
      subCenter: s.subCenter,
      cluster: s.cluster,
      towerCo: s.towerCo,
      address: s.address,
      lat: s.lat,
      lon: s.lon,
    })),
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VoltGuard Offline Package</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b1120; color: #f8fafc; margin: 0; padding: 20px; }
    .wrap { max-width: 920px; margin: 0 auto; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
    h1 { margin: 0 0 6px; font-size: 20px; }
    .meta { color: #94a3b8; font-size: 13px; margin: 0; }
    input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #f8fafc; font-size: 14px; margin-top: 12px; }
    .list { margin-top: 12px; display: grid; gap: 10px; }
    .item { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .code { font-family: ui-monospace, monospace; font-weight: 700; color: #34d399; }
    .coords { font-family: ui-monospace, monospace; font-size: 12px; color: #cbd5e1; }
    .addr { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>VoltGuard Offline Site &amp; Device Package</h1>
      <p id="summary" class="meta"></p>
      <input id="search" type="search" placeholder="Search site name, address, district, or cluster..." aria-label="Search sites" />
    </div>
    <div id="results" class="list"></div>
  </div>
  <script id="voltguard-data" type="application/json">${safeDataJson}</script>
  <script>
    (function () {
      var data = JSON.parse(document.getElementById('voltguard-data').textContent || '{}');
      var summary = document.getElementById('summary');
      var searchInput = document.getElementById('search');
      var results = document.getElementById('results');
      var sites = Array.isArray(data.sites) ? data.sites : [];
      var dev = data.device || {};
      summary.textContent = (dev.deviceLabel || 'Android Device') + ' (API ' + (dev.androidApiLevel || 26) + ') • ' + sites.length + ' offline sites • Exported ' + (data.exportedAtIso || '');

      function render(q) {
        var term = (q || '').trim().toLowerCase();
        results.textContent = '';
        var matches = [];
        for (var i = 0; i < sites.length; i++) {
          var s = sites[i];
          if (!term || (s.siteName + ' ' + s.address + ' ' + s.district + ' ' + s.subCenter + ' ' + s.region).toLowerCase().indexOf(term) !== -1) {
            matches.push(s);
            if (matches.length >= 60) break;
          }
        }
        if (matches.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'card';
          empty.textContent = 'No matching sites found.';
          results.appendChild(empty);
          return;
        }
        for (var j = 0; j < matches.length; j++) {
          var item = matches[j];
          var card = document.createElement('div');
          card.className = 'item';
          var row = document.createElement('div');
          row.className = 'row';
          var nameEl = document.createElement('span');
          nameEl.className = 'code';
          nameEl.textContent = item.siteName;
          var coordEl = document.createElement('span');
          coordEl.className = 'coords';
          coordEl.textContent = (item.lat !== null && item.lon !== null) ? Number(item.lat).toFixed(5) + ', ' + Number(item.lon).toFixed(5) : 'No coords';
          row.appendChild(nameEl);
          row.appendChild(coordEl);
          var addrEl = document.createElement('div');
          addrEl.className = 'addr';
          addrEl.textContent = (item.address || '') + ' (' + (item.subCenter || '') + ' • ' + (item.region || '') + ')';
          card.appendChild(row);
          card.appendChild(addrEl);
          results.appendChild(card);
        }
      }
      searchInput.addEventListener('input', function (e) { render(e.target.value); });
      render('');
    })();
  </script>
</body>
</html>`;
}

export function buildTwaManifest(appUrl: string): Record<string, unknown> {
  let host = 'localhost';
  let fullUrl = 'http://localhost:3000';
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      host = parsed.host;
      fullUrl = parsed.origin;
    }
  } catch {
    // Keep defaults when URL is empty or invalid
  }

  return {
    packageId: 'com.voltguard.fieldmonitor',
    host,
    name: 'VoltGuard Power & Site Monitor',
    launcherName: 'VoltGuard',
    display: 'standalone',
    themeColor: '#0B1120',
    navigationColor: '#0B1120',
    backgroundColor: '#0B1120',
    enableNotifications: true,
    startUrl: '/',
    iconUrl: `${fullUrl}/pwa-512x512.png`,
    maskableIconUrl: `${fullUrl}/pwa-maskable-512x512.png`,
    webManifestUrl: `${fullUrl}/manifest.webmanifest`,
    minSdkVersion: 26,
    fallbackType: 'customtabs',
    features: {
      locationDelegation: { enabled: true },
    },
  };
}

export function buildApkBuildScript(appUrl: string): string {
  const safeUrl = resolveShareableAppUrl(appUrl) || 'https://YOUR-DEPLOYED-APP-URL';
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    '# Requires Node.js 18+, JDK 17+, and Android SDK (handled by @bubblewrap/cli)',
    `MANIFEST_URL="${safeUrl}/manifest.webmanifest"`,
    'echo "Initializing Android TWA project from $MANIFEST_URL..."',
    'npx --yes @bubblewrap/cli init --manifest "$MANIFEST_URL"',
    'echo "Building signed Android APK (app-release-signed.apk)..."',
    'npx --yes @bubblewrap/cli build',
    'echo "Done! Install app-release-signed.apk onto your Android 8.0+ (API 26+) device."',
  ].join('\n');
}

export function buildApkWindowsScript(appUrl: string): string {
  const safeUrl = resolveShareableAppUrl(appUrl) || 'https://YOUR-DEPLOYED-APP-URL';
  return [
    '@echo off',
    'setlocal',
    `set MANIFEST_URL=${safeUrl}/manifest.webmanifest`,
    'echo Initializing Android TWA project from %MANIFEST_URL%...',
    'call npx --yes @bubblewrap/cli init --manifest "%MANIFEST_URL%"',
    'if errorlevel 1 exit /b 1',
    'echo Building signed Android APK (app-release-signed.apk)...',
    'call npx --yes @bubblewrap/cli build',
    'if errorlevel 1 exit /b 1',
    'echo Done! Find app-release-signed.apk in this folder.',
    'pause',
  ].join('\r\n');
}

export function resolvePwaBuilderUrl(appUrl: string): string {
  const safeUrl = resolveShareableAppUrl(appUrl);
  if (!safeUrl) return 'https://www.pwabuilder.com/';
  return `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(safeUrl)}`;
}

export interface OfflineZipBuildResult {
  filename: string;
  data: Uint8Array;
  entries: string[];
}

export async function buildOfflineZipArchive(
  input: OfflineBundleInput,
): Promise<OfflineZipBuildResult> {
  const bundle = buildOfflineBundlePayload(input);
  const datePart = input.exportedAtIso.slice(0, 10) || 'export';
  const filename = `voltguard-offline-app-${datePart}.zip`;
  const resolvedUrl = resolveShareableAppUrl(input.appUrl ?? '');

  const readme = [
    'VoltGuard Power Monitor & Site Locator — Offline & Android APK Kit',
    '====================================================================',
    `Exported: ${input.exportedAtIso}`,
    `Device Profile: ${input.deviceLabel} (Android API ${input.androidApiLevel})`,
    `Auto Optimizer: ${input.autoOptimize ? 'Enabled' : 'Paused'}`,
    `Sites Included: ${bundle.siteCount}`,
    resolvedUrl ? `Installable App URL: ${resolvedUrl}` : '',
    '',
    'Contents:',
    '- offline-viewer.html            Standalone offline site search & coordinate viewer',
    '- voltguard-bundle.json          Full device settings, alert thresholds, pinned sites, reports & site index',
    '- data/sites.csv                 Spreadsheet-ready telecom site catalog with coordinates',
    '- android-apk/twa-manifest.json  Trusted Web Activity config for Android 8.0+ (API 26+)',
    '- android-apk/build-apk.sh       macOS/Linux Bubblewrap script to compile a signed .apk',
    '- android-apk/build-apk.bat      Windows Bubblewrap script to compile a signed .apk',
    '',
    'Option 1 — Instant Install on Android 8.0+ (No SDK Required):',
    'Open the App URL above in Chrome on Android and tap "Install app" (Chrome generates a WebAPK).',
    '',
    'Option 2 — Cloud APK Generator (No SDK Required):',
    `Open ${resolvePwaBuilderUrl(resolvedUrl)} -> Package for stores -> Android -> Download APK.`,
    '',
    'Option 3 — Compile a Signed .apk Locally (Requires Node 18+, JDK 17+, Android SDK):',
    'Windows: double-click android-apk\\build-apk.bat',
    'macOS/Linux: run ./android-apk/build-apk.sh',
  ]
    .filter(Boolean)
    .join('\n');

  const zip = new JSZip();
  zip.file('README.txt', readme);
  zip.file('voltguard-bundle.json', JSON.stringify(bundle, null, 2));
  zip.file('data/sites.csv', buildSitesCsv(bundle.sites));
  zip.file('offline-viewer.html', buildOfflineViewerHtml(bundle, resolvedUrl));
  zip.file('android-apk/twa-manifest.json', JSON.stringify(buildTwaManifest(resolvedUrl), null, 2));
  zip.file('android-apk/build-apk.sh', buildApkBuildScript(resolvedUrl));
  zip.file('android-apk/build-apk.bat', buildApkWindowsScript(resolvedUrl));

  const data = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    filename,
    data,
    entries: [
      'README.txt',
      'voltguard-bundle.json',
      'data/sites.csv',
      'offline-viewer.html',
      'android-apk/twa-manifest.json',
      'android-apk/build-apk.sh',
      'android-apk/build-apk.bat',
    ],
  };
}
