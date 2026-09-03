/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header, ActiveTab } from './components/Header';
import { VaultLockModal } from './components/VaultLockModal';
import { DailyReflectionTab } from './components/DailyReflectionTab';
import { PastSelfSearchTab } from './components/PastSelfSearchTab';
import { MorningActionsTab } from './components/MorningActionsTab';
import { KnowledgeGraphTab } from './components/KnowledgeGraphTab';
import { SecurityAuditTab } from './components/SecurityAuditTab';
import { AdminDashboard } from './components/AdminDashboard';
import { NeuralManifoldBackground } from './components/NeuralManifoldBackground';
import {
  deriveKeyFromPassword,
  initializeVaultMetadata,
  verifyAndUnlockVault,
  encryptData,
  decryptData,
  base64ToBuffer,
  bufferToBase64,
} from './services/crypto';
import {
  getVaultMetadata,
  saveVaultMetadata,
  getAllEncryptedRecords,
  saveEncryptedRecord,
  deleteEncryptedRecord,
  getSecurityAuditLogs,
  logSecurityAudit,
} from './services/storage';
import { getNotificationPreferences } from './services/notifications';
import {
  auth,
  syncVaultMetadataToCloud,
  syncEncryptedRecordToCloud,
  deleteEncryptedRecordFromCloud,
  fetchAllEncryptedRecordsFromCloud,
  checkAdminClaims,
} from './services/firebase';
import { generateTextEmbedding, initEmbeddingPipeline } from './services/embeddings';
import {
  DecryptedEntry,
  EncryptedVaultRecord,
  VaultMetadata,
  MicroAction,
  SecurityAuditLog,
  AIAnalysisResult,
  GeolocationData,
} from './types';

