/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Utility functions for ArrayBuffer <-> Base64 / Hex conversions
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH = 256;
const VERIFICATION_PAYLOAD = 'COGNITIVE_VAULT_VALIDATION_TOKEN_v1';

/**
 * Derives a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2 (100,000 iterations, SHA-256).
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import raw password as key material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false, // Key cannot be extracted from browser memory
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Generates a cryptographically secure random salt (16 bytes)
 */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generates a cryptographically secure random IV (12 bytes for AES-GCM)
 */
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Encrypts an arbitrary serializable object or string with an AES-GCM CryptoKey.
 */
export async function encryptData<T>(
  data: T,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string; salt?: string }> {
  const encoder = new TextEncoder();
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const encodedPlaintext = encoder.encode(jsonString);

  const iv = generateIV();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedPlaintext
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypts an AES-GCM ciphertext using the provided CryptoKey and IV.
 */
export async function decryptData<T = any>(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<T> {
  const ciphertextBytes = base64ToBuffer(ciphertextBase64);
  const ivBytes = base64ToBuffer(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return jsonString as unknown as T;
  }
}

/**
 * Creates vault initialization metadata with a master salt and verification ciphertext.
 */
export async function initializeVaultMetadata(password: string): Promise<{
  masterSalt: string;
  verificationCiphertext: string;
  verificationIv: string;
  key: CryptoKey;
}> {
  const masterSalt = generateSalt();
  const key = await deriveKeyFromPassword(password, masterSalt);
  const { ciphertext, iv } = await encryptData(VERIFICATION_PAYLOAD, key);

  return {
    masterSalt: bufferToBase64(masterSalt),
    verificationCiphertext: ciphertext,
    verificationIv: iv,
    key,
  };
}

/**
 * Validates a candidate password against the vault verification ciphertext.
 */
export async function verifyAndUnlockVault(
  password: string,
  masterSaltBase64: string,
  verificationCiphertext: string,
  verificationIv: string
): Promise<{ success: boolean; key?: CryptoKey; error?: string }> {
  try {
    const salt = base64ToBuffer(masterSaltBase64);
    const candidateKey = await deriveKeyFromPassword(password, salt);
    const decryptedToken = await decryptData<string>(
      verificationCiphertext,
      verificationIv,
      candidateKey
    );

    if (decryptedToken === VERIFICATION_PAYLOAD) {
      return { success: true, key: candidateKey };
    }
    return { success: false, error: 'Incorrect master password. Please verify and try again.' };
  } catch (err) {
    return {
      success: false,
      error: 'Decryption failed: Key mismatch or corrupted vault signature.',
    };
  }
}

/**
 * Calculates password entropy score (0 to 100) and security rating.
 */
export function evaluatePasswordEntropy(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Strong' | 'Unbreakable';
  color: string;
  feedback: string;
} {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'text-rose-500', feedback: 'Enter a master password' };
  }

  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 20;
  if (password.length >= 16) score += 15;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  if (score < 40) {
    return { score, label: 'Weak', color: 'text-rose-400', feedback: 'Use at least 10 chars with mixed case & numbers' };
  } else if (score < 70) {
    return { score, label: 'Fair', color: 'text-amber-400', feedback: 'Good start. Add symbols or lengthen for optimal zero-knowledge defense' };
  } else if (score < 90) {
    return { score, label: 'Strong', color: 'text-emerald-400', feedback: 'Strong cryptographic entropy for AES-256 derivation' };
  } else {
    return { score: 100, label: 'Unbreakable', color: 'text-cyan-400', feedback: 'Maximum entropy: resilient against GPU brute-force derivation' };
  }
}
