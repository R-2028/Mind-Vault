/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { EncryptedVaultRecord, VaultMetadata } from '../types';

// Initialize Firebase SDK
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use configured firestore database ID if present
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Save user vault metadata in Firestore under isolated user document
 */
export async function syncVaultMetadataToCloud(userId: string, metadata: VaultMetadata): Promise<void> {
  const sanitized = JSON.parse(JSON.stringify(metadata));
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { vaultMetadata: sanitized, updatedAt: Date.now() }, { merge: true });
}

/**
 * Save encrypted record in Firestore subcollection (users/{userId}/encrypted_vault/{recordId})
 */
export async function syncEncryptedRecordToCloud(
  userId: string,
  record: EncryptedVaultRecord
): Promise<void> {
  const sanitized = JSON.parse(JSON.stringify(record));
  const recordRef = doc(db, 'users', userId, 'encrypted_vault', record.id);
  await setDoc(recordRef, sanitized);
}

/**
 * Delete encrypted record from Firestore
 */
export async function deleteEncryptedRecordFromCloud(userId: string, recordId: string): Promise<void> {
  const recordRef = doc(db, 'users', userId, 'encrypted_vault', recordId);
  await deleteDoc(recordRef);
}

/**
 * Fetch all encrypted records for authenticated user from Firestore
 */
export async function fetchAllEncryptedRecordsFromCloud(userId: string): Promise<EncryptedVaultRecord[]> {
  const vaultCol = collection(db, 'users', userId, 'encrypted_vault');
  const q = query(vaultCol, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  const records: EncryptedVaultRecord[] = [];
  snapshot.forEach((docSnap) => {
    records.push(docSnap.data() as EncryptedVaultRecord);
  });
  return records;
}

/**
 * Check if the authenticated user possesses Firebase Auth Admin Custom Claims
 */
export async function checkAdminClaims(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const idTokenResult = await user.getIdTokenResult(true);
    if (idTokenResult.claims.admin === true || idTokenResult.claims.role === 'admin') {
      return true;
    }
    // Also check if owner email matches project admin
    if (user.email === 'riteshnayak2301@gmail.com') {
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error checking admin token claims:', err);
    return false;
  }
}

/**
 * Update user role in Firestore & call backend role sync
 */
export async function updateUserRoleInCloud(uid: string, role: 'admin' | 'user'): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, role, isAdmin: role === 'admin' }),
    });
    const data = await res.json();
    if (data.success) {
      // Also persist role metadata in roles collection
      const roleRef = doc(db, 'roles', uid);
      await setDoc(roleRef, { role, updatedAt: Date.now() }, { merge: true });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to update user role:', err);
    return false;
  }
}
