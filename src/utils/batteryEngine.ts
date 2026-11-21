import type {
  AlertPreferences,
  AndroidDeviceProfile,
  BackgroundProcess,
  BatteryTelemetry,
  DrainHistoryPoint,
  MonthlyHealthReport,
  PowerAlert,
} from '../types/voltguard.ts';

export const MIN_ANDROID_API_LEVEL = 26; // Android 8.0 Oreo

export const DEFAULT_DEVICE_PROFILE: AndroidDeviceProfile = {
  deviceId: 'android-oreo-primary',
  deviceLabel: 'Android Device (API 26+)',
  androidVersion: 'Android 8.0+ Compatible',
  androidApiLevel: 34,
  batteryCapacityMah: 4800,
};

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  notificationsEnabled: false,
  lowBatteryThresholdPct: 20,
  highTempThresholdC: 39,
  bgCpuSpikeThresholdPct: 18,
  bgDrainSpikeMahHr: 220,
  quietHoursEnabled: false,
  channels: {
    resourceSpike: true,
    batteryThreshold: true,
    thermalGuard: true,
    syncStatus: true,
  },
};

export const INITIAL_BACKGROUND_PROCESSES: BackgroundProcess[] = [
  {
    id: 'proc-maps-sync',
    packageName: 'com.field.geo.sync',
    appName: 'Field Geo Tracker',
    category: 'Location',
    cpuPct: 22.4,
    wakeLockMin: 38,
    backgroundDrainMahHr: 285,
    ramMb: 196,
    status: 'active',
    isEssential: false,
  },
  {
    id: 'proc-social-push',
    packageName: 'com.social.feed.worker',
    appName: 'Social Media Prefetch',
    category: 'Social',
    cpuPct: 14.8,
    wakeLockMin: 24,
    backgroundDrainMahHr: 194,
    ramMb: 240,
    status: 'active',
    isEssential: false,
  },
  {
    id: 'proc-media-cache',
    packageName: 'com.stream.audio.buffer',
    appName: 'Media Preload Service',
    category: 'Media',
    cpuPct: 9.2,
    wakeLockMin: 15,
    backgroundDrainMahHr: 128,
    ramMb: 152,
    status: 'active',
    isEssential: false,
  },
  {
    id: 'proc-tower-telemetry',
    packageName: 'com.voltguard.rf.beacon',
    appName: 'RF Signal Logger',
    category: 'Telemetry',
    cpuPct: 3.1,
    wakeLockMin: 6,
    backgroundDrainMahHr: 42,
    ramMb: 48,
    status: 'active',
    isEssential: true,
  },
  {
    id: 'proc-android-system',
    packageName: 'android.os.workmanager',
    appName: 'Android Doze Scheduler',
    category: 'System',
    cpuPct: 0.4,
    wakeLockMin: 1,
    backgroundDrainMahHr: 9,
    ramMb: 34,
    status: 'active',
    isEssential: true,
  },
];

export function isAndroidVersionSupported(apiLevel: number): boolean {
  return Number.isInteger(apiLevel) && apiLevel >= MIN_ANDROID_API_LEVEL;
}

export function sanitizeAlertPreferences(prefs: AlertPreferences): AlertPreferences {
  return {
    notificationsEnabled: Boolean(prefs.notificationsEnabled),
    lowBatteryThresholdPct: Math.min(50, Math.max(5, Math.round(prefs.lowBatteryThresholdPct))),
    highTempThresholdC: Math.min(48, Math.max(32, Math.round(prefs.highTempThresholdC))),
    bgCpuSpikeThresholdPct: Math.min(60, Math.max(5, Math.round(prefs.bgCpuSpikeThresholdPct))),
    bgDrainSpikeMahHr: Math.min(600, Math.max(60, Math.round(prefs.bgDrainSpikeMahHr))),
    quietHoursEnabled: Boolean(prefs.quietHoursEnabled),
    channels: {
      resourceSpike: Boolean(prefs.channels.resourceSpike),
      batteryThreshold: Boolean(prefs.channels.batteryThreshold),
      thermalGuard: Boolean(prefs.channels.thermalGuard),
      syncStatus: Boolean(prefs.channels.syncStatus),
    },
  };
}

export interface OptimizationResult {
  processes: BackgroundProcess[];
  throttledCount: number;
  savedMahPerHr: number;
  projectedExtraMinutes: number;
  totalBackgroundMahHr: number;
  totalCpuPct: number;
}

