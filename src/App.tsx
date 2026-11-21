import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Activity,
  BarChart3,
  BellRing,
  MapPin,
  Moon,
  Sun,
  Zap,
} from 'lucide-react';
import { auth, googleProvider } from './firebase.ts';
import {
  deleteEncryptedSnapshot,
  decryptSnapshotRecord,
  pushEncryptedSnapshot,
  subscribeEncryptedSnapshots,
  type CloudSnapshotMetadata,
} from './services/cloudSyncService.ts';
import type {
  AlertPreferences,
  AndroidDeviceProfile,
  BackgroundProcess,
  BatteryTelemetry,
  NavTab,
  SiteRecord,
  SyncSnapshotPayload,
} from './types/voltguard.ts';
import {
  computeOptimizationPlan,
  DEFAULT_ALERT_PREFERENCES,
  DEFAULT_DEVICE_PROFILE,
  evaluateThresholdAlerts,
  generateMonthlyReports,
  INITIAL_BACKGROUND_PROCESSES,
  sanitizeAlertPreferences,
} from './utils/batteryEngine.ts';
import { deriveKeyFingerprint } from './utils/cryptoSync.ts';
import {
  getNotificationPermission,
  requestLocalNotificationPermission,
  sendLocalPowerNotification,
  type NotificationPermissionState,
} from './utils/notifications.ts';
import { AlertsSyncView } from './components/AlertsSyncView.tsx';
import { AnalyticsHealthView } from './components/AnalyticsHealthView.tsx';
import { DashboardView, type WorkloadMode } from './components/DashboardView.tsx';
import { buildOfflineZipArchive } from './utils/appDownload.ts';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { SiteLocatorView } from './components/SiteLocatorView.tsx';

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

