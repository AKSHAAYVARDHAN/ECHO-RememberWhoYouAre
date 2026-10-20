/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App - reuse existing app if already initialized (hot reload safe)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Authentication using getAuth(app), which sets up the official
// multi-tier browser persistence ([indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence])
// and configures browserPopupRedirectResolver for Google Sign-In and getRedirectResult.
export const auth = getAuth(app);

// authReadyPromise: resolves once persistent browser storage is requested and
// Firebase Auth has resolved its persisted session from storage via auth.authStateReady().
//
// CRITICAL: We do NOT invoke setPersistence(auth, browserLocalPersistence) at runtime.
// In the Firebase Web SDK, setPersistence() actively calls removeCurrentUser() before
// switching persistence. When called on reload or cold start, this purges existing
// sessions stored in IndexedDB and destroys token-refresh state, which was the root cause
// of unexpected automatic sign-outs after page reloads or extended idle periods.
export const authReadyPromise: Promise<void> = (async () => {
  if (typeof window === 'undefined') return;

  // Request durable storage so the browser does not evict our IndexedDB/localStorage
  // under storage pressure (important for installed PWAs and long browser sessions).
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // Non-fatal — browser may deny the request silently.
    }
  }

  // Await Firebase Auth's official session restoration promise
  try {
    await auth.authStateReady();
  } catch (err) {
    console.warn('Firebase: authStateReady() failed:', err);
  }
})();

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Test connection on boot as required by Firestore integration specifications
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or connecting. Local storage cache will be used.');
    }
  }
}

// Error handling helper conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Run connection validation once on module load
testConnection();
