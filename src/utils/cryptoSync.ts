export interface EncryptedSyncEnvelope {
  ivBase64: string;
  saltBase64: string;
  ciphertextBase64: string;
  checksumSha256: string;
}

export const MAX_CIPHERTEXT_LENGTH = 100_000;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function getSubtleCrypto(): SubtleCrypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return cryptoObj.subtle;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveKeyFingerprint(passphrase: string): Promise<string> {
  if (!passphrase || passphrase.trim().length < 6) {
    throw new Error('Sync passphrase must be at least 6 characters.');
  }
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`voltguard-key-fp:${passphrase.trim()}`),
  );
  return toHex(digest);
}

export async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(digest);
}

export async function encryptSyncPayload(
  plaintextJson: string,
  passphrase: string,
): Promise<EncryptedSyncEnvelope> {
  if (!passphrase || passphrase.trim().length < 6) {
    throw new Error('Sync passphrase must be at least 6 characters.');
  }
  const subtle = getSubtleCrypto();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase.trim(), salt);

  const encryptedBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintextJson),
  );

  const ciphertextBase64 = bytesToBase64(new Uint8Array(encryptedBuf));
  if (ciphertextBase64.length > MAX_CIPHERTEXT_LENGTH) {
    throw new Error('Encrypted payload exceeds Firestore 100KB snapshot boundary.');
  }

  const checksumSha256 = await sha256Hex(ciphertextBase64);

  return {
    ivBase64: bytesToBase64(iv),
    saltBase64: bytesToBase64(salt),
    ciphertextBase64,
    checksumSha256,
  };
}

export async function decryptSyncPayload(
  envelope: EncryptedSyncEnvelope,
  passphrase: string,
): Promise<string> {
  if (!passphrase || passphrase.trim().length < 6) {
    throw new Error('Sync passphrase must be at least 6 characters.');
  }
  const actualChecksum = await sha256Hex(envelope.ciphertextBase64);
  if (actualChecksum !== envelope.checksumSha256) {
    throw new Error('Encrypted payload integrity checksum mismatch.');
  }

  const subtle = getSubtleCrypto();
  const salt = base64ToBytes(envelope.saltBase64);
  const iv = base64ToBytes(envelope.ivBase64);
  const ciphertext = base64ToBytes(envelope.ciphertextBase64);
  const key = await deriveAesKey(passphrase.trim(), salt);

  const decryptedBuf = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer,
    },
    key,
    ciphertext.buffer.slice(
      ciphertext.byteOffset,
      ciphertext.byteOffset + ciphertext.byteLength,
    ) as ArrayBuffer,
  );

  return new TextDecoder().decode(decryptedBuf);
}