// Sample Seed Entries for rich demonstration
const SEED_ENTRIES = [
  {
    plaintext:
      'Completed the client-side zero-knowledge encryption architecture today. Derived 256-bit AES-GCM keys with 100,000 PBKDF2 iterations so the server never sees plaintext. Feeling great focus and flow state, though late afternoon fatigue started creeping in after 4 hours of intense debugging.',
    tone: 'Strategic',
    tags: ['cryptography', 'architecture', 'focus'],
    formattedDate: 'Yesterday, 8:45 PM',
    aiInsight: {
      summary:
        'You made breakthrough progress implementing the zero-knowledge crypto engine, showing exceptional technical mastery. Be mindful of fatigue cues when coding in deep flow sessions.',
      micro_actions: [
        {
          task: 'Take a 10-minute sunlight walk before writing cryptographic tests tomorrow morning.',
          friction_level: 'Micro' as const,
        },
        {
          task: 'Review vector pipeline memory footprints on initial cold boot.',
          friction_level: 'Low' as const,
        },
      ],
      graph_nodes: [
        { id: 'project-cognitive-vault', label: 'Cognitive Vault', type: 'Project' as const },
        { id: 'tech-webcrypto', label: 'Web Crypto API (AES-GCM)', type: 'Tech' as const },
        { id: 'mood-deep-flow', label: 'Deep Flow & Focus', type: 'Mood' as const },
        { id: 'habit-morning-walk', label: 'Morning Sunlight Walk', type: 'Habit' as const },
        { id: 'skill-crypto', label: 'Zero-Knowledge Cryptography', type: 'Skill' as const },
      ],
      graph_edges: [
        { source: 'tech-webcrypto', target: 'project-cognitive-vault', relationship: 'secures' },
        { source: 'project-cognitive-vault', target: 'mood-deep-flow', relationship: 'cultivates' },
        { source: 'skill-crypto', target: 'tech-webcrypto', relationship: 'empowers' },
        { source: 'habit-morning-walk', target: 'mood-deep-flow', relationship: 'amplifies' },
      ],
    },
  },
  {
    plaintext:
      'Had an insightful sync with Elena regarding in-browser vector search using transformers.js. We discussed running all-MiniLM-L6-v2 directly in WebAssembly so user journal memories can be matched semantically without relying on external vector databases. Feeling energized by privacy-first AI possibilities.',
    tone: 'Grounded',
    tags: ['ai', 'transformers', 'collaboration'],
    formattedDate: '2 days ago, 6:15 PM',
    aiInsight: {
      summary:
        'Your collaboration with Elena sparked exciting momentum on client-side embedding models. Grounding AI in local-first hardware aligns deeply with your core privacy values.',
      micro_actions: [
        {
          task: 'Outline cosine similarity threshold test cases for edge-case query matching.',
          friction_level: 'Low' as const,
        },
      ],
      graph_nodes: [
        { id: 'person-elena', label: 'Elena (AI Research)', type: 'Person' as const },
        { id: 'tech-transformers-js', label: 'Transformers.js (MiniLM)', type: 'Tech' as const },
        { id: 'project-cognitive-vault', label: 'Cognitive Vault', type: 'Project' as const },
        { id: 'mood-energized', label: 'Energized & Inspired', type: 'Mood' as const },
      ],
      graph_edges: [
        { source: 'person-elena', target: 'tech-transformers-js', relationship: 'collaborates_on' },
        { source: 'tech-transformers-js', target: 'mood-energized', relationship: 'inspires' },
      ],
    },
  },
  {
    plaintext:
      'Felt slight anxiety and overwhelm today regarding balancing work deadlines with proper recovery. Reminded myself that consistent micro-habits and early evening journaling unload mental chatter and prevent burnout.',
    tone: 'Vulnerable',
    tags: ['mindfulness', 'recovery', 'habits'],
    formattedDate: '3 days ago, 9:20 PM',
    aiInsight: {
      summary:
        'You navigated anxiety with self-awareness by acknowledging the need for boundary setting. Daily journaling is proving to be a reliable anchor for restoring emotional balance.',
      micro_actions: [
        {
          task: 'Do a 2-minute box breathing cycle before opening your inbox tomorrow.',
          friction_level: 'Micro' as const,
        },
        {
          task: 'Schedule a non-negotiable 30-minute afternoon break away from all screens.',
          friction_level: 'Medium' as const,
        },
      ],
      graph_nodes: [
        { id: 'mood-anxiety', label: 'Cognitive Overwhelm', type: 'Mood' as const },
        { id: 'habit-box-breathing', label: 'Box Breathing & Meditation', type: 'Habit' as const },
        { id: 'habit-journaling', label: 'Evening Journaling', type: 'Habit' as const },
      ],
      graph_edges: [
        { source: 'habit-journaling', target: 'mood-anxiety', relationship: 'diffuses' },
        { source: 'habit-box-breathing', target: 'mood-anxiety', relationship: 'calms' },
      ],
    },
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reflection');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [vaultMetadata, setVaultMetadata] = useState<VaultMetadata | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // Admin role state for RBAC controls

  // Decrypted in-memory records
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [actions, setActions] = useState<MicroAction[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Monitor Firebase Auth State & Admin Custom Claims
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        logSecurityAudit('AUTH', `Signed in as ${user.email} (Google Identity)`, 'SUCCESS');
        const hasAdminClaims = await checkAdminClaims(user);
        setIsAdmin(hasAdminClaims);
      } else {
        logSecurityAudit('AUTH', 'User signed out from Google Identity', 'INFO');
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync activeTab with URL hash/route (/admin, #admin, #reflection, etc.)
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      const path = window.location.pathname.replace('/', '').toLowerCase();
      const target = hash || path;

      if (target === 'admin') {
        setActiveTab('admin');
      } else if (
        ['reflection', 'search', 'actions', 'graph', 'security'].includes(target)
      ) {
        setActiveTab(target as ActiveTab);
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Update hash when activeTab changes
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.location.hash = tab === 'reflection' ? '' : tab;
  };

  // Initialize vault check
  useEffect(() => {
    async function checkVault() {
      try {
        const meta = getVaultMetadata();
        if (meta && meta.masterSalt && meta.verificationCiphertext) {
          setIsInitialized(true);
          setVaultMetadata(meta);
        } else {
          setIsInitialized(false);
        }
        const logs = getSecurityAuditLogs();
        setAuditLogs(logs);

        // Preload embedding pipeline in background
        initEmbeddingPipeline().catch(() => {});
      } catch (err) {
        console.error('Failed checking vault status:', err);
      }
    }
    checkVault();
  }, []);

  // Refresh decrypted in-memory records using active masterKey
  const refreshDecryptedVault = useCallback(
    async (key: CryptoKey) => {
      try {
        // First retrieve local records
        let encryptedRecords = await getAllEncryptedRecords();

        // If authenticated and local is empty, try pulling from cloud
        if (currentUser && encryptedRecords.length === 0) {
          try {
            const cloudRecords = await fetchAllEncryptedRecordsFromCloud(currentUser.uid);
            if (cloudRecords.length > 0) {
              for (const rec of cloudRecords) {
                await saveEncryptedRecord(rec);
              }
              encryptedRecords = cloudRecords;
              logSecurityAudit(
                'STORAGE',
                `Synced ${cloudRecords.length} encrypted records from Firestore`,
                'SUCCESS'
              );
            }
          } catch (cloudErr) {
            console.warn('Failed pulling records from cloud:', cloudErr);
          }
        }

        const decryptedList: DecryptedEntry[] = [];
        const actionsList: MicroAction[] = [];

        for (const rec of encryptedRecords) {
          try {
            const decryptedPayload = await decryptData(rec.ciphertext, rec.iv, key);
            const decryptedObj: DecryptedEntry = {
              id: rec.id,
              timestamp: rec.timestamp,
              plaintext: decryptedPayload.plaintext || '',
              tone: decryptedPayload.tone || 'Grounded',
              tags: decryptedPayload.tags || [],
              aiInsight: decryptedPayload.aiInsight,
              embedding: decryptedPayload.embedding || rec.embeddingVector,
              location: decryptedPayload.location,
              formattedDate:
                decryptedPayload.formattedDate ||
                new Date(rec.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
            };
            decryptedList.push(decryptedObj);

            // Collect micro-actions from entry
            if (decryptedObj.aiInsight?.micro_actions) {
              decryptedObj.aiInsight.micro_actions.forEach((act, idx) => {
                actionsList.push({
                  id: `${rec.id}-act-${idx}`,
                  entryId: rec.id,
                  task: act.task,
                  friction_level: act.friction_level,
                  completed: false,
                  createdAt: new Date(rec.timestamp).toISOString(),
                });
              });
            }
          } catch (decErr) {
            console.warn(`Failed decrypting record ${rec.id} (possible key mismatch):`, decErr);
          }
        }

        // Sort descending by timestamp
        decryptedList.sort((a, b) => b.timestamp - a.timestamp);

        setEntries(decryptedList);
        setActions(actionsList);
        const logs = getSecurityAuditLogs();
        setAuditLogs(logs);
      } catch (err) {
        console.error('Failed refreshing decrypted vault:', err);
      }
    },
    [currentUser]
  );

  // Sync all local encrypted records with Firestore for authenticated user
  const handleSyncWithCloud = async () => {
    if (!currentUser || !vaultMetadata) return;
    try {
      await syncVaultMetadataToCloud(currentUser.uid, vaultMetadata);
      const records = await getAllEncryptedRecords();
      for (const rec of records) {
        await syncEncryptedRecordToCloud(currentUser.uid, rec);
      }
      logSecurityAudit(
        'STORAGE',
        `Synced ${records.length} encrypted records to Firestore subcollection`,
        'SUCCESS'
      );
    } catch (err: any) {
      console.error('Cloud synchronization error:', err);
      throw err;
    }
  };

  // Unlock existing vault
  const handleUnlockVault = async (password: string): Promise<boolean> => {
    setErrorMessage(null);
    try {
      const meta = vaultMetadata || getVaultMetadata();
      if (!meta || !meta.masterSalt || !meta.verificationCiphertext) {
        throw new Error('Vault metadata not found. Please initialize a new vault.');
      }

      const result = await verifyAndUnlockVault(
        password,
        meta.masterSalt,
        meta.verificationCiphertext,
        meta.verificationIv
      );

      if (!result.success || !result.key) {
        setErrorMessage(result.error || 'Incorrect master password. Zero-knowledge authentication rejected.');
        return false;
      }

      setMasterKey(result.key);
      setIsUnlocked(true);
      await refreshDecryptedVault(result.key);
      logSecurityAudit('AUTH', 'Vault successfully unlocked via master key derivation', 'SUCCESS');
      return true;
    } catch (err: any) {
      console.error('Unlock failed:', err);
      setErrorMessage(err?.message || 'Authentication error.');
      return false;
    }
  };

  // Initialize new empty vault
  const handleInitializeVault = async (password: string): Promise<void> => {
    try {
      const { masterSalt, verificationCiphertext, verificationIv, key } =
        await initializeVaultMetadata(password);

      const meta: VaultMetadata = {
        isInitialized: true,
        masterSalt,
        verificationCiphertext,
        verificationIv,
        createdAt: Date.now(),
        storageProvider: currentUser ? 'firestore' : 'indexeddb',
      };

      saveVaultMetadata(meta);
      if (currentUser) {
        await syncVaultMetadataToCloud(currentUser.uid, meta);
      }

      setVaultMetadata(meta);
      setMasterKey(key);
      setIsInitialized(true);
      setIsUnlocked(true);
      setEntries([]);
      setActions([]);
      logSecurityAudit('AUTH', 'Zero-knowledge master vault initialized', 'SUCCESS');
    } catch (err: any) {
      console.error('Vault initialization failed:', err);
      setErrorMessage(err?.message || 'Initialization failed.');
    }
  };

  // Initialize and seed sample demo data
  const handleSeedDemoVault = async (password: string): Promise<void> => {
    try {
      const { masterSalt, verificationCiphertext, verificationIv, key } =
        await initializeVaultMetadata(password);

      const meta: VaultMetadata = {
        isInitialized: true,
        masterSalt,
        verificationCiphertext,
        verificationIv,
        createdAt: Date.now(),
        storageProvider: currentUser ? 'firestore' : 'indexeddb',
      };

      saveVaultMetadata(meta);
      if (currentUser) {
        await syncVaultMetadataToCloud(currentUser.uid, meta);
      }

      setVaultMetadata(meta);
      setMasterKey(key);

      // Seed initial encrypted entries
      for (const sample of SEED_ENTRIES) {
        const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const vector = await generateTextEmbedding(sample.plaintext);
        const payload = {
          plaintext: sample.plaintext,
          tone: sample.tone,
          tags: sample.tags,
          aiInsight: sample.aiInsight,
          formattedDate: sample.formattedDate,
          embedding: vector,
        };

        const { ciphertext, iv } = await encryptData(payload, key);
        const record: EncryptedVaultRecord = {
          id,
          timestamp: Date.now(),
          salt: masterSalt,
          iv,
          ciphertext,
          embeddingVector: vector,
        };
        await saveEncryptedRecord(record);

        if (currentUser) {
          await syncEncryptedRecordToCloud(currentUser.uid, record);
        }
      }

      setIsInitialized(true);
      setIsUnlocked(true);
      await refreshDecryptedVault(key);
      logSecurityAudit(
        'CRYPTO',
        'Initialized and encrypted sample reflections with AES-256 GCM',
        'SUCCESS'
      );
    } catch (err: any) {
      console.error('Seed vault error:', err);
      setErrorMessage(err?.message || 'Seed initialization error.');
    }
  };

  // Save and encrypt new daily reflection
  const handleSaveEntry = async (
    plaintext: string,
    tone: string,
    tags: string[],
    location?: GeolocationData
  ): Promise<DecryptedEntry> => {
    if (!masterKey || !vaultMetadata) throw new Error('Vault is locked. Encryption key missing from memory.');

    setIsProcessing(true);
    try {
      // 1. Ephemeral AI Synthesis via Gemini Server API
      let aiResult: AIAnalysisResult | undefined;
      try {
        const notifPrefs = getNotificationPreferences();
        const response = await fetch('/api/ai/analyze-reflection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plaintext,
            tone,
            notificationPreferences: notifPrefs,
          }),
        });
        const resJson = await response.json();
        if (resJson.success && resJson.data) {
          aiResult = resJson.data;
        }
      } catch (aiErr) {
        console.warn('AI synthesis endpoint error:', aiErr);
      }

      // 2. Local In-Browser Vector Embedding Generation
      const vector = await generateTextEmbedding(plaintext);

      // 3. Client-Side AES-GCM Encryption
      const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = Date.now();
      const formattedDate = new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const entryPayload = {
        plaintext,
        tone,
        tags,
        aiInsight: aiResult,
        embedding: vector,
        location,
        formattedDate,
      };

      const { ciphertext, iv } = await encryptData(entryPayload, masterKey);

      // 4. Persistence to Storage (Local + Cloud if authenticated)
      const record: EncryptedVaultRecord = {
        id,
        timestamp,
        salt: vaultMetadata.masterSalt,
        iv,
        ciphertext,
        embeddingVector: vector,
      };

      await saveEncryptedRecord(record);

      if (currentUser) {
        try {
          await syncEncryptedRecordToCloud(currentUser.uid, record);
        } catch (cloudSyncErr) {
          console.warn('Background cloud sync failed:', cloudSyncErr);
        }
      }

      const decryptedEntry: DecryptedEntry = {
        id,
        timestamp,
        plaintext,
        tone,
        tags,
        aiInsight: aiResult,
        embedding: vector,
        location,
        formattedDate,
      };

      // 5. Update In-Memory React State
      setEntries((prev) => [decryptedEntry, ...prev]);

      if (aiResult?.micro_actions) {
        const newActions: MicroAction[] = aiResult.micro_actions.map((a, idx) => ({
          id: `${id}-act-${idx}`,
          entryId: id,
          task: a.task,
          friction_level: a.friction_level,
          completed: false,
          createdAt: new Date(timestamp).toISOString(),
        }));
        setActions((prev) => [...newActions, ...prev]);
      }

      logSecurityAudit('CRYPTO', `Encrypted record ${id} (AES-GCM 256)`, 'SUCCESS');
      return decryptedEntry;
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete reflection
  const handleDeleteEntry = async (id: string) => {
    await deleteEncryptedRecord(id);
    if (currentUser) {
      try {
        await deleteEncryptedRecordFromCloud(currentUser.uid, id);
      } catch (cloudDelErr) {
        console.warn('Failed deleting from cloud:', cloudDelErr);
      }
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setActions((prev) => prev.filter((a) => a.entryId !== id));
    logSecurityAudit('STORAGE', `Purged encrypted record ${id}`, 'WARN');
  };

  // Regenerate AI synthesis for an existing entry (re-analyzes and re-encrypts)
  const handleRegenerateInsight = async (id: string) => {
    if (!masterKey || !vaultMetadata) return;
    const targetEntry = entries.find((e) => e.id === id);
    if (!targetEntry) return;

    setIsProcessing(true);
    try {
      logSecurityAudit('AI_PROXY', `Re-analyzing reflection ${id} with anti-repetition engine...`, 'INFO');
      const response = await fetch('/api/ai/analyze-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaintext: targetEntry.plaintext,
          tone: targetEntry.tone || 'Reflective and grounded',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to re-synthesize reflection.');
      }

      const result = await response.json();
      const updatedInsight = result.data;

      // Update in memory
      const updatedEntry: DecryptedEntry = {
        ...targetEntry,
        aiInsight: updatedInsight,
      };

      // Re-encrypt and persist
      const entryPayload = {
        plaintext: targetEntry.plaintext,
        tone: targetEntry.tone,
        tags: targetEntry.tags || [],
        aiInsight: updatedInsight,
        location: targetEntry.location,
        formattedDate: targetEntry.formattedDate,
      };

      const { ciphertext, iv } = await encryptData(entryPayload, masterKey);

      const record: EncryptedVaultRecord = {
        id: targetEntry.id,
        timestamp: targetEntry.timestamp,
        salt: vaultMetadata.masterSalt,
        iv,
        ciphertext,
        embeddingVector: targetEntry.embedding,
      };

      await saveEncryptedRecord(record);
      if (currentUser) {
        try {
          await syncEncryptedRecordToCloud(currentUser.uid, record);
        } catch (cloudErr) {
          console.warn('Could not sync updated entry to cloud:', cloudErr);
        }
      }

      setEntries((prev) => prev.map((e) => (e.id === id ? updatedEntry : e)));

      // Also update actions
      if (updatedInsight.micro_actions && updatedInsight.micro_actions.length > 0) {
        const newActions: MicroAction[] = updatedInsight.micro_actions.map(
          (act: any, idx: number) => ({
            id: `${targetEntry.id}-act-${idx}-${Date.now()}`,
            entryId: targetEntry.id,
            task: act.task,
            friction_level: act.friction_level || 'Micro',
            completed: false,
            createdAt: new Date(targetEntry.timestamp).toISOString(),
          })
        );
        setActions((prev) => [
          ...newActions,
          ...prev.filter((a) => a.entryId !== targetEntry.id),
        ]);
      }

      logSecurityAudit('CRYPTO', `Re-encrypted reflection ${id} with upgraded dynamic synthesis`, 'SUCCESS');
    } catch (err: any) {
      console.error('Error re-synthesizing reflection:', err);
      logSecurityAudit('STORAGE', `Failed re-synthesizing reflection ${id}: ${err.message}`, 'WARN');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Micro-Action
  const handleToggleAction = async (actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, completed: !a.completed } : a))
    );
  };

  // Add Custom Micro-Action
  const handleAddCustomAction = async (
    task: string,
    friction_level: 'Micro' | 'Low' | 'Medium'
  ) => {
    const customAction: MicroAction = {
      id: `custom-act-${Date.now()}`,
      task,
      friction_level,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setActions((prev) => [customAction, ...prev]);
    logSecurityAudit('STORAGE', `Created custom action: ${task.slice(0, 20)}...`, 'INFO');
  };

  // Lock Vault (Immediately wipe in-memory keys and buffers)
  const handleLockVault = () => {
    setMasterKey(null);
    setIsUnlocked(false);
    setEntries([]);
    setActions([]);
    logSecurityAudit('MEMORY', 'Zero-knowledge in-memory keys purged', 'INFO');
  };

  // Calculate unique graph nodes count across entries
  const totalGraphNodes = React.useMemo(() => {
    const uniqueIds = new Set<string>();
    for (const e of entries) {
      for (const n of e.aiInsight?.graph_nodes || []) {
        uniqueIds.add((n.id || n.label).toLowerCase());
      }
    }
    return uniqueIds.size;
  }, [entries]);

  const pendingActionsCount = actions.filter((a) => !a.completed).length;

  return (
    <div className="min-h-screen bg-transparent text-neutral-100 font-sans selection:bg-cyan-500 selection:text-neutral-950 flex flex-col relative">
      {/* Continuously Animated Neural Manifold Canvas Background */}
      <NeuralManifoldBackground />

      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        pendingActionsCount={pendingActionsCount}
        graphNodesCount={totalGraphNodes}
        totalEntriesCount={entries.length}
        onLockVault={handleLockVault}
        currentUser={currentUser}
        isAdmin={isAdmin}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {!isUnlocked ? (
          <VaultLockModal
            isInitialized={isInitialized}
            onUnlock={handleUnlockVault}
            onInitialize={handleInitializeVault}
            onSeedDemoData={handleSeedDemoVault}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            currentUser={currentUser}
          />
        ) : (
          <div>
            {activeTab === 'reflection' && (
              <DailyReflectionTab
                entries={entries}
                onSaveEntry={handleSaveEntry}
                onDeleteEntry={handleDeleteEntry}
                onRegenerateInsight={handleRegenerateInsight}
                isProcessing={isProcessing}
                onAddMicroAction={handleAddCustomAction}
              />
            )}

            {activeTab === 'search' && <PastSelfSearchTab entries={entries} />}

            {activeTab === 'actions' && (
              <MorningActionsTab
                actions={actions}
                onToggleAction={handleToggleAction}
                onAddCustomAction={handleAddCustomAction}
              />
            )}

            {activeTab === 'graph' && <KnowledgeGraphTab entries={entries} />}

            {activeTab === 'security' && (
              <SecurityAuditTab
                auditLogs={auditLogs}
                onLockVault={handleLockVault}
                currentUser={currentUser}
                onSyncWithCloud={handleSyncWithCloud}
                onRefreshVault={async () => {
                  if (masterKey) await refreshDecryptedVault(masterKey);
                }}
              />
            )}

            {activeTab === 'admin' && (
              <AdminDashboard
                currentUserEmail={currentUser?.email || undefined}
                isAdmin={isAdmin}
                onToggleAdminRole={(elevated) => setIsAdmin(elevated)}
                onRedirectToDashboard={() => handleTabChange('reflection')}
              />
            )}
          </div>
        )}
      </main>

      {/* Persistent Security Footer */}
      <footer className="w-full border-t border-neutral-900 bg-neutral-950 py-4 px-4 sm:px-8 text-[11px] text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Mind Vault • Zero-Knowledge Client-Side AES-256 GCM</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Web Crypto PBKDF2 (100k)</span>
          <span>•</span>
          <span>Google Federated Identity</span>
          <span>•</span>
          <span>all-MiniLM-L6-v2 Local WASM</span>
          <span>•</span>
          <span>Gemini 3.7 Flash Proxy</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
