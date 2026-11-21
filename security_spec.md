# VoltGuard Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership**: A `UserSyncProfile` at `/users/{userId}` can only be read, created, or updated by the verified authenticated user whose `request.auth.uid == userId`.
2. **Master Gate on Snapshots**: An `EncryptedSyncRecord` at `/users/{userId}/encryptedSnapshots/{snapshotId}` cannot exist without a valid parent `/users/{userId}` document whose `uid == request.auth.uid`.
3. **Zero PII Exposure**: `email`, `phone`, and physical `address` fields are never persisted in Firestore user documents; only opaque AES-256-GCM ciphertexts and non-identifying device sync metadata are stored.
4. **Immutable Ownership & Creation Time**: `uid`, `ownerId`, and `createdAt` can never change after creation, and `createdAt`/`updatedAt` must strictly equal `request.time`.
5. **Bounded Payloads**: All IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), `androidApiLevel` is bounded to `26..36` (Android 8.0+), and `ciphertextBase64` is capped at `100000` chars to prevent resource exhaustion.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. Unauthenticated read of `/users/u1` or `/users/u1/encryptedSnapshots/s1`.
2. Verified user `u2` attempting `get` or `list` on `/users/u1/encryptedSnapshots`.
3. User `u1` with `email_verified == false` attempting to create `/users/u1`.
4. User `u1` creating `/users/u1` with spoofed `uid: "u2"`.
5. User `u1` creating `/users/u1` with an extra shadow field `isAdmin: true`.
6. User `u1` creating `/users/u1/encryptedSnapshots/bad$id` (invalid path variable).
7. User `u1` creating an encrypted snapshot when parent `/users/u1` does not exist.
8. User `u1` creating a snapshot with `androidApiLevel: 21` (below Android 8.0 API 26 minimum).
9. User `u1` creating a snapshot with client-spoofed `createdAt` timestamp != `request.time`.
10. User `u1` updating a snapshot and changing `ownerId` or `createdAt`.
11. User `u1` updating a snapshot with invalid `recordType: "arbitrary_blob"` or `ciphertextBase64` > 100KB.
12. Any client attempting to read or write an undeclared collection path `/admin/config`.
