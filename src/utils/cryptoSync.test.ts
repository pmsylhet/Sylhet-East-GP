import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSyncPayload,
  deriveKeyFingerprint,
  encryptSyncPayload,
} from './cryptoSync.ts';

test('AES-256-GCM encryptSyncPayload and decryptSyncPayload roundtrip cleanly', async () => {
  const payload = JSON.stringify({
    autoOptimize: true,
    lowBatteryThresholdPct: 20,
    pinnedSiteNames: ['SYADB1', 'SNDOA1'],
  });
  const passphrase = 'voltguard-sync-secret';

  const encrypted = await encryptSyncPayload(payload, passphrase);
  assert.equal(encrypted.checksumSha256.length, 64);
  assert.ok(encrypted.ciphertextBase64.length > 10);
  assert.ok(!encrypted.ciphertextBase64.includes('SYADB1'));

  const decrypted = await decryptSyncPayload(encrypted, passphrase);
  assert.equal(decrypted, payload);

  const fp1 = await deriveKeyFingerprint(passphrase);
  const fp2 = await deriveKeyFingerprint(passphrase);
  assert.equal(fp1, fp2);
  assert.equal(fp1.length, 64);
});

test('decryptSyncPayload rejects tampered checksum or wrong passphrase', async () => {
  const encrypted = await encryptSyncPayload('{"ok":true}', 'correct-passphrase');
  await assert.rejects(() => decryptSyncPayload(encrypted, 'wrong-passphrase'));
  await assert.rejects(() =>
    decryptSyncPayload({ ...encrypted, checksumSha256: '0'.repeat(64) }, 'correct-passphrase'),
  );
});
