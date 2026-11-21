import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Cloud,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { CloudSnapshotMetadata } from '../services/cloudSyncService.ts';
import type {
  AlertPreferences,
  AndroidDeviceProfile,
  PowerAlert,
} from '../types/voltguard.ts';
import type { NotificationPermissionState } from '../utils/notifications.ts';

interface AlertsSyncViewProps {
  preferences: AlertPreferences;
  notificationPermission: NotificationPermissionState;
  activeAlerts: PowerAlert[];
  device: AndroidDeviceProfile;
  user: User | null;
  authReady: boolean;
  syncPassphrase: string;
  keyFingerprint: string;
  cloudSnapshots: CloudSnapshotMetadata[];
  syncStatusMessage: string;
  syncError: string;
  isSyncing: boolean;
  onUpdatePreferences: (next: AlertPreferences) => void;
  onRequestNotificationPermission: () => void;
  onSendTestNotification: () => void;
  onDismissAlert: (alertId: string) => void;
  onThrottleAlertProcess: (processId: string) => void;
  onChangePassphrase: (value: string) => void;
  onUpdateDeviceLabel: (label: string, apiLevel: number) => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onPushEncryptedSync: () => void;
  onRestoreSnapshot: (record: CloudSnapshotMetadata) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}

export const AlertsSyncView: React.FC<AlertsSyncViewProps> = ({
  preferences,
  notificationPermission,
  activeAlerts,
  device,
  user,
  authReady,
  syncPassphrase,
  keyFingerprint,
  cloudSnapshots,
  syncStatusMessage,
  syncError,
  isSyncing,
  onUpdatePreferences,
  onRequestNotificationPermission,
  onSendTestNotification,
  onDismissAlert,
  onThrottleAlertProcess,
  onChangePassphrase,
  onUpdateDeviceLabel,
  onSignInGoogle,
  onSignOutGoogle,
  onPushEncryptedSync,
  onRestoreSnapshot,
  onDeleteSnapshot,
}) => {
  const [deviceLabelDraft, setDeviceLabelDraft] = useState(device.deviceLabel);
  const [apiLevelDraft, setApiLevelDraft] = useState(device.androidApiLevel);

  const toggleChannel = (key: keyof AlertPreferences['channels']) => {
    onUpdatePreferences({
      ...preferences,
      channels: {
        ...preferences.channels,
        [key]: !preferences.channels[key],
      },
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Local Notification Preferences & Power Thresholds */}
      <section
        aria-label="Local notification preferences and thresholds"
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Android 8.0+ Notification Channels
            </p>
            <h1 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Local Power Thresholds &amp; Alerts
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' ? (
              <button
                type="button"
                onClick={onRequestNotificationPermission}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                <Bell className="h-4 w-4" />
                <span>Enable OS Alerts</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSendTestNotification}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <BellRing className="h-4 w-4" />
                <span>Send Test Alert</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Notification permission status:{' '}
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {notificationPermission}
          </span>
        </p>

        {/* Threshold Sliders */}
        <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="low-batt-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                Low Battery Warning Threshold
              </label>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {preferences.lowBatteryThresholdPct}%
              </span>
            </div>
            <input
              id="low-batt-slider"
              type="range"
              min={5}
              max={50}
              value={preferences.lowBatteryThresholdPct}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  lowBatteryThresholdPct: Number(e.target.value),
                })
              }
              className="mt-2 h-2 w-full cursor-pointer accent-emerald-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="high-temp-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                Thermal Guard Threshold
              </label>
              <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {preferences.highTempThresholdC}°C
              </span>
            </div>
            <input
              id="high-temp-slider"
              type="range"
              min={32}
              max={48}
              value={preferences.highTempThresholdC}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  highTempThresholdC: Number(e.target.value),
                })
              }
              className="mt-2 h-2 w-full cursor-pointer accent-amber-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="bg-cpu-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                Background CPU Spike Threshold
              </label>
              <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {preferences.bgCpuSpikeThresholdPct}%
              </span>
            </div>
            <input
              id="bg-cpu-slider"
              type="range"
              min={5}
              max={60}
              value={preferences.bgCpuSpikeThresholdPct}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  bgCpuSpikeThresholdPct: Number(e.target.value),
                })
              }
              className="mt-2 h-2 w-full cursor-pointer accent-rose-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="bg-drain-slider" className="font-semibold text-slate-700 dark:text-slate-200">
                Background Drain Rate Alert
              </label>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {preferences.bgDrainSpikeMahHr} mAh/h
              </span>
            </div>
            <input
              id="bg-drain-slider"
              type="range"
              min={60}
              max={600}
              step={10}
              value={preferences.bgDrainSpikeMahHr}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  bgDrainSpikeMahHr: Number(e.target.value),
                })
              }
              className="mt-2 h-2 w-full cursor-pointer accent-slate-800 dark:accent-emerald-500"
            />
          </div>
        </div>

        {/* Channel Preferences */}
        <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Notification Channels
          </p>
          {(
            [
              { key: 'resourceSpike', label: 'Background CPU & Wake-Lock Spikes' },
              { key: 'batteryThreshold', label: 'Low Battery Threshold Alerts' },
              { key: 'thermalGuard', label: 'Thermal Envelope Warnings' },
              { key: 'syncStatus', label: 'Encrypted Cloud Sync Notifications' },
            ] as const
          ).map((ch) => (
            <label
              key={ch.key}
              className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">{ch.label}</span>
              <input
                type="checkbox"
                checked={preferences.channels[ch.key]}
                onChange={() => toggleChannel(ch.key)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
          ))}
        </div>

        {/* Triggered Alerts List */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Triggered Threshold Alerts ({activeAlerts.length})
          </p>
          {activeAlerts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No active threshold breaches detected.
            </p>
          ) : (
            activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert
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
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alert.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {alert.processId && (
                    <button
                      type="button"
                      onClick={() => onThrottleAlertProcess(alert.processId!)}
                      className="min-h-[36px] rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600"
                    >
                      Throttle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismissAlert(alert.id)}
                    className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Cross-Device Encrypted Cloud Sync Panel */}
      <section
        aria-label="Encrypted cloud storage sync"
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              AES-256-GCM · PBKDF2 Zero-Knowledge
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Encrypted Cross-Device Cloud Sync
            </h2>
          </div>

          {authReady && (
            user ? (
              <button
                type="button"
                onClick={onSignOutGoogle}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In with Google</span>
              </button>
            )
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-semibold">
                  Connected as {user.displayName || user.email}
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                UID {user.uid.slice(0, 8)}…
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <Cloud className="h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Sign in with Google to sync encrypted threshold profiles, monthly reports, and pinned telecom sites across all your Android devices.
              </span>
            </div>
          )}
        </div>

        {/* Device Metadata + Encryption Key */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="device-label-input" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Device Label
            </label>
            <input
              id="device-label-input"
              type="text"
              maxLength={64}
              value={deviceLabelDraft}
              onChange={(e) => {
                setDeviceLabelDraft(e.target.value);
                onUpdateDeviceLabel(e.target.value, apiLevelDraft);
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="android-api-select" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Android OS Target (Min 8.0)
            </label>
            <select
              id="android-api-select"
              value={apiLevelDraft}
              onChange={(e) => {
                const nextApi = Number(e.target.value);
                setApiLevelDraft(nextApi);
                onUpdateDeviceLabel(deviceLabelDraft, nextApi);
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
            >
              <option value={26}>Android 8.0 Oreo (API 26)</option>
              <option value={28}>Android 9 Pie (API 28)</option>
              <option value={30}>Android 11 (API 30)</option>
              <option value={33}>Android 13 (API 33)</option>
              <option value={34}>Android 14 (API 34)</option>
              <option value={35}>Android 15 (API 35)</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="sync-passphrase-input" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <KeyRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>End-to-End Encryption Passphrase</span>
            </label>
            {keyFingerprint && (
              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                Key FP: {keyFingerprint.slice(0, 12)}…
              </span>
            )}
          </div>
          <input
            id="sync-passphrase-input"
            type="password"
            value={syncPassphrase}
            onChange={(e) => onChangePassphrase(e.target.value)}
            placeholder="Minimum 6 characters for AES-256-GCM encryption"
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Data is encrypted on-device before Firestore upload; ciphertext integrity is verified with SHA-256.
          </p>
        </div>

        <button
          type="button"
          disabled={!user || isSyncing || syncPassphrase.trim().length < 6}
          onClick={onPushEncryptedSync}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          <Lock className="h-4 w-4" />
          <span>{isSyncing ? 'Encrypting & Syncing…' : 'Encrypt & Sync Current State'}</span>
        </button>

        {syncStatusMessage && (
          <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {syncStatusMessage}
          </p>
        )}
        {syncError && (
          <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {syncError}
          </p>
        )}

        {/* Synced Snapshots List */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Synced Cloud Snapshots ({cloudSnapshots.length})
            </p>
          </div>

          {!user ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sign in with Google above to view and decrypt cloud snapshots across devices.
            </p>
          ) : cloudSnapshots.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No encrypted snapshots uploaded yet. Click &ldquo;Encrypt &amp; Sync Current State&rdquo; to create your first cross-device backup.
            </p>
          ) : (
            <ul className="space-y-2">
              {cloudSnapshots.map((snap) => (
                <li
                  key={snap.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {snap.deviceLabel} · API {snap.androidApiLevel}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      {new Date(snap.updatedAtMs).toLocaleString()} · SHA {snap.checksumSha256.slice(0, 10)}…
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRestoreSnapshot(snap)}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Decrypt &amp; Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSnapshot(snap.id)}
                      aria-label={`Delete snapshot ${snap.deviceLabel}`}
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
