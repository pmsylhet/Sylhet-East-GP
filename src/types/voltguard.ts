export type NavTab = 'dashboard' | 'analytics' | 'alerts' | 'sites';

export interface AndroidDeviceProfile {
  deviceId: string;
  deviceLabel: string;
  androidVersion: string;
  androidApiLevel: number; // Minimum 26 (Android 8.0 Oreo)
  batteryCapacityMah: number;
}

export interface BackgroundProcess {
  id: string;
  packageName: string;
  appName: string;
  category: 'Telemetry' | 'Social' | 'Media' | 'Location' | 'System';
  cpuPct: number;
  wakeLockMin: number;
  backgroundDrainMahHr: number;
  ramMb: number;
  status: 'active' | 'throttled' | 'restricted';
  isEssential: boolean;
}

export interface BatteryTelemetry {
  levelPct: number;
  isCharging: boolean;
  chargingMinutesRemaining: number | null;
  estimatedMinutesRemaining: number;
  temperatureC: number;
  voltageMv: number;
  currentDrawMa: number;
  screenOnPct: number;
  backgroundDrainPct: number;
  activeWakeLocks: number;
  selfCpuOverheadPct: number;
  sourceMode: 'hardware' | 'calibrated';
  lastUpdatedIso: string;
}

export interface AlertChannels {
  resourceSpike: boolean;
  batteryThreshold: boolean;
  thermalGuard: boolean;
  syncStatus: boolean;
}

export interface AlertPreferences {
  notificationsEnabled: boolean;
  lowBatteryThresholdPct: number;
  highTempThresholdC: number;
  bgCpuSpikeThresholdPct: number;
  bgDrainSpikeMahHr: number;
  quietHoursEnabled: boolean;
  channels: AlertChannels;
}

export interface PowerAlert {
  id: string;
  timestampIso: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'battery' | 'thermal' | 'background_cpu' | 'background_drain';
  title: string;
  message: string;
  processId?: string;
  dismissed: boolean;
}

export interface DrainHistoryPoint {
  label: string;
  batteryLevelPct: number;
  drainRatePctHr: number;
  screenOnDrainPct: number;
  backgroundDrainPct: number;
  tempC: number;
}

export interface MonthlyHealthReport {
  monthKey: string;
  monthLabel: string;
  avgDailyDrainPct: number;
  chargeCycles: number;
  capacityRetentionPct: number;
  estimatedHealthStatus: 'Optimal' | 'Good' | 'Monitor';
  peakTempC: number;
  avgTempC: number;
  totalSavedMah: number;
  alertsResolved: number;
  topDrainApp: string;
  recommendation: string;
}

export interface SiteRecord {
  id: number;
  siteName: string;
  district: string;
  lat: number | null;
  lon: number | null;
  towerCoClass: string;
  connectedSites: string;
  address: string;
  platinumSite: string;
  towerCo: string;
  agSite: string;
  battBackupHr: string;
  subCenter: string;
  region: string;
  cluster: string;
  onAirDate: string;
  callingMin?: string;
  volume4g?: string;
  l2600?: string;
  l2100?: string;
  mimo4t4r?: string;
  throughput4gMbps: string;
  fiberization: string;
  coordsNormalized?: boolean;
}

export interface SyncSnapshotPayload {
  version: number;
  exportedAtIso: string;
  deviceId: string;
  deviceLabel: string;
  androidApiLevel: number;
  autoOptimize: boolean;
  preferences: AlertPreferences;
  pinnedSiteNames: string[];
  monthlyReports: MonthlyHealthReport[];
}
