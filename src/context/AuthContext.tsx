/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  AuthError,
} from 'firebase/auth';
import { auth, googleProvider, authReadyPromise } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  authErrorCode: string | null;
  signInWithGoogle: (preferRedirect?: boolean) => Promise<{ success: boolean; error?: string }>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getReadableErrorMessage(error: AuthError): { message: string; code: string } {
  const code = error.code || 'unknown';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return {
        message: 'Google sign-in was closed before completion.',
        code,
      };
    case 'auth/cancelled-popup-request':
      return {
        message: 'Another sign-in attempt was initiated. Please try again.',
        code,
      };
    case 'auth/popup-blocked':
      return {
        message: 'The sign-in popup was blocked by your browser. Please allow popups or use redirect.',
        code,
      };
    case 'auth/unauthorized-domain':
      return {
        message:
          'This domain is not yet authorized in Firebase Console. Go to Firebase Console > Authentication > Settings > Authorized domains and add this host.',
        code,
      };
    case 'auth/operation-not-allowed':
      return {
        message:
          'Google Sign-In is not enabled yet in your Firebase Project. Enable Google in Firebase Console > Authentication > Sign-in method.',
        code,
      };
    case 'auth/network-request-failed':
      return {
        message: 'Network error. Please check your internet connection and try again.',
        code,
      };
    default:
      return {
        message: error.message || 'Authentication failed. Please try again.',
        code,
      };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Authentication initialization & session restoration
  //
  // 1. Immediately subscribe to onAuthStateChanged so no state transitions are missed.
  // 2. Consume any pending redirect sign-in credential from getRedirectResult(auth).
  // 3. Await authReadyPromise (auth.authStateReady()), which guarantees Firebase
  //    Auth has finished reading its persisted session from storage (IndexedDB / localStorage)
  //    before setting loading to false. This prevents premature flashes of the signed-out state.
  // 4. Do NOT call setPersistence at runtime: Firebase Web SDK getAuth() already sets
  //    up the multi-tier persistence hierarchy. Runtime calls to setPersistence()
  //    actively wipe currentUser and corrupt token-refresh timers.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      // Step 1: Subscribe to onAuthStateChanged as the continuous source of truth
      unsubscribe = onAuthStateChanged(
        auth,
        (currentUser) => {
          if (!isMounted) return;
          setUser(currentUser);
          if (currentUser) {
            try {
              localStorage.setItem('echo_last_active_uid', currentUser.uid);
            } catch {
              // ignore
            }
          }
          setLoading(false);
        },
        (error) => {
          // Network errors or token refresh hiccups while offline must NOT sign the user out.
          // Firebase Auth retains the cached user in persistent storage and will retry.
          console.warn('Firebase onAuthStateChanged error (transient network or token issue):', error);
          if (!isMounted) return;
          if (auth.currentUser) {
            setUser(auth.currentUser);
          }
          setLoading(false);
        }
      );

      // Step 2: Consume redirect result if arriving back from a Google redirect
      try {
        const redirectResult = await getRedirectResult(auth);
        if (isMounted && redirectResult?.user) {
          try {
            localStorage.setItem('echo_last_active_uid', redirectResult.user.uid);
          } catch {
            // ignore
          }
          setUser(redirectResult.user);
          setAuthError(null);
          setAuthErrorCode(null);
        }
      } catch (err: unknown) {
        if (isMounted && err && typeof err === 'object' && 'code' in err) {
          const formatted = getReadableErrorMessage(err as AuthError);
          setAuthError(formatted.message);
          setAuthErrorCode(formatted.code);
        }
      }

      // Step 3: Await authReadyPromise (which resolves via auth.authStateReady()).
      // This ensures Firebase Auth has finished its initial restoration from IndexedDB.
      try {
        await authReadyPromise;
      } catch (err) {
        console.warn('authReadyPromise error:', err);
      }

      if (isMounted) {
        setUser(auth.currentUser);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  const signInWithGoogle = useCallback(
    async (preferRedirect = false): Promise<{ success: boolean; error?: string }> => {
      setIsSigningIn(true);
      setAuthError(null);
      setAuthErrorCode(null);

      // Mobile check or explicit redirect preference
      const isMobile =
        typeof window !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (preferRedirect || (isMobile && window.top !== window.self)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { success: true };
        } catch (err: unknown) {
          setIsSigningIn(false);
          const errorObj = err as AuthError;
          const formatted = getReadableErrorMessage(errorObj);
          setAuthError(formatted.message);
          setAuthErrorCode(formatted.code);
          return { success: false, error: formatted.message };
        }
      }

      // Default: popup on desktop
      try {
        const result = await signInWithPopup(auth, googleProvider);
        setUser(result.user);
        if (typeof window !== 'undefined' && result.user) {
          try {
            localStorage.setItem('echo_last_active_uid', result.user.uid);
          } catch {
            // ignore
          }
        }
        setIsSigningIn(false);
        return { success: true };
      } catch (err: unknown) {
        const errorObj = err as AuthError;
        // If popup was blocked, fallback to redirect or notify user
        if (errorObj.code === 'auth/popup-blocked') {
          try {
            await signInWithRedirect(auth, googleProvider);
            return { success: true };
          } catch (redirectErr: unknown) {
            setIsSigningIn(false);
            const formatted = getReadableErrorMessage(redirectErr as AuthError);
            setAuthError(formatted.message);
            setAuthErrorCode(formatted.code);
            return { success: false, error: formatted.message };
          }
        }

        setIsSigningIn(false);
        const formatted = getReadableErrorMessage(errorObj);
        setAuthError(formatted.message);
        setAuthErrorCode(formatted.code);
        return { success: false, error: formatted.message };
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthError(null);
      setAuthErrorCode(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('echo_last_active_uid');
        } catch {
          // ignore
        }
      }
    } catch (err: unknown) {
      console.error('Sign-out error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSigningIn,
        authError,
        authErrorCode,
        signInWithGoogle,
        signOutUser,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
