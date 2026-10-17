/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { INITIAL_QUOTES, QuoteItem, ProfileData, getDefaultsSignature } from '../types/quote';
import {
  QUOTES_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
  QUOTES_VERSION_KEY,
  createDefaultQuotes,
  loadDeletedDefaultIds,
  saveDeletedDefaultIds,
  migrateQuoteCollection,
  loadAndMigrateStoredQuotes,
} from '../utils/quoteMigration';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';

function loadStoredProfile(): ProfileData {
  const emptyProfile: ProfileData = {
    name: '',
    bio: '',
    location: '',
  };
  if (typeof window === 'undefined') {
    return emptyProfile;
  }
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return emptyProfile;
    }
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      location: typeof parsed.location === 'string' ? parsed.location : '',
    };
  } catch {
    return emptyProfile;
  }
}

function persistQuotesToStorage(quotes: QuoteItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
    localStorage.setItem(QUOTES_VERSION_KEY, getDefaultsSignature(INITIAL_QUOTES));
  } catch {
    // Storage quota or unavailable
  }
}

interface AppContextType {
  quotes: QuoteItem[];
  profile: ProfileData;
  currentPath: string;
  navigate: (path: string) => void;
  updateProfile: (data: ProfileData) => Promise<{ success: boolean; error?: string }>;
  addQuote: (text: string) => Promise<{ success: boolean; error?: string; quote?: QuoteItem }>;
  editQuote: (id: string, text: string) => Promise<{ success: boolean; error?: string }>;
  deleteQuote: (id: string) => Promise<{ success: boolean }>;
  resetQuotesToDefaults: () => Promise<void>;
  isSyncing: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<QuoteItem[]>(() => loadAndMigrateStoredQuotes());
  const [profile, setProfile] = useState<ProfileData>(() => loadStoredProfile());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p === '/profile' || p === '/auth') {
        return p;
      }
    }
    return '/';
  });

  // Routing synchronisation with browser history
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/profile' || path === '/auth') {
        setCurrentPath(path);
      } else {
        setCurrentPath('/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = path === '/profile' || path === '/auth' ? path : '/';
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
  }, []);

  // Multi-tab and external storage change listener for instant synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === QUOTES_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            const deletedIds = loadDeletedDefaultIds();
            const migrated = migrateQuoteCollection(parsed, deletedIds, INITIAL_QUOTES);
            setQuotes(migrated);
          }
        } catch {
          // ignore
        }
      } else if (e.key === PROFILE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setProfile(parsed);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Sync data with Firestore when user logs in with Google
  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    setIsSyncing(true);

    const syncUserData = async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!isMounted) return;

        if (userDocSnap.exists()) {
          const remoteData = userDocSnap.data();
          const syncedProfile: ProfileData = {
            name: remoteData.displayName || user.displayName || profile.name || '',
            bio: remoteData.bio || profile.bio || '',
            location: remoteData.location || profile.location || '',
          };
          setProfile(syncedProfile);
          try {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(syncedProfile));
          } catch {
            // ignore
          }
        } else {
          // Initialize user doc in Firestore
          const initialProfileData = {
            uid: user.uid,
            displayName: profile.name || user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            bio: profile.bio || '',
            location: profile.location || '',
            updatedAt: new Date().toISOString(),
          };
          await setDoc(userDocRef, initialProfileData);
        }

        // Fetch quotes subcollection
        const quotesCollectionRef = collection(db, 'users', user.uid, 'quotes');
        const quotesSnap = await getDocs(quotesCollectionRef);

        if (!isMounted) return;

        if (!quotesSnap.empty) {
          const remoteQuotesRaw: QuoteItem[] = quotesSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: data.id || d.id,
              text: data.text || '',
              createdAt: data.createdAt || Date.now(),
              origin: data.origin,
              defaultIndex: data.defaultIndex,
              defaultId: data.defaultId,
              isEdited: data.isEdited,
              originalText: data.originalText,
            };
          });

          // Run versioned migration on remote quotes
          const deletedIds = loadDeletedDefaultIds();
          const syncedQuotes = migrateQuoteCollection(remoteQuotesRaw, deletedIds, INITIAL_QUOTES);
          setQuotes(syncedQuotes);
          persistQuotesToStorage(syncedQuotes);

          // Update any modified/migrated quotes back to Firestore
          for (const q of syncedQuotes) {
            const qDocRef = doc(db, 'users', user.uid, 'quotes', q.id);
            await setDoc(
              qDocRef,
              {
                id: q.id,
                text: q.text,
                createdAt: q.createdAt || Date.now(),
                userId: user.uid,
                origin: q.origin || 'default',
                isEdited: Boolean(q.isEdited),
                ...(q.defaultIndex !== undefined ? { defaultIndex: q.defaultIndex } : {}),
                ...(q.defaultId ? { defaultId: q.defaultId } : {}),
                ...(q.originalText ? { originalText: q.originalText } : {}),
              },
              { merge: true }
            );
          }
        } else if (quotes.length > 0) {
          // Sync local quotes to Firestore if remote is empty
          for (const q of quotes) {
            const qDocRef = doc(db, 'users', user.uid, 'quotes', q.id);
            await setDoc(qDocRef, {
              id: q.id,
              text: q.text,
              createdAt: q.createdAt || Date.now(),
              userId: user.uid,
              origin: q.origin || 'default',
              isEdited: Boolean(q.isEdited),
              ...(q.defaultIndex !== undefined ? { defaultIndex: q.defaultIndex } : {}),
              ...(q.defaultId ? { defaultId: q.defaultId } : {}),
              ...(q.originalText ? { originalText: q.originalText } : {}),
            });
          }
        }
      } catch (err) {
        console.warn('Sync with Firestore skipped or failed:', err);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    syncUserData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Profile update and storage
  const updateProfile = useCallback(
    async (data: ProfileData): Promise<{ success: boolean; error?: string }> => {
      const name = data.name.trim();
      const bio = data.bio.trim();
      const location = data.location.trim();

      if (name.length > 60) {
        return { success: false, error: 'Name must be 60 characters or fewer.' };
      }
      if (bio.length > 300) {
        return { success: false, error: 'Bio must be 300 characters or fewer.' };
      }
      if (location.length > 80) {
        return { success: false, error: 'Location must be 80 characters or fewer.' };
      }

      const updated: ProfileData = {
        name,
        bio,
        location,
      };

      setProfile(updated);
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Storage quota
      }

      // If user is authenticated, sync to Firestore
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(
            userDocRef,
            {
              uid: user.uid,
              displayName: name,
              email: user.email || '',
              photoURL: user.photoURL || '',
              bio,
              location,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
          } catch {
            // Logged, return soft success with warning
          }
        }
      }

      return { success: true };
    },
    [user]
  );

  // Quote collection updates and persistence
  const addQuote = useCallback(
    async (text: string): Promise<{ success: boolean; error?: string; quote?: QuoteItem }> => {
      const trimmed = text.trim();
      if (!trimmed) {
        return { success: false, error: 'Quote text cannot be empty.' };
      }
      if (trimmed.length > 280) {
        return { success: false, error: 'Quote must be 280 characters or fewer.' };
      }

      const normalizedNew = trimmed.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate = quotes.some(
        (q) => q.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNew
      );

      if (isDuplicate) {
        return { success: false, error: 'This quote already exists in your collection.' };
      }

      const cleanId = `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newQuote: QuoteItem = {
        id: cleanId,
        text: trimmed,
        origin: 'user',
        isEdited: false,
        createdAt: Date.now(),
      };

      setQuotes((prev) => {
        const next = [newQuote, ...prev];
        persistQuotesToStorage(next);
        return next;
      });

      // If authenticated, sync to Firestore
      if (user) {
        try {
          const qDocRef = doc(db, 'users', user.uid, 'quotes', cleanId);
          await setDoc(qDocRef, {
            id: cleanId,
            text: trimmed,
            createdAt: newQuote.createdAt,
            userId: user.uid,
            origin: 'user',
            isEdited: false,
          });
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/quotes/${cleanId}`);
          } catch {
            // Keep local
          }
        }
      }

      return { success: true, quote: newQuote };
    },
    [quotes, user]
  );

  const editQuote = useCallback(
    async (id: string, text: string): Promise<{ success: boolean; error?: string }> => {
      const trimmed = text.trim();
      if (!trimmed) {
        return { success: false, error: 'Quote text cannot be empty.' };
      }
      if (trimmed.length > 280) {
        return { success: false, error: 'Quote must be 280 characters or fewer.' };
      }

      const normalizedNew = trimmed.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate = quotes.some(
        (q) => q.id !== id && q.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNew
      );

      if (isDuplicate) {
        return { success: false, error: 'Another quote with this wording already exists.' };
      }

      let updatedQuote: QuoteItem | undefined;

      setQuotes((prev) => {
        const next = prev.map((q) => {
          if (q.id === id) {
            updatedQuote = {
              ...q,
              text: trimmed,
              isEdited: true, // Mark as user-edited so migrations preserve it
            };
            return updatedQuote;
          }
          return q;
        });
        persistQuotesToStorage(next);
        return next;
      });

      if (user && updatedQuote) {
        try {
          const qDocRef = doc(db, 'users', user.uid, 'quotes', id);
          await setDoc(
            qDocRef,
            {
              id,
              text: trimmed,
              userId: user.uid,
              isEdited: true,
              ...(updatedQuote.origin ? { origin: updatedQuote.origin } : {}),
            },
            { merge: true }
          );
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/quotes/${id}`);
          } catch {
            // Keep local
          }
        }
      }

      return { success: true };
    },
    [quotes, user]
  );

  const deleteQuote = useCallback(
    async (id: string): Promise<{ success: boolean }> => {
      setQuotes((prev) => {
        const target = prev.find((q) => q.id === id);
        if (target) {
          // If a default-provided quote was deleted, track it so it is never resurrected during future migrations
          const isDefault =
            target.origin === 'default' ||
            target.id.startsWith('quote-init-') ||
            (target.defaultId && target.defaultId.startsWith('quote-init-'));

          if (isDefault) {
            const deletedIds = loadDeletedDefaultIds();
            const defId = target.defaultId || target.id;
            deletedIds.add(defId);
            saveDeletedDefaultIds(deletedIds);
          }
        }

        const next = prev.filter((q) => q.id !== id);
        persistQuotesToStorage(next);
        return next;
      });

      if (user) {
        try {
          const qDocRef = doc(db, 'users', user.uid, 'quotes', id);
          await deleteDoc(qDocRef);
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/quotes/${id}`);
          } catch {
            // Keep local
          }
        }
      }

      return { success: true };
    },
    [user]
  );

  const resetQuotesToDefaults = useCallback(async () => {
    // Clear deleted default IDs so all current defaults can be restored
    saveDeletedDefaultIds(new Set());

    const defaults = createDefaultQuotes(INITIAL_QUOTES);
    setQuotes(defaults);
    persistQuotesToStorage(defaults);

    if (user) {
      try {
        for (const q of defaults) {
          const qDocRef = doc(db, 'users', user.uid, 'quotes', q.id);
          await setDoc(qDocRef, {
            id: q.id,
            text: q.text,
            createdAt: q.createdAt || Date.now(),
            userId: user.uid,
            origin: 'default',
            isEdited: false,
            defaultIndex: q.defaultIndex,
            defaultId: q.defaultId,
            originalText: q.originalText,
          });
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  return (
    <AppContext.Provider
      value={{
        quotes,
        profile,
        currentPath,
        navigate,
        updateProfile,
        addQuote,
        editQuote,
        deleteQuote,
        resetQuotesToDefaults,
        isSyncing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
