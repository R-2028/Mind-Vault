/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  Download,
  Upload,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  Clock,
  Cloud,
  UserCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SecurityAuditLog } from '../types';
import { exportVaultBackup, importVaultBackup, destroyLocalVault } from '../services/storage';
import { signInWithGoogle, signOutUser } from '../services/firebase';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';

interface SecurityAuditTabProps {
  auditLogs: SecurityAuditLog[];
  onLockVault: () => void;
  onRefreshVault: () => Promise<void>;
  currentUser: User | null;
  onSyncWithCloud?: () => Promise<void>;
}

export const SecurityAuditTab: React.FC<SecurityAuditTabProps> = ({
  auditLogs,
  onLockVault,
  onRefreshVault,
  currentUser,
  onSyncWithCloud,
}) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [showHardenedRules, setShowHardenedRules] = useState(false);
  const [confirmWipeModal, setConfirmWipeModal] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const handleExport = async () => {
    try {
      const dataStr = await exportVaultBackup();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mind-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err?.message);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importVaultBackup(text);
      setImportStatus(`Successfully restored ${result.count} encrypted records to vault!`);
      await onRefreshVault();
    } catch (err: any) {
      setImportStatus(`Import failed: ${err?.message}`);
    }
  };

  const handleExecuteWipe = async () => {
    await destroyLocalVault();
    onLockVault();
    window.location.reload();
  };

  const handleCloudSyncClick = async () => {
    if (!onSyncWithCloud) return;
    try {
      setIsCloudSyncing(true);
      await onSyncWithCloud();
      setImportStatus('Encrypted vault state successfully synced with Firestore!');
    } catch (err: any) {
      setImportStatus('Cloud sync failed: ' + err?.message);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const threatMatrix = [
    {
      zone: '1. Input Surfaces',
      risk: 'Malicious prompt injection or malicious text uploads',
      countermeasure: 'Strict JSON schema parsing with Gemini Type validation; plain text sanitization prior to synthesis.',
    },
    {
      zone: '2. Planning & Reasoning',
      risk: 'Indirect prompt instructions hijacking model execution',
      countermeasure: 'Isolated ephemeral system instructions enforcing strict structured entity/summary schema.',
    },
    {
      zone: '3. Tool Execution',
      risk: 'Privilege escalation or unauthorized token leakage',
      countermeasure: 'Server-side API keys hidden behind Express proxy; no browser-exposed API tokens.',
    },
    {
      zone: '4. Memory & State',
      risk: 'Cross-user data exposure or database breach',
      countermeasure: 'Zero-Knowledge 256-bit AES-GCM encryption with 100k PBKDF2 iterations; plaintext decrypted in ephemeral RAM only.',
    },
    {
      zone: '5. Inter-System Comms',
      risk: 'Plaintext data leakage to third parties or intermediate logs',
      countermeasure: 'Local in-browser vector embeddings (all-MiniLM-L6-v2) for semantic search without cloud transmission.',
    },
  ];

  const hardenedFirestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.admin == true ||
        request.auth.token.role == 'admin' ||
        (exists(/databases/$(database)/documents/roles/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/roles/$(request.auth.uid)).data.role == 'admin')
      );
    }

    // User data isolation: ONLY owner can read/write
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      // ZERO-KNOWLEDGE: Admins CANNOT read decrypted ciphertext or private records
      match /encrypted_vault/{recordId} {
        allow read, write: if isOwner(userId);
      }
    }

    // Admin-only non-sensitive system stats & sanitized webhook logs
    match /admin_metrics/{metricId} { allow read, write: if isAdmin(); }
    match /admin_notification_logs/{logId} { allow read, write: if isAdmin(); }
    match /{document=**} { allow read, write: if false; }
  }
}`;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-7 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Security Architecture & Cryptographic Audit
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Zero-knowledge client-side encryption guarantees only you hold the keys to your second brain.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLockVault}
              className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-xl text-xs font-semibold transition"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Lock & Purge Key</span>
            </button>
          </div>
        </div>

        {/* Cryptographic Specifications */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-xs text-neutral-400 block mb-1">Key Derivation</span>
            <span className="text-sm font-bold text-cyan-300">PBKDF2 (SHA-256)</span>
            <p className="text-[11px] text-neutral-500 mt-1">100,000 computation rounds with 16-byte random salt.</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-xs text-neutral-400 block mb-1">Symmetric Cipher</span>
            <span className="text-sm font-bold text-cyan-300">AES-GCM 256-bit</span>
            <p className="text-[11px] text-neutral-500 mt-1">Authenticated payload with 12-byte unique initialization vector.</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-xs text-neutral-400 block mb-1">Federated Identity & Sync</span>
            <span className="text-sm font-bold text-cyan-300">Google Auth + Firestore</span>
            <p className="text-[11px] text-neutral-500 mt-1">Owner-isolated paths with zero plaintext stored in cloud.</p>
          </div>
        </div>
      </section>

      {/* Google Authentication & Cloud Sync Section */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Cloud className="w-4 h-4 text-cyan-400" />
          Google Authentication & Encrypted Firestore Sync
        </h3>
        <p className="text-xs text-neutral-400">
          When signed in, your zero-knowledge ciphertext is synced to your isolated Firestore account. Even Google cannot read your encrypted journals without your master password.
        </p>

        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-10 h-10 rounded-full object-cover border border-cyan-500"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300 font-bold text-sm">
                  G
                </div>
              )}
              <div>
                <span className="text-sm font-bold text-neutral-200 block">
                  {currentUser.displayName || 'Authenticated User'}
                </span>
                <span className="text-xs text-neutral-400 font-mono block">
                  {currentUser.email} • UID: {currentUser.uid.slice(0, 10)}...
                </span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-xs font-semibold text-neutral-300 block mb-0.5">
                No Google Account Connected
              </span>
              <span className="text-[11px] text-neutral-500">
                Operating in offline-first IndexedDB mode. Sign in to enable cross-device cloud sync.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                <button
                  onClick={handleCloudSyncClick}
                  disabled={isCloudSyncing}
                  className="flex items-center gap-2 px-3.5 py-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded-xl text-xs font-semibold transition"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{isCloudSyncing ? 'Syncing...' : 'Force Cloud Sync'}</span>
                </button>
                <button
                  onClick={() => signOutUser()}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Connect Google Account</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Agentic Threat Modeling Matrix */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Agentic Threat Modeling & Countermeasure Mapping (5 Threat Zones)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="py-2.5 px-3 font-semibold">Threat Zone</th>
                <th className="py-2.5 px-3 font-semibold">Identified Risk Profile</th>
                <th className="py-2.5 px-3 font-semibold">Architectural Countermeasure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {threatMatrix.map((t, idx) => (
                <tr key={idx} className="hover:bg-neutral-950/40 transition">
                  <td className="py-3 px-3 font-bold text-cyan-400 whitespace-nowrap">{t.zone}</td>
                  <td className="py-3 px-3 text-neutral-300">{t.risk}</td>
                  <td className="py-3 px-3 text-neutral-400">{t.countermeasure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Vault Backup, Export & Restore */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Vault Backup, Data Portability & Local Storage
        </h3>
        <p className="text-xs text-neutral-400">
          Your backup files remain fully ciphertext-encrypted. No one without your master password can read them.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-950 border border-neutral-800 hover:border-cyan-700 hover:text-cyan-300 text-neutral-200 rounded-xl text-xs font-semibold transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Encrypted Vault (.json)</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-neutral-950 border border-neutral-800 hover:border-cyan-700 hover:text-cyan-300 text-neutral-200 rounded-xl text-xs font-semibold transition cursor-pointer">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Import Encrypted Vault</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowHardenedRules(!showHardenedRules)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-xl text-xs font-semibold transition"
          >
            <FileCode className="w-4 h-4" />
            <span>{showHardenedRules ? 'Hide' : 'View'} Firestore Security Rules</span>
          </button>
        </div>

        {importStatus && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs">
            {importStatus}
          </div>
        )}

        {showHardenedRules && (
          <div className="mt-3 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <span className="text-xs font-bold text-neutral-300 block mb-2 font-mono">
              firestore.rules (Hardened Owner-Bound Isolation):
            </span>
            <pre className="text-[11px] font-mono text-cyan-300/90 leading-relaxed overflow-x-auto whitespace-pre">
              {hardenedFirestoreRules}
            </pre>
          </div>
        )}
      </section>

      {/* External Notification Integrations Panel */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl">
        <NotificationSettingsPanel />
      </section>

      {/* Security Audit Log Activity Table */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          Real-Time In-Memory Security Audit Logs ({auditLogs.length})
        </h3>
        <p className="text-xs text-neutral-400">
          All cryptographic operations, key derivations, and storage sync events are logged for full transparency.
        </p>

        <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950/80">
          {auditLogs.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">No logs recorded yet.</div>
          ) : (
            <div className="divide-y divide-neutral-900 text-xs font-mono">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-cyan-300">
                      {log.category}
                    </span>
                    <span className="text-neutral-300">{log.details}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Emergency Vault Wipe
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Permanently wipe all encrypted records, key salts, and credentials from local storage.
            </p>
          </div>

          <button
            onClick={() => setConfirmWipeModal(true)}
            className="px-4 py-2 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-xl text-xs font-bold transition border border-rose-700"
          >
            Wipe Entire Vault
          </button>
        </div>

        {confirmWipeModal && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-700 text-xs space-y-3">
            <p className="text-rose-200 font-semibold">
              Are you absolutely sure? This action is irreversible and will delete all encrypted journals and knowledge nodes on this device.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecuteWipe}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs"
              >
                Yes, Destroy Vault Data
              </button>
              <button
                onClick={() => setConfirmWipeModal(false)}
                className="px-3 py-1.5 bg-neutral-800 text-neutral-300 hover:text-white rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
