/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Key, ShieldCheck, AlertCircle, Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';
import { evaluatePasswordEntropy } from '../services/crypto';
import { signInWithGoogle } from '../services/firebase';
import { User } from 'firebase/auth';

interface VaultLockModalProps {
  isInitialized: boolean;
  onUnlock: (password: string) => Promise<boolean>;
  onInitialize: (password: string) => Promise<void>;
  onSeedDemoData?: (password: string) => Promise<void>;
  errorMessage?: string | null;
  onClearError?: () => void;
  currentUser?: User | null;
}

export const VaultLockModal: React.FC<VaultLockModalProps> = ({
  isInitialized,
  onUnlock,
  onInitialize,
  onSeedDemoData,
  errorMessage,
  onClearError,
  currentUser,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [seedSampleData, setSeedSampleData] = useState(true);

  const entropy = evaluatePasswordEntropy(password);

  const handleGoogleSignInClick = async () => {
    try {
      setIsGoogleAuthLoading(true);
      setLocalError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setLocalError(err?.message || 'Google authentication failed.');
    } finally {
      setIsGoogleAuthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError?.();

    if (!password) {
      setLocalError('Please enter your Vault Master Password.');
      return;
    }

    if (!isInitialized) {
      if (password.length < 8) {
        setLocalError('Master password must be at least 8 characters long for cryptographic security.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isInitialized) {
        const success = await onUnlock(password);
        if (!success) {
          setIsSubmitting(false);
        }
      } else {
        if (seedSampleData && onSeedDemoData) {
          await onSeedDemoData(password);
        } else {
          await onInitialize(password);
        }
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please verify your master key.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div
        id="vault-auth-modal"
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
            {isInitialized ? <Lock className="w-7 h-7" /> : <Key className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isInitialized ? 'Unlock Mind Vault' : 'Create Your Zero-Knowledge Vault'}
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5 max-w-sm">
            {isInitialized
              ? 'Your master password derives an in-memory 256-bit AES-GCM key. Plaintext never touches any server.'
              : 'Set a Master Vault Password. PBKDF2 (100,000 iterations) will derive your client-side encryption key.'}
          </p>
        </div>

        {/* Google Authentication Status / Sign In Button */}
        <div className="mb-5 pb-5 border-b border-neutral-800">
          {currentUser ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full object-cover border border-cyan-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300 text-xs">
                    G
                  </div>
                )}
                <div className="text-left">
                  <span className="text-xs font-semibold text-neutral-200 block truncate max-w-[190px]">
                    {currentUser.displayName || currentUser.email}
                  </span>
                  <span className="text-[10px] text-cyan-400">Authenticated via Google</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-medium">
                Cloud Sync Ready
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isGoogleAuthLoading}
              className="w-full py-2.5 px-4 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-700/60 rounded-xl text-xs font-medium text-neutral-200 transition flex items-center justify-center gap-2.5 shadow-sm"
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
              <span>{isGoogleAuthLoading ? 'Connecting to Google...' : 'Sign in with Google Account'}</span>
            </button>
          )}
        </div>

        {(localError || errorMessage) && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{localError || errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              {isInitialized ? 'Vault Master Password' : 'New Master Password'}
            </label>
            <div className="relative">
              <input
                id="vault-master-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                placeholder={isInitialized ? 'Enter master password...' : 'Minimum 8 characters...'}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono transition"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Entropy Indicator */}
            {!isInitialized && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400">Cryptographic Entropy:</span>
                  <span className={`font-semibold ${entropy.color}`}>{entropy.label}</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      entropy.score < 40
                        ? 'bg-rose-500'
                        : entropy.score < 70
                        ? 'bg-amber-500'
                        : entropy.score < 90
                        ? 'bg-emerald-500'
                        : 'bg-cyan-400'
                    }`}
                    style={{ width: `${entropy.score}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400">{entropy.feedback}</p>
              </div>
            )}
          </div>

          {!isInitialized && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Confirm Master Password
              </label>
              <input
                id="vault-confirm-password-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setLocalError(null);
                }}
                placeholder="Re-enter master password..."
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 focus:border-cyan-500 rounded-xl text-neutral-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono transition"
              />

              <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                <input
                  id="seed-sample-checkbox"
                  type="checkbox"
                  checked={seedSampleData}
                  onChange={(e) => setSeedSampleData(e.target.checked)}
                  className="rounded border-neutral-700 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-neutral-900"
                />
                <label htmlFor="seed-sample-checkbox" className="text-xs text-neutral-300 cursor-pointer select-none">
                  Pre-load sample encrypted journal reflections & knowledge graph
                </label>
              </div>
            </div>
          )}

          <button
            id="vault-auth-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-neutral-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Deriving Key (100,000 PBKDF2 iterations)...</span>
              </>
            ) : isInitialized ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Decrypt & Unlock Vault</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Initialize Zero-Knowledge Vault</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            AES-GCM 256-bit
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Local Embeddings
          </span>
          <span>Zero-Knowledge</span>
        </div>
      </div>
    </div>
  );
};
