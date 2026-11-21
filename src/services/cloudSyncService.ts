import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type { SyncSnapshotPayload } from '../types/voltguard.ts';
import {
  decryptSyncPayload,
  deriveKeyFingerprint,
  encryptSyncPayload,
  MAX_CIPHERTEXT_LENGTH,
} from '../utils/cryptoSync.ts';

export interface CloudSnapshotMetadata {
  id: string;
  deviceId: string;
  deviceLabel: string;
  androidApiLevel: number;
  recordType: 'preferences' | 'monthly_report' | 'pinned_sites' | 'telemetry_bundle';
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
  checksumSha256: string;
  updatedAtMs: number;
}

function sanitizeId(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  return cleaned.length >= 3 ? cleaned : fallback;
}

function clampApiLevel(apiLevel: number): number {
  const rounded = Math.round(apiLevel);
  return Math.min(36, Math.max(26, rounded));
}

export async function ensureUserSyncProfile(
  uid: string,
  deviceId: string,
  passphrase: string,
): Promise<void> {
  const cleanUid = sanitizeId(uid, uid);
  const cleanDeviceId = sanitizeId(deviceId, 'android-oreo-primary');
  const keyFingerprint = await deriveKeyFingerprint(passphrase);
  const profilePath = `users/${cleanUid}`;
  const profileRef = doc(db, 'users', cleanUid);

  try {
    const existing = await getDoc(profileRef);
    if (!existing.exists()) {
      await setDoc(profileRef, {
        uid: cleanUid,
        deviceCount: 1,
        activeDeviceId: cleanDeviceId,
        keyFingerprint,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        activeDeviceId: cleanDeviceId,
        keyFingerprint,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function pushEncryptedSnapshot(
  uid: string,
  payload: SyncSnapshotPayload,
  passphrase: string,
  snapshotId: string = 'primary-sync-bundle',
): Promise<void> {
  const cleanSnapshotId = sanitizeId(snapshotId, 'primary-sync-bundle');
  const cleanDeviceId = sanitizeId(payload.deviceId, 'android-oreo-primary');
  const cleanLabel = (payload.deviceLabel.trim() || 'Android Device').slice(0, 64);
  const cleanApiLevel = clampApiLevel(payload.androidApiLevel);

  await ensureUserSyncProfile(uid, cleanDeviceId, passphrase);

  const plaintext = JSON.stringify(payload);
  const encrypted = await encryptSyncPayload(plaintext, passphrase);

  if (encrypted.ciphertextBase64.length > MAX_CIPHERTEXT_LENGTH) {
    throw new Error('Sync bundle exceeds 100KB cloud encryption limit.');
  }

  const snapPath = `users/${uid}/encryptedSnapshots/${cleanSnapshotId}`;
  const snapRef = doc(db, 'users', uid, 'encryptedSnapshots', cleanSnapshotId);

  try {
    const existing = await getDoc(snapRef);
    if (!existing.exists()) {
      await setDoc(snapRef, {
        ownerId: uid,
        deviceId: cleanDeviceId,
        deviceLabel: cleanLabel,
        androidApiLevel: cleanApiLevel,
        recordType: 'telemetry_bundle',
        ivBase64: encrypted.ivBase64,
        saltBase64: encrypted.saltBase64,
        ciphertextBase64: encrypted.ciphertextBase64,
        checksumSha256: encrypted.checksumSha256,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(snapRef, {
        deviceId: cleanDeviceId,
        deviceLabel: cleanLabel,
        androidApiLevel: cleanApiLevel,
        recordType: 'telemetry_bundle',
        ivBase64: encrypted.ivBase64,
        saltBase64: encrypted.saltBase64,
        ciphertextBase64: encrypted.ciphertextBase64,
        checksumSha256: encrypted.checksumSha256,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, snapPath);
  }
}

export function subscribeEncryptedSnapshots(
  uid: string,
  onData: (records: CloudSnapshotMetadata[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const listPath = `users/${uid}/encryptedSnapshots`;
  const q = query(
    collection(db, 'users', uid, 'encryptedSnapshots'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: CloudSnapshotMetadata[] = snapshot.docs.map((d) => {
        const data = d.data();
        const ts = data.updatedAt as { toMillis?: () => number } | undefined;
        return {
          id: d.id,
          deviceId: String(data.deviceId ?? ''),
          deviceLabel: String(data.deviceLabel ?? 'Android Device'),
          androidApiLevel: Number(data.androidApiLevel ?? 26),
          recordType: (data.recordType ?? 'telemetry_bundle') as CloudSnapshotMetadata['recordType'],
          ivBase64: String(data.ivBase64 ?? ''),
          saltBase64: String(data.saltBase64 ?? ''),
          ciphertextBase64: String(data.ciphertextBase64 ?? ''),
          checksumSha256: String(data.checksumSha256 ?? ''),
          updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, listPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    },
  );
}

export async function decryptSnapshotRecord(
  record: CloudSnapshotMetadata,
  passphrase: string,
): Promise<SyncSnapshotPayload> {
  const plaintext = await decryptSyncPayload(
    {
      ivBase64: record.ivBase64,
      saltBase64: record.saltBase64,
      ciphertextBase64: record.ciphertextBase64,
      checksumSha256: record.checksumSha256,
    },
    passphrase,
  );
  return JSON.parse(plaintext) as SyncSnapshotPayload;
}

export async function deleteEncryptedSnapshot(uid: string, snapshotId: string): Promise<void> {
  const cleanId = sanitizeId(snapshotId, snapshotId);
  const path = `users/${uid}/encryptedSnapshots/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'encryptedSnapshots', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
