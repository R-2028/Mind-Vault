/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EncryptedVaultRecord, VaultMetadata, SecurityAuditLog } from '../types';

const VAULT_META_KEY = 'cognitive_vault_meta_v1';
const VAULT_STORAGE_DB = 'CognitiveVaultDB';
const VAULT_STORE_NAME = 'encrypted_entries';
const AUDIT_LOG_KEY = 'cognitive_vault_audit_logs';

/**
 * Open or upgrade the IndexedDB database for encrypted records.
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(VAULT_STORAGE_DB, 1);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        const store = db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load vault metadata (salt, verification ciphertext) from localStorage.
 */
export function getVaultMetadata(): VaultMetadata | null {
  try {
    const raw = localStorage.getItem(VAULT_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VaultMetadata;
  } catch (err) {
    console.error('Failed to parse vault metadata:', err);
    return null;
  }
}

/**
 * Save vault metadata (master salt + verification ciphertext).
 * Note: Never saves the master password or raw CryptoKey!
 */
export function saveVaultMetadata(meta: VaultMetadata): void {
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
  logSecurityAudit('STORAGE', 'Vault cryptographic metadata initialized & persisted', 'SUCCESS');
}

/**
 * Reset vault metadata and clear all local storage.
 */
export async function destroyLocalVault(): Promise<void> {
  localStorage.removeItem(VAULT_META_KEY);
  localStorage.removeItem(AUDIT_LOG_KEY);

  try {
    const db = await openIndexedDB();
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    store.clear();
  } catch (err) {
    console.warn('IndexedDB clear error during vault destroy:', err);
  }

  logSecurityAudit('STORAGE', 'Emergency zero-knowledge memory wipe & vault database cleared', 'WARN');
}

/**
 * Save an encrypted record to IndexedDB (with fallback to localStorage).
 */
export async function saveEncryptedRecord(record: EncryptedVaultRecord): Promise<void> {
  // Strip any undefined properties for clean payload hygiene
  const sanitizedRecord: EncryptedVaultRecord = JSON.parse(JSON.stringify(record));

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.put(sanitizedRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, fallback to localStorage:', err);
    const existing = getEncryptedRecordsFromLocalStorage();
    const index = existing.findIndex((r) => r.id === sanitizedRecord.id);
    if (index >= 0) {
      existing[index] = sanitizedRecord;
    } else {
      existing.unshift(sanitizedRecord);
    }
    localStorage.setItem(VAULT_STORE_NAME, JSON.stringify(existing));
  }
}

/**
 * Delete an encrypted record by ID.
 */
export async function deleteEncryptedRecord(id: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const existing = getEncryptedRecordsFromLocalStorage().filter((r) => r.id !== id);
    localStorage.setItem(VAULT_STORE_NAME, JSON.stringify(existing));
  }
}

/**
 * Fetch all encrypted records from IndexedDB (or localStorage fallback).
 */
export async function getAllEncryptedRecords(): Promise<EncryptedVaultRecord[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result || []) as EncryptedVaultRecord[];
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read failed, fallback to localStorage:', err);
    return getEncryptedRecordsFromLocalStorage();
  }
}

function getEncryptedRecordsFromLocalStorage(): EncryptedVaultRecord[] {
  try {
    const raw = localStorage.getItem(VAULT_STORE_NAME);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EncryptedVaultRecord[];
    return parsed.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/**
 * Audit Logging Helper
 */
export function logSecurityAudit(
  category: SecurityAuditLog['category'],
  details: string,
  status: SecurityAuditLog['status'] = 'INFO'
): void {
  try {
    const logs = getSecurityAuditLogs();
    const newLog: SecurityAuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: Date.now(),
      event: `${category}_EVENT`,
      category,
      details,
      status,
    };
    logs.unshift(newLog);
    // Keep max 50 recent events
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch {
    // ignore
  }
}

export function getSecurityAuditLogs(): SecurityAuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SecurityAuditLog[];
  } catch {
    return [];
  }
}

/**
 * Export Encrypted Vault as a standalone JSON backup file.
 */
export async function exportVaultBackup(): Promise<string> {
  const metadata = getVaultMetadata();
  const records = await getAllEncryptedRecords();

  const backupPayload = {
    app: 'Cognitive Vault',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    metadata,
    records,
  };

  return JSON.stringify(backupPayload, null, 2);
}

/**
 * Import Encrypted Vault from a JSON backup file.
 */
export async function importVaultBackup(jsonContent: string): Promise<{ count: number }> {
  const parsed = JSON.parse(jsonContent);
  if (!parsed.metadata || !Array.isArray(parsed.records)) {
    throw new Error('Invalid Cognitive Vault backup file format.');
  }

  saveVaultMetadata(parsed.metadata);
  for (const record of parsed.records) {
    await saveEncryptedRecord(record);
  }

  logSecurityAudit('STORAGE', `Imported ${parsed.records.length} encrypted vault items`, 'SUCCESS');
  return { count: parsed.records.length };
}
