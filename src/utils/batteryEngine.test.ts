import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDrainHistory,
  computeOptimizationPlan,
  DEFAULT_ALERT_PREFERENCES,
  evaluateThresholdAlerts,
  formatDurationMinutes,
  generateMonthlyReports,
  INITIAL_BACKGROUND_PROCESSES,
  isAndroidVersionSupported,
  sanitizeAlertPreferences,
} from './batteryEngine.ts';
import type { BatteryTelemetry } from '../types/voltguard.ts';

test('Android 8.0 (API 26) minimum version check', () => {
  assert.equal(isAndroidVersionSupported(25), false);
  assert.equal(isAndroidVersionSupported(26), true);
  assert.equal(isAndroidVersionSupported(34), true);
});

test('computeOptimizationPlan throttles high-drain non-essential processes and preserves essential ones', () => {
  const result = computeOptimizationPlan(INITIAL_BACKGROUND_PROCESSES, true, 4800, 65);
  assert.ok(result.throttledCount >= 2);
  assert.ok(result.savedMahPerHr > 0);
  assert.ok(result.projectedExtraMinutes > 0);

  const essential = result.processes.find((p) => p.isEssential);
  assert.ok(essential);
  assert.equal(essential.status, 'active');

  const throttled = result.processes.find((p) => p.id === 'proc-maps-sync');
  assert.equal(throttled?.status, 'throttled');
});

test('evaluateThresholdAlerts fires battery, thermal, and background CPU alerts when thresholds crossed', () => {
  const telemetry: BatteryTelemetry = {
    levelPct: 16,
    isCharging: false,
    chargingMinutesRemaining: null,
    estimatedMinutesRemaining: 140,
    temperatureC: 41.2,
    voltageMv: 3780,
    currentDrawMa: 520,
    screenOnPct: 38,
    backgroundDrainPct: 34,
    activeWakeLocks: 5,
    selfCpuOverheadPct: 0.3,
    sourceMode: 'calibrated',
    lastUpdatedIso: '2026-11-20T12:00:00.000Z',
  };

  const alerts = evaluateThresholdAlerts(
    telemetry,
    INITIAL_BACKGROUND_PROCESSES,
    DEFAULT_ALERT_PREFERENCES,
    '2026-11-20T12:00:00.000Z',
  );

  const categories = alerts.map((a) => a.category);
  assert.ok(categories.includes('battery'));
  assert.ok(categories.includes('thermal'));
  assert.ok(categories.includes('background_cpu'));
});

test('buildDrainHistory produces 24h, 7d, and 30d series with lower rates when optimized', () => {
  const unopt = buildDrainHistory('24h', false, 64);
  const opt = buildDrainHistory('24h', true, 64);
  assert.equal(unopt.length, 9);
  assert.equal(opt.length, 9);
  assert.ok(opt[3].drainRatePctHr < unopt[3].drainRatePctHr);

  const atFull = buildDrainHistory('24h', true, 100);
  const minLvl = Math.min(...atFull.map((p) => p.batteryLevelPct));
  assert.ok(minLvl < 90);
  assert.equal(atFull[atFull.length - 1].batteryLevelPct, 100);

  assert.equal(buildDrainHistory('7d', true, 64).length, 7);
  assert.equal(buildDrainHistory('30d', true, 64).length, 5);
});

test('generateMonthlyReports and sanitizeAlertPreferences clamp bounds safely', () => {
  const reports = generateMonthlyReports(true, 3);
  assert.equal(reports.length, 3);
  assert.ok(reports[0].totalSavedMah > 3000);

  const clean = sanitizeAlertPreferences({
    ...DEFAULT_ALERT_PREFERENCES,
    lowBatteryThresholdPct: 2,
    highTempThresholdC: 99,
  });
  assert.equal(clean.lowBatteryThresholdPct, 5);
  assert.equal(clean.highTempThresholdC, 48);
  assert.equal(formatDurationMinutes(125), '2h 05m');
});