export function computeOptimizationPlan(
  processes: BackgroundProcess[],
  autoOptimize: boolean,
  batteryCapacityMah: number = DEFAULT_DEVICE_PROFILE.batteryCapacityMah,
  currentLevelPct: number = 68,
): OptimizationResult {
  let savedMahPerHr = 0;
  let throttledCount = 0;

  const updated = processes.map((proc) => {
    if (!autoOptimize) {
      return {
        ...proc,
        status: proc.status === 'restricted' ? ('restricted' as const) : ('active' as const),
      };
    }

    if (proc.isEssential) {
      return proc;
    }

    if (proc.cpuPct >= 14 || proc.backgroundDrainMahHr >= 180 || proc.status === 'restricted') {
      const reducedMah = Math.round(proc.backgroundDrainMahHr * 0.28);
      savedMahPerHr += proc.backgroundDrainMahHr - reducedMah;
      throttledCount += 1;
      return {
        ...proc,
        cpuPct: Number((proc.cpuPct * 0.25).toFixed(1)),
        wakeLockMin: Math.max(2, Math.round(proc.wakeLockMin * 0.2)),
        backgroundDrainMahHr: reducedMah,
        status: 'throttled' as const,
      };
    }

    return proc;
  });

  const totalBackgroundMahHr = updated.reduce((sum, p) => sum + p.backgroundDrainMahHr, 0);
  const totalCpuPct = Number(updated.reduce((sum, p) => sum + p.cpuPct, 0).toFixed(1));

  const remainingMah = (Math.max(5, currentLevelPct) / 100) * batteryCapacityMah;
  const baselineDraw = totalBackgroundMahHr + savedMahPerHr + 240;
  const optimizedDraw = totalBackgroundMahHr + 240;

  const baseHours = remainingMah / Math.max(120, baselineDraw);
  const optHours = remainingMah / Math.max(120, optimizedDraw);
  const projectedExtraMinutes = Math.max(0, Math.round((optHours - baseHours) * 60));

  return {
    processes: updated,
    throttledCount,
    savedMahPerHr,
    projectedExtraMinutes,
    totalBackgroundMahHr,
    totalCpuPct,
  };
}

export function evaluateThresholdAlerts(
  telemetry: BatteryTelemetry,
  processes: BackgroundProcess[],
  prefs: AlertPreferences,
  nowIso: string,
): PowerAlert[] {
  const alerts: PowerAlert[] = [];

  if (prefs.channels.batteryThreshold && !telemetry.isCharging && telemetry.levelPct <= prefs.lowBatteryThresholdPct) {
    alerts.push({
      id: `alert-low-batt-${Math.round(telemetry.levelPct)}`,
      timestampIso: nowIso,
      severity: telemetry.levelPct <= 10 ? 'critical' : 'warning',
      category: 'battery',
      title: 'Low Battery Threshold Reached',
      message: `Battery is at ${Math.round(telemetry.levelPct)}%, at or below your ${prefs.lowBatteryThresholdPct}% threshold.`,
      dismissed: false,
    });
  }

  if (prefs.channels.thermalGuard && telemetry.temperatureC >= prefs.highTempThresholdC) {
    alerts.push({
      id: `alert-thermal-${telemetry.temperatureC.toFixed(1)}`,
      timestampIso: nowIso,
      severity: telemetry.temperatureC >= prefs.highTempThresholdC + 3 ? 'critical' : 'warning',
      category: 'thermal',
      title: 'Thermal Threshold Exceeded',
      message: `Cell temperature reached ${telemetry.temperatureC.toFixed(1)}°C (limit ${prefs.highTempThresholdC}°C). Background throttling recommended.`,
      dismissed: false,
    });
  }

  if (prefs.channels.resourceSpike) {
    for (const proc of processes) {
      if (proc.status === 'throttled' || proc.status === 'restricted') continue;

      if (proc.cpuPct >= prefs.bgCpuSpikeThresholdPct) {
        alerts.push({
          id: `alert-cpu-${proc.id}`,
          timestampIso: nowIso,
          severity: proc.cpuPct >= prefs.bgCpuSpikeThresholdPct + 10 ? 'critical' : 'warning',
          category: 'background_cpu',
          title: `Background CPU Spike · ${proc.appName}`,
          message: `${proc.packageName} is holding ${proc.cpuPct.toFixed(1)}% CPU (${proc.wakeLockMin} min wake-lock), above your ${prefs.bgCpuSpikeThresholdPct}% rule.`,
          processId: proc.id,
          dismissed: false,
        });
      } else if (proc.backgroundDrainMahHr >= prefs.bgDrainSpikeMahHr) {
        alerts.push({
          id: `alert-drain-${proc.id}`,
          timestampIso: nowIso,
          severity: 'warning',
          category: 'background_drain',
          title: `Excessive Background Drain · ${proc.appName}`,
          message: `${proc.appName} is drawing ${proc.backgroundDrainMahHr} mAh/hr in the background (threshold ${prefs.bgDrainSpikeMahHr} mAh/hr).`,
          processId: proc.id,
          dismissed: false,
        });
      }
    }
  }

  return alerts;
}

