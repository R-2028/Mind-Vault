/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Brain,
  PenTool,
  Search,
  CheckCircle2,
  Share2,
  Shield,
  Lock,
  Cloud,
  LogOut,
  User as UserIcon,
  ShieldAlert,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { signInWithGoogle, signOutUser } from '../services/firebase';

export type ActiveTab = 'reflection' | 'search' | 'actions' | 'graph' | 'security' | 'admin';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingActionsCount: number;
  graphNodesCount: number;
  totalEntriesCount: number;
  onLockVault: () => void;
  currentUser: User | null;
  isAdmin?: boolean;
  onUserAuthChange?: (user: User | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingActionsCount,
  graphNodesCount,
  totalEntriesCount,
  onLockVault,
  currentUser,
  isAdmin = false,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleAuth = async () => {
    if (currentUser) {
      await signOutUser();
    } else {
      try {
        setIsSigningIn(true);
        await signInWithGoogle();
      } catch (err: any) {
        console.error('Google Sign-In failed:', err);
      } finally {
        setIsSigningIn(false);
      }
    }
  };

  const tabs = [
    {
      id: 'reflection' as ActiveTab,
      label: 'Daily Reflection',
      icon: PenTool,
      badge: totalEntriesCount > 0 ? `${totalEntriesCount}` : null,
    },
    {
      id: 'search' as ActiveTab,
      label: 'Past Self Search',
      icon: Search,
    },
    {
      id: 'actions' as ActiveTab,
      label: 'Morning Micro-Actions',
      icon: CheckCircle2,
      badge: pendingActionsCount > 0 ? `${pendingActionsCount}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'graph' as ActiveTab,
      label: 'Knowledge Graph',
      icon: Share2,
      badge: graphNodesCount > 0 ? `${graphNodesCount} nodes` : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'security' as ActiveTab,
      label: 'Security & Vault',
      icon: Shield,
    },
    {
      id: 'admin' as ActiveTab,
      label: 'RBAC & Admin',
      icon: ShieldAlert,
      badge: isAdmin ? 'Admin' : null,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-950/50">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center text-cyan-400">
                <Brain className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Mind Vault</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Zero-Knowledge
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                Client-Side Encrypted AI Second Brain
              </p>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/60'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-neutral-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold border ${
                        tab.badgeColor || 'bg-neutral-700 text-neutral-200 border-neutral-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Area: Google Sign-In & Lock Vault */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Google Sign-In / Account Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover border border-cyan-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300 text-[10px]">
                    <UserIcon className="w-3 h-3" />
                  </div>
                )}
                <span className="text-xs text-neutral-300 max-w-[100px] truncate hidden sm:inline">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  onClick={handleGoogleAuth}
                  title="Sign Out of Google Account"
                  className="text-neutral-400 hover:text-rose-400 p-0.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="google-signin-header-btn"
                onClick={handleGoogleAuth}
                disabled={isSigningIn}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-200 bg-neutral-900 border border-neutral-800 hover:border-cyan-700 hover:text-cyan-300 transition"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                <span className="hidden sm:inline">
                  {isSigningIn ? 'Connecting...' : 'Sign In with Google'}
                </span>
                <span className="sm:hidden">Sign In</span>
              </button>
            )}

            {/* Lock Vault */}
            <button
              id="lock-vault-btn"
              onClick={onLockVault}
              title="Immediately wipe AES-GCM key and decrypted records from memory"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 bg-neutral-900 border border-neutral-800 hover:bg-rose-950/40 hover:border-rose-800/60 hover:text-rose-300 transition"
            >
              <Lock className="w-3.5 h-3.5 text-neutral-400 group-hover:text-rose-400" />
              <span className="hidden sm:inline">Lock Vault</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Navigation Bar */}
        <div className="md:hidden flex items-center justify-between overflow-x-auto py-2 gap-1 border-t border-neutral-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap font-medium transition ${
                  isActive
                    ? 'bg-neutral-800 text-cyan-300 border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label.split(' ')[0]}</span>
                {tab.badge && (
                  <span className="text-[9px] px-1 bg-neutral-700 rounded-full">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