const STORAGE_KEYS = {
  theme: 'voltguard_theme',
  autoOptimize: 'voltguard_auto_optimize',
  prefs: 'voltguard_alert_prefs',
  pinnedSites: 'voltguard_pinned_sites',
  device: 'voltguard_device_profile',
};

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const [autoOptimize, setAutoOptimize] = useState<boolean>(() =>
    readStoredJson(STORAGE_KEYS.autoOptimize, true),
  );
  const [workloadMode, setWorkloadMode] = useState<WorkloadMode>('balanced');
  const [device, setDevice] = useState<AndroidDeviceProfile>(() =>
    readStoredJson(STORAGE_KEYS.device, DEFAULT_DEVICE_PROFILE),
  );
  const [preferences, setPreferences] = useState<AlertPreferences>(() =>
    sanitizeAlertPreferences(readStoredJson(STORAGE_KEYS.prefs, DEFAULT_ALERT_PREFERENCES)),
  );
  const [pinnedSiteNames, setPinnedSiteNames] = useState<string[]>(() =>
    readStoredJson(STORAGE_KEYS.pinnedSites, ['SYADB1', 'SNDOA1']),
  );

  // Processes & Alerts state
  const [processes, setProcesses] = useState<BackgroundProcess[]>(INITIAL_BACKGROUND_PROCESSES);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [alertsResolvedCount, setAlertsResolvedCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    () => getNotificationPermission(),
  );
  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());

  // Hardware Battery API + Calibrated Telemetry
  const [hardwareBattery, setHardwareBattery] = useState<{
    levelPct: number;
    charging: boolean;
    dischargingMinutes: number | null;
    available: boolean;
  } | null>(null);

  // Sites dataset
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [sitesError, setSitesError] = useState('');
  const [locatorInitialQuery, setLocatorInitialQuery] = useState('');

  // Firebase Auth & Encrypted Cloud Sync
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncPassphrase, setSyncPassphrase] = useState('voltguard-field-key');
  const [keyFingerprint, setKeyFingerprint] = useState('');
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudSnapshotMetadata[]>([]);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Apply Dark Mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(STORAGE_KEYS.theme, 'light');
    }
  }, [darkMode]);

  // Persist local preferences
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.autoOptimize, JSON.stringify(autoOptimize));
  }, [autoOptimize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.pinnedSites, JSON.stringify(pinnedSiteNames));
  }, [pinnedSiteNames]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.device, JSON.stringify(device));
  }, [device]);

  // Compute key fingerprint whenever passphrase changes
  useEffect(() => {
    let cancelled = false;
    if (syncPassphrase.trim().length < 6) {
      setKeyFingerprint('');
      return;
    }
    void deriveKeyFingerprint(syncPassphrase)
      .then((fp) => {
        if (!cancelled) setKeyFingerprint(fp);
      })
      .catch(() => {
        if (!cancelled) setKeyFingerprint('');
      });
    return () => {
      cancelled = true;
    };
  }, [syncPassphrase]);

  // Load 2,296 sites dataset
  useEffect(() => {
    let cancelled = false;
    fetch('/data/sites.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SiteRecord[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setSites(data);
          setSitesLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSitesError(
            err instanceof Error ? `Failed to load site catalog: ${err.message}` : 'Failed to load site catalog.',
          );
          setSitesLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Android Chrome / WebView Battery Status API integration
  useEffect(() => {
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    if (typeof navWithBattery.getBattery !== 'function') {
      return;
    }

    let batteryObj: BatteryManagerLike | null = null;
    const syncFromHardware = () => {
      if (!batteryObj) return;
      const dischargingMin =
        Number.isFinite(batteryObj.dischargingTime) && batteryObj.dischargingTime > 0
          ? Math.round(batteryObj.dischargingTime / 60)
          : null;
      setHardwareBattery({
        levelPct: Math.round(batteryObj.level * 100),
        charging: batteryObj.charging,
        dischargingMinutes: dischargingMin,
        available: true,
      });
    };

    void navWithBattery
      .getBattery()
      .then((bat) => {
        batteryObj = bat;
        syncFromHardware();
        bat.addEventListener('levelchange', syncFromHardware);
        bat.addEventListener('chargingchange', syncFromHardware);
      })
      .catch(() => {
        // Battery API blocked or unsupported
      });

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', syncFromHardware);
        batteryObj.removeEventListener('chargingchange', syncFromHardware);
      }
    };
  }, []);

  // Firebase Auth subscription
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Encrypted snapshots Firestore subscription when signed in
  useEffect(() => {
    if (!authReady || !user) {
      setCloudSnapshots([]);
      return;
    }
    const unsub = subscribeEncryptedSnapshots(
      user.uid,
      (records) => {
        setCloudSnapshots(records);
        setSyncError('');
      },
      (err) => {
        setSyncError(err.message);
      },
    );
    return () => unsub();
  }, [authReady, user]);

  // Adjust workload process profiles cleanly when mode changes
  const activeWorkloadProcesses = useMemo(() => {
    return processes.map((proc) => {
      if (workloadMode === 'balanced') return proc;
      if (workloadMode === 'field_gps' && proc.id === 'proc-maps-sync') {
        return {
          ...proc,
          cpuPct: 26.8,
          wakeLockMin: 46,
          backgroundDrainMahHr: 335,
        };
      }
      if (workloadMode === 'thermal_stress' && !proc.isEssential) {
        return {
          ...proc,
          cpuPct: Number((proc.cpuPct * 1.45).toFixed(1)),
          wakeLockMin: Math.round(proc.wakeLockMin * 1.4),
          backgroundDrainMahHr: Math.round(proc.backgroundDrainMahHr * 1.35),
        };
      }
      return proc;
    });
  }, [processes, workloadMode]);

  const useHardwareReadings = workloadMode === 'balanced' && Boolean(hardwareBattery?.available);

  const baseLevelPct = useHardwareReadings
    ? hardwareBattery!.levelPct
    : workloadMode === 'thermal_stress'
      ? 18
      : workloadMode === 'field_gps'
        ? 54
        : 72;

  const optimization = useMemo(
    () =>
      computeOptimizationPlan(
        activeWorkloadProcesses,
        autoOptimize,
        device.batteryCapacityMah,
        baseLevelPct,
      ),
    [activeWorkloadProcesses, autoOptimize, device.batteryCapacityMah, baseLevelPct],
  );

  const telemetry: BatteryTelemetry = useMemo(() => {
    const isCharging = useHardwareReadings ? hardwareBattery!.charging : false;
    const baseTemp =
      workloadMode === 'thermal_stress'
        ? 41.2
        : workloadMode === 'field_gps'
          ? 36.2
          : 31.9;
    const temperatureC = Number((baseTemp - (autoOptimize ? 1.8 : 0)).toFixed(1));
    const currentDrawMa = optimization.totalBackgroundMahHr + (workloadMode === 'thermal_stress' ? 420 : 210);
    const estMinutes =
      (useHardwareReadings ? hardwareBattery!.dischargingMinutes : null) ??
      Math.round((((baseLevelPct / 100) * device.batteryCapacityMah) / Math.max(150, currentDrawMa)) * 60);

    return {
      levelPct: baseLevelPct,
      isCharging,
      chargingMinutesRemaining: isCharging ? 42 : null,
      estimatedMinutesRemaining: estMinutes,
      temperatureC,
      voltageMv: baseLevelPct <= 20 ? 3740 : 3980,
      currentDrawMa,
      screenOnPct: workloadMode === 'field_gps' ? 44 : 36,
      backgroundDrainPct: autoOptimize ? 18 : 34,
      activeWakeLocks: optimization.processes.filter((p) => p.status === 'active').length,
      selfCpuOverheadPct: 0.3,
      sourceMode: useHardwareReadings ? 'hardware' : 'calibrated',
      lastUpdatedIso: new Date().toISOString(),
    };
  }, [useHardwareReadings, hardwareBattery, workloadMode, autoOptimize, optimization, baseLevelPct, device.batteryCapacityMah]);

  const activeAlerts = useMemo(() => {
    const evaluated = evaluateThresholdAlerts(
      telemetry,
      optimization.processes,
      preferences,
      telemetry.lastUpdatedIso,
    );
    return evaluated.filter((a) => !dismissedAlertIds.includes(a.id));
  }, [telemetry, optimization.processes, preferences, dismissedAlertIds]);

  // Dispatch local OS notifications on newly triggered alerts
  useEffect(() => {
    if (!preferences.notificationsEnabled || preferences.quietHoursEnabled) return;
    if (notificationPermission !== 'granted') return;

    for (const alert of activeAlerts) {
      if (!notifiedAlertIdsRef.current.has(alert.id)) {
        notifiedAlertIdsRef.current.add(alert.id);
        void sendLocalPowerNotification(alert.title, alert.message, alert.id);
      }
    }
  }, [activeAlerts, preferences.notificationsEnabled, preferences.quietHoursEnabled, notificationPermission]);

  const monthlyReports = useMemo(
    () => generateMonthlyReports(autoOptimize, alertsResolvedCount),
    [autoOptimize, alertsResolvedCount],
  );

  const handleToggleProcessStatus = useCallback((processId: string) => {
    setProcesses((prev) =>
      prev.map((proc) => {
        if (proc.id !== processId || proc.isEssential) return proc;
        const nextStatus =
          proc.status === 'restricted' || proc.status === 'throttled' ? 'active' : 'restricted';
        return { ...proc, status: nextStatus };
      }),
    );
    setAlertsResolvedCount((c) => c + 1);
  }, []);

  const handleRequestNotifications = async () => {
    const status = await requestLocalNotificationPermission();
    setNotificationPermission(status);
    if (status === 'granted') {
      setPreferences((prev) => ({ ...prev, notificationsEnabled: true }));
    }
  };

  const handleSendTestNotification = async () => {
    const sent = await sendLocalPowerNotification(
      'VoltGuard Threshold Monitor',
      `Active on ${device.deviceLabel}. Low battery alert at ${preferences.lowBatteryThresholdPct}%, thermal guard at ${preferences.highTempThresholdC}°C.`,
      'voltguard-test-alert',
    );
    if (!sent) {
      setSyncError('Browser blocked notification dispatch. Ensure OS notification permission is granted.');
    }
  };

  const handleSignInGoogle = async () => {
    setSyncError('');
    try {
      await signInWithPopup(auth, googleProvider);
      setSyncStatusMessage('Google account connected for encrypted cross-device sync.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOutGoogle = async () => {
    await signOut(auth);
    setSyncStatusMessage('Signed out of cloud sync.');
  };

  const handlePushEncryptedSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncError('');
    setSyncStatusMessage('');
    try {
      const payload: SyncSnapshotPayload = {
        version: 1,
        exportedAtIso: new Date().toISOString(),
        deviceId: device.deviceId,
        deviceLabel: device.deviceLabel,
        androidApiLevel: device.androidApiLevel,
        autoOptimize,
        preferences,
        pinnedSiteNames,
        monthlyReports,
      };
      await pushEncryptedSnapshot(user.uid, payload, syncPassphrase, device.deviceId);
      setSyncStatusMessage('Encrypted state synced to Firestore cloud storage.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Encrypted sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreSnapshot = async (record: CloudSnapshotMetadata) => {
    setSyncError('');
    setSyncStatusMessage('');
    try {
      const restored = await decryptSnapshotRecord(record, syncPassphrase);
      setAutoOptimize(Boolean(restored.autoOptimize));
      setPreferences(sanitizeAlertPreferences(restored.preferences));
      if (Array.isArray(restored.pinnedSiteNames)) {
        setPinnedSiteNames(restored.pinnedSiteNames);
      }
      setSyncStatusMessage(`Decrypted and restored settings from ${record.deviceLabel}.`);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? `Decryption failed: ${err.message}`
          : 'Unable to decrypt snapshot. Verify your passphrase.',
      );
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!user) return;
    setSyncError('');
    try {
      await deleteEncryptedSnapshot(user.uid, snapshotId);
      setSyncStatusMessage('Encrypted snapshot removed from cloud storage.');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to delete snapshot.');
    }
  };

  const handleTogglePinSite = (siteName: string) => {
    setPinnedSiteNames((prev) =>
      prev.includes(siteName) ? prev.filter((s) => s !== siteName) : [...prev, siteName],
    );
  };

  const navItems: { id: NavTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Power', icon: <Zap className="h-4 w-4" /> },
    {
      id: 'analytics',
      label: 'Drain & Health',
      shortLabel: 'Health',
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: 'alerts',
      label: 'Alerts & Sync',
      shortLabel: 'Alerts',
      icon: <BellRing className="h-4 w-4" />,
    },
    {
      id: 'sites',
      label: 'Site Locator',
      shortLabel: 'Sites',
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/90">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
          {/* Left: Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 dark:bg-emerald-600 dark:text-white">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display text-sm font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-base">
                VoltGuard
              </span>
              <span className="ml-2 hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline">
                Android 8.0+
              </span>
            </div>
          </div>

          {/* Center: Desktop Navigation */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'alerts' && activeAlerts.length > 0 && (
                    <span className="font-mono text-xs text-amber-400">({activeAlerts.length})</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Theme Toggle + Install PWA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <PWAInstallButton
              siteCount={sites.length || 2296}
              onExportOfflineZip={async () => {
                const archive = await buildOfflineZipArchive({
                  deviceLabel: device.deviceLabel,
                  androidApiLevel: device.androidApiLevel,
                  autoOptimize,
                  preferences,
                  pinnedSiteNames,
                  sites,
                  monthlyReports,
                  appUrl: typeof window !== 'undefined' ? window.location.origin : '',
                  exportedAtIso: new Date().toISOString(),
                });
                return {
                  filename: archive.filename,
                  data: archive.data,
                };
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 lg:px-6 lg:pb-10 lg:pt-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            device={device}
            telemetry={telemetry}
            optimization={optimization}
            autoOptimize={autoOptimize}
            workloadMode={workloadMode}
            activeAlerts={activeAlerts}
            sites={sites}
            sitesLoaded={sitesLoaded}
            onToggleAutoOptimize={() => setAutoOptimize((prev) => !prev)}
            onChangeWorkload={setWorkloadMode}
            onToggleProcessStatus={handleToggleProcessStatus}
            onOpenSiteInLocator={(siteName) => {
              setLocatorInitialQuery(siteName);
              setActiveTab('sites');
            }}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsHealthView
            autoOptimize={autoOptimize}
            currentLevelPct={telemetry.levelPct}
            monthlyReports={monthlyReports}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsSyncView
            preferences={preferences}
            notificationPermission={notificationPermission}
            activeAlerts={activeAlerts}
            device={device}
            user={user}
            authReady={authReady}
            syncPassphrase={syncPassphrase}
            keyFingerprint={keyFingerprint}
            cloudSnapshots={cloudSnapshots}
            syncStatusMessage={syncStatusMessage}
            syncError={syncError}
            isSyncing={isSyncing}
            onUpdatePreferences={(next) => setPreferences(sanitizeAlertPreferences(next))}
            onRequestNotificationPermission={() => void handleRequestNotifications()}
            onSendTestNotification={() => void handleSendTestNotification()}
            onDismissAlert={(id) => {
              setDismissedAlertIds((prev) => [...prev, id]);
              setAlertsResolvedCount((c) => c + 1);
            }}
            onThrottleAlertProcess={handleToggleProcessStatus}
            onChangePassphrase={setSyncPassphrase}
            onUpdateDeviceLabel={(label, apiLevel) =>
              setDevice((prev) => ({
                ...prev,
                deviceLabel: label,
                androidApiLevel: Math.max(26, Math.min(36, apiLevel)),
              }))
            }
            onSignInGoogle={() => void handleSignInGoogle()}
            onSignOutGoogle={() => void handleSignOutGoogle()}
            onPushEncryptedSync={() => void handlePushEncryptedSync()}
            onRestoreSnapshot={(record) => void handleRestoreSnapshot(record)}
            onDeleteSnapshot={(id) => void handleDeleteSnapshot(id)}
          />
        )}

        {activeTab === 'sites' && (
          <SiteLocatorView
            sites={sites}
            sitesLoaded={sitesLoaded}
            sitesError={sitesError}
            initialQuery={locatorInitialQuery}
            pinnedSiteNames={pinnedSiteNames}
            onTogglePinSite={handleTogglePinSite}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Android 8.0+ Thumb Zone) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95 lg:hidden"
      >
        <div className="grid h-14 grid-cols-4 items-center">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
