/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { INITIAL_QUOTES, QuoteItem, ProfileData } from '../types/quote';

const QUOTES_STORAGE_KEY = 'insideout_quotes_v1';
const PROFILE_STORAGE_KEY = 'insideout_profile_v1';

function createDefaultQuotes(): QuoteItem[] {
  return INITIAL_QUOTES.map((text, idx) => ({
    id: `quote-init-${idx + 1}`,
    text,
    createdAt: 1700000000000 + idx * 1000,
  }));
}

function loadStoredQuotes(): QuoteItem[] {
  if (typeof window === 'undefined') {
    return createDefaultQuotes();
  }
  try {
    const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
    if (!raw) {
      const defaults = createDefaultQuotes();
      localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Validate that elements have valid text
      const validQuotes: QuoteItem[] = parsed.map((item, i) => {
        if (typeof item === 'string') {
          return { id: `quote-${Date.now()}-${i}`, text: item };
        }
        return {
          id: item.id || `quote-${Date.now()}-${i}`,
          text: String(item.text || ''),
          createdAt: item.createdAt,
        };
      }).filter((q) => q.text.trim().length > 0);

      if (validQuotes.length > 0) {
        return validQuotes;
      }
    }
    // Fallback if empty or invalid
    const defaults = createDefaultQuotes();
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch {
    return createDefaultQuotes();
  }
}

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

interface AppContextType {
  quotes: QuoteItem[];
  profile: ProfileData;
  currentPath: string;
  navigate: (path: string) => void;
  updateProfile: (data: ProfileData) => { success: boolean; error?: string };
  addQuote: (text: string) => { success: boolean; error?: string; quote?: QuoteItem };
  editQuote: (id: string, text: string) => { success: boolean; error?: string };
  deleteQuote: (id: string) => { success: boolean };
  resetQuotesToDefaults: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [quotes, setQuotes] = useState<QuoteItem[]>(() => loadStoredQuotes());
  const [profile, setProfile] = useState<ProfileData>(() => loadStoredProfile());

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/profile' ? '/profile' : '/';
    }
    return '/';
  });

  // Routing synchronisation with browser history
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname === '/profile' ? '/profile' : '/';
      setCurrentPath(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = path === '/profile' ? '/profile' : '/';
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
  }, []);

  // Profile update and storage
  const updateProfile = useCallback((data: ProfileData): { success: boolean; error?: string } => {
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
      // Storage quota or restriction
    }
    return { success: true };
  }, []);

  // Quote collection updates and persistence
  const addQuote = useCallback(
    (text: string): { success: boolean; error?: string; quote?: QuoteItem } => {
      const trimmed = text.trim();
      if (!trimmed) {
        return { success: false, error: 'Quote text cannot be empty.' };
      }
      if (trimmed.length > 280) {
        return { success: false, error: 'Quote must be 280 characters or fewer.' };
      }

      // Check duplicate ignoring case and excess internal whitespace
      const normalizedNew = trimmed.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate = quotes.some(
        (q) => q.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNew
      );

      if (isDuplicate) {
        return { success: false, error: 'This quote already exists in your collection.' };
      }

      const newQuote: QuoteItem = {
        id: `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        text: trimmed,
        createdAt: Date.now(),
      };

      setQuotes((prev) => {
        const next = [newQuote, ...prev];
        try {
          localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage error
        }
        return next;
      });

      return { success: true, quote: newQuote };
    },
    [quotes]
  );

  const editQuote = useCallback(
    (id: string, text: string): { success: boolean; error?: string } => {
      const trimmed = text.trim();
      if (!trimmed) {
        return { success: false, error: 'Quote text cannot be empty.' };
      }
      if (trimmed.length > 280) {
        return { success: false, error: 'Quote must be 280 characters or fewer.' };
      }

      // Duplicate check against other quotes
      const normalizedNew = trimmed.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate = quotes.some(
        (q) => q.id !== id && q.text.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedNew
      );

      if (isDuplicate) {
        return { success: false, error: 'Another quote with this wording already exists.' };
      }

      setQuotes((prev) => {
        const next = prev.map((q) => (q.id === id ? { ...q, text: trimmed } : q));
        try {
          localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      return { success: true };
    },
    [quotes]
  );

  const deleteQuote = useCallback((id: string): { success: boolean } => {
    setQuotes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      try {
        localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    return { success: true };
  }, []);

  const resetQuotesToDefaults = useCallback(() => {
    const defaults = createDefaultQuotes();
    setQuotes(defaults);
    try {
      localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(defaults));
    } catch {
      // ignore
    }
  }, []);

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