export function buildDrainHistory(
  range: '24h' | '7d' | '30d',
  autoOptimize: boolean,
  currentLevelPct: number,
): DrainHistoryPoint[] {
  const reduction = autoOptimize ? 0.72 : 1;

  if (range === '24h') {
    const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Now'];
    const baseRates = [1.8, 1.4, 2.2, 5.6, 7.1, 6.4, 5.2, 4.1, 3.3];
    const temps = [29.4, 28.8, 29.6, 33.8, 36.4, 37.9, 35.2, 33.1, 31.8];
    const targetEnd = Math.round(currentLevelPct);
    const startLevel = targetEnd >= 92 ? 96 : Math.min(100, targetEnd + 34);
    let level = startLevel;

    return hours.map((label, idx) => {
      const isLast = idx === hours.length - 1;
      const rate = Number((baseRates[idx] * reduction).toFixed(1));
      const bg = Number((rate * (autoOptimize ? 0.21 : 0.36)).toFixed(1));
      const scr = Number((rate - bg).toFixed(1));
      if (isLast) {
        level = targetEnd;
      } else if (targetEnd >= 92 && idx >= 6) {
        // Reflect late-day top-up charge back toward current level
        level = Math.min(targetEnd, level + 14);
      } else {
        level = Math.max(12, Math.round(level - rate * 1.15));
      }
      return {
        label,
        batteryLevelPct: level,
        drainRatePctHr: rate,
        screenOnDrainPct: scr,
        backgroundDrainPct: bg,
        tempC: Number((temps[idx] - (autoOptimize ? 1.4 : 0)).toFixed(1)),
      };
    });
  }

  if (range === '7d') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const levels = [74, 69, 78, 63, 71, 82, Math.round(currentLevelPct)];
    const rates = [5.1, 5.9, 4.6, 6.8, 5.4, 4.2, 4.8];
    const temps = [34.2, 35.8, 33.4, 37.6, 35.1, 32.8, 33.6];
    return days.map((label, idx) => {
      const rate = Number((rates[idx] * reduction).toFixed(1));
      const bg = Number((rate * (autoOptimize ? 0.22 : 0.38)).toFixed(1));
      return {
        label,
        batteryLevelPct: levels[idx],
        drainRatePctHr: rate,
        screenOnDrainPct: Number((rate - bg).toFixed(1)),
        backgroundDrainPct: bg,
        tempC: Number((temps[idx] - (autoOptimize ? 1.2 : 0)).toFixed(1)),
      };
    });
  }

  const weeks = ['W1', 'W2', 'W3', 'W4', 'Current'];
  const levels = [79, 74, 76, 71, Math.round(currentLevelPct)];
  const rates = [5.8, 5.3, 4.9, 4.7, 4.4];
  const temps = [36.2, 35.4, 34.1, 33.8, 32.9];
  return weeks.map((label, idx) => {
    const rate = Number((rates[idx] * reduction).toFixed(1));
    const bg = Number((rate * (autoOptimize ? 0.2 : 0.35)).toFixed(1));
    return {
      label,
      batteryLevelPct: levels[idx],
      drainRatePctHr: rate,
      screenOnDrainPct: Number((rate - bg).toFixed(1)),
      backgroundDrainPct: bg,
      tempC: Number((temps[idx] - (autoOptimize ? 1.1 : 0)).toFixed(1)),
    };
  });
}

export function generateMonthlyReports(
  autoOptimize: boolean,
  alertsResolved: number,
): MonthlyHealthReport[] {
  const boost = autoOptimize ? 420 : 0;
  return [
    {
      monthKey: '2026-11',
      monthLabel: 'November 2026',
      avgDailyDrainPct: autoOptimize ? 58 : 74,
      chargeCycles: 18,
      capacityRetentionPct: 96.4,
      estimatedHealthStatus: 'Optimal',
      peakTempC: autoOptimize ? 38.2 : 41.6,
      avgTempC: autoOptimize ? 31.8 : 34.5,
      totalSavedMah: 2840 + boost + alertsResolved * 110,
      alertsResolved: 14 + alertsResolved,
      topDrainApp: 'Field Geo Tracker',
      recommendation: autoOptimize
        ? 'Doze & wake-lock guards are keeping overnight standby drain below 1.6%/hr.'
        : 'Enable Auto-Optimize to throttle high wake-lock background location polling.',
    },
    {
      monthKey: '2026-10',
      monthLabel: 'October 2026',
      avgDailyDrainPct: 64,
      chargeCycles: 26,
      capacityRetentionPct: 96.9,
      estimatedHealthStatus: 'Optimal',
      peakTempC: 39.1,
      avgTempC: 32.4,
      totalSavedMah: 3690,
      alertsResolved: 21,
      topDrainApp: 'Social Media Prefetch',
      recommendation: 'Cell degradation remained minimal (0.5% delta); keep charge cap below 40°C.',
    },
    {
      monthKey: '2026-09',
      monthLabel: 'September 2026',
      avgDailyDrainPct: 69,
      chargeCycles: 28,
      capacityRetentionPct: 97.4,
      estimatedHealthStatus: 'Good',
      peakTempC: 40.4,
      avgTempC: 33.6,
      totalSavedMah: 3120,
      alertsResolved: 17,
      topDrainApp: 'Media Preload Service',
      recommendation: 'Two thermal spikes occurred during outdoor LTE uploads; thermal guard mitigated load.',
    },
  ];
}

export function formatDurationMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}
