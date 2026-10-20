/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Trash2, Check, X, RotateCcw, LogOut, CheckCircle2, User as UserIcon, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ProfileData, INITIAL_QUOTES } from '../types/quote';
import { AudioLibrarySection } from './AudioLibrarySection';

interface ProfilePageProps {
  onBack: () => void;
  onNavigateAuth?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack, onNavigateAuth }) => {
  const {
    profile,
    updateProfile,
    quotes,
    addQuote,
    editQuote,
    deleteQuote,
    resetQuotesToDefaults,
    isSyncing,
  } = useApp();

  const { user, loading: authLoading, isSigningIn, signInWithGoogle, signOutUser, authError, clearAuthError } = useAuth();

  // Local state for profile form fields
  const [formData, setFormData] = useState<ProfileData>({
    name: profile.name,
    bio: profile.bio,
    location: profile.location,
  });
  const [profileStatus, setProfileStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Sync formData when profile from store updates
  useEffect(() => {
    setFormData({
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
    });
  }, [profile]);

  // Local state for adding quotes
  const [newQuoteText, setNewQuoteText] = useState('');
  const [quoteAddError, setQuoteAddError] = useState<string | null>(null);

  // Local state for editing an existing quote
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Local state for delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Reset confirmation state
  const [confirmReset, setConfirmReset] = useState(false);

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);

    const result = await updateProfile(formData);
    if (result.success) {
      setProfileStatus({ type: 'success', message: 'Profile saved' });
      const timer = window.setTimeout(() => {
        setProfileStatus(null);
      }, 3500);
      return () => clearTimeout(timer);
    } else {
      setProfileStatus({ type: 'error', message: result.error || 'Failed to save profile' });
    }
  };

  // Handle Add Quote
  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteAddError(null);

    const result = await addQuote(newQuoteText);
    if (!result.success) {
      setQuoteAddError(result.error || 'Could not add quote');
    } else {
      setNewQuoteText('');
    }
  };

  // Handle Start Edit Quote
  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
    setEditError(null);
    setConfirmDeleteId(null);
  };

  // Handle Save Edit
  const handleSaveEdit = async (id: string) => {
    setEditError(null);
    const result = await editQuote(id, editingText);
    if (!result.success) {
      setEditError(result.error || 'Could not update quote');
    } else {
      setEditingId(null);
      setEditingText('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
    setEditError(null);
  };

  // Handle Delete Confirmation
  const confirmDelete = async (id: string) => {
    await deleteQuote(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="relative z-30 w-full min-h-screen min-h-[100dvh] bg-[#000000] text-[#E8E8E8] font-mono selection:bg-[#222222] selection:text-[#FFFFFF] pb-24">
      {/* Top Bar with Back Button */}
      <header className="sticky top-0 z-40 bg-[#000000]/95 backdrop-blur-xs border-b border-[#141414] px-4 md:px-8 py-3.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Return to cosmic homepage"
          className="flex items-center gap-2.5 text-xs text-[#777777] hover:text-[#E8E8E8] focus-visible:text-[#E8E8E8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#666666] py-1 px-1.5 -ml-1.5 rounded-sm transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5] transition-transform group-hover:-translate-x-0.5" />
          <span className="tracking-wider uppercase text-[11px]">Cosmic Space</span>
        </button>

        <div className="flex items-baseline gap-2 select-none">
          <span className="text-[11px] tracking-[0.2em] uppercase text-[#666666] font-medium">
            ECHO
          </span>
          <span className="hidden sm:inline text-[10px] tracking-[0.14em] text-[#444444]">
            · Remember Who You Are.
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-16">
        {/* Section 0: Google Account & Cloud Synchronization */}
        <section aria-labelledby="auth-heading" className="space-y-4">
          <div className="border-b border-[#161616] pb-3 flex items-baseline justify-between">
            <div>
              <h2 id="auth-heading" className="text-xs uppercase tracking-[0.16em] text-[#A0A0A0]">
                Google Account & Synchronization
              </h2>
              <p className="text-[11px] text-[#555555] mt-1">
                Synchronize your affirmations and identity securely across devices.
              </p>
            </div>
            {isSyncing && (
              <span className="text-[10px] uppercase tracking-wider text-[#777777] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#777777] animate-pulse" />
                Syncing...
              </span>
            )}
          </div>

          {authLoading ? (
            <div className="bg-[#080808] border border-[#1A1A1A] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2A2A2A] flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#444444] border-t-[#CCCCCC] rounded-full animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#CCCCCC]">
                      Restoring Secure Session...
                    </span>
                  </div>
                  <p className="text-[11px] text-[#555555]">Checking persistent Google authentication</p>
                </div>
              </div>
            </div>
          ) : user ? (
            <div className="bg-[#080808] border border-[#1A1A1A] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google user'}
                    className="w-10 h-10 rounded-full border border-[#333333] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#141414] border border-[#2A2A2A] flex items-center justify-center text-[#888888]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-[#E8E8E8]">
                      {user.displayName || 'Affirmation Keeper'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#102010] text-[#66BB66] border border-[#224422] rounded-xs font-medium select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#66BB66]" />
                      Signed In
                    </span>
                  </div>
                  <p className="text-[11px] text-[#777777]">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={signOutUser}
                  className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-[#888888] hover:text-[#FF7070] border border-[#222222] hover:border-[#3A1818] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#080808] border border-[#1A1A1A] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-[#CCCCCC] font-normal">
                  You are currently using local storage.
                </p>
                <p className="text-[11px] text-[#555555]">
                  Sign in with Google to preserve and synchronize your cosmic affirmations everywhere.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateAuth) {
                      onNavigateAuth();
                    } else {
                      signInWithGoogle(false);
                    }
                  }}
                  disabled={isSigningIn}
                  aria-label="Sign In with Google"
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#FFFFFF] hover:bg-[#F2F2F2] active:bg-[#E5E5E5] text-[#1F1F1F] text-xs font-medium tracking-wide flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSigningIn ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#555555] border-t-[#000000] rounded-full animate-spin" />
                  ) : (
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
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
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 10.02 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  )}
                  <span className="font-sans font-medium text-xs">Sign In with Google</span>
                </button>
              </div>
            </div>
          )}

          {authError && (
            <div className="bg-[#120808] border border-[#3A1414] p-3 text-xs text-[#FF8585] flex items-center justify-between">
              <span>{authError}</span>
              <button
                type="button"
                onClick={clearAuthError}
                className="text-[11px] underline text-[#AAAAAA] hover:text-[#FFFFFF] cursor-pointer ml-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </section>

        {/* Section 1: Personal Identity */}
        <section aria-labelledby="identity-heading" className="space-y-6">
          <div className="border-b border-[#161616] pb-3">
            <h1 id="identity-heading" className="text-xs uppercase tracking-[0.16em] text-[#A0A0A0]">
              Personal Identity
            </h1>
            <p className="text-[11px] text-[#555555] mt-1">
              Private local settings. These details remain personal and are not broadcast to the cosmic universe.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="field-name" className="block text-xs uppercase tracking-wider text-[#888888]">
                Display Name
              </label>
              <input
                id="field-name"
                type="text"
                maxLength={60}
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#202020] focus:border-[#555555] text-xs md:text-sm text-[#E8E8E8] placeholder-[#444444] px-3 py-2.5 outline-none rounded-none transition-colors"
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-[#444444] tabular-nums">
                  {formData.name.length} / 60
                </span>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label htmlFor="field-bio" className="block text-xs uppercase tracking-wider text-[#888888]">
                Bio
              </label>
              <textarea
                id="field-bio"
                rows={3}
                maxLength={300}
                placeholder="A short personal biography..."
                value={formData.bio}
                onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#202020] focus:border-[#555555] text-xs md:text-sm text-[#E8E8E8] placeholder-[#444444] px-3 py-2.5 outline-none rounded-none resize-y transition-colors leading-relaxed"
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-[#444444] tabular-nums">
                  {formData.bio.length} / 300
                </span>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label htmlFor="field-location" className="block text-xs uppercase tracking-wider text-[#888888]">
                Location
              </label>
              <input
                id="field-location"
                type="text"
                maxLength={80}
                placeholder="Where you see yourself"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-[#202020] focus:border-[#555555] text-xs md:text-sm text-[#E8E8E8] placeholder-[#444444] px-3 py-2.5 outline-none rounded-none transition-colors"
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-[#444444] tabular-nums">
                  {formData.location.length} / 80
                </span>
              </div>
            </div>

            {/* Save Profile Button and Status Message */}
            <div className="flex items-center gap-4 pt-1">
              <button
                type="submit"
                className="px-4 py-2 text-xs uppercase tracking-widest bg-[#141414] hover:bg-[#202020] text-[#E8E8E8] border border-[#2C2C2C] hover:border-[#444444] active:bg-[#0A0A0A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888888]"
              >
                Save Profile
              </button>

              {profileStatus && (
                <span
                  role="status"
                  className={`text-xs tracking-wider transition-opacity duration-300 ${
                    profileStatus.type === 'success' ? 'text-[#A0A0A0]' : 'text-[#FF7070]'
                  }`}
                >
                  {profileStatus.message}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Section 2: Cosmic Audio Library */}
        <AudioLibrarySection />

        {/* Section 3: Quote Management */}
        <section aria-labelledby="quotes-heading" className="space-y-6 pt-4">
          <div className="border-b border-[#161616] pb-3 flex items-baseline justify-between">
            <div>
              <h2 id="quotes-heading" className="text-xs uppercase tracking-[0.16em] text-[#A0A0A0]">
                Quote Collection
              </h2>
              <p className="text-[11px] text-[#555555] mt-1">
                Words that float and emerge across your cosmic space.
              </p>
            </div>
            <span className="text-xs text-[#777777] font-mono tabular-nums tracking-widest uppercase">
              {quotes.length} {quotes.length === 1 ? 'QUOTE' : 'QUOTES'}
            </span>
          </div>

          {/* Add a Quote Form */}
          <form onSubmit={handleAddQuote} className="space-y-3 bg-[#080808] border border-[#1A1A1A] p-4">
            <label htmlFor="new-quote-input" className="block text-xs uppercase tracking-wider text-[#888888]">
              Add a Quote
            </label>
            <textarea
              id="new-quote-input"
              rows={2}
              maxLength={280}
              placeholder="Enter an affirmation or thought to inhabit your universe..."
              value={newQuoteText}
              onChange={(e) => {
                setNewQuoteText(e.target.value);
                if (quoteAddError) setQuoteAddError(null);
              }}
              className="w-full bg-[#000000] border border-[#222222] focus:border-[#555555] text-xs md:text-sm text-[#E8E8E8] placeholder-[#444444] px-3 py-2 outline-none rounded-none resize-y transition-colors leading-relaxed"
            />

            {quoteAddError && (
              <p role="alert" className="text-xs text-[#FF7070] tracking-wide">
                {quoteAddError}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#444444] tabular-nums">
                {newQuoteText.trim().length} / 280
              </span>
              <button
                type="submit"
                disabled={!newQuoteText.trim()}
                className="px-4 py-2 text-xs uppercase tracking-widest bg-[#141414] hover:bg-[#202020] disabled:opacity-40 disabled:hover:bg-[#141414] text-[#E8E8E8] border border-[#2C2C2C] hover:border-[#444444] transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888888]"
              >
                Add Quote
              </button>
            </div>
          </form>

          {/* Quotes List */}
          <div className="space-y-0 border-t border-[#161616]">
            {quotes.map((item, idx) => {
              const isEditing = editingId === item.id;
              const isConfirmingDelete = confirmDeleteId === item.id;

              return (
                <div
                  key={item.id}
                  className="py-3.5 border-b border-[#141414] transition-colors group hover:bg-[#070707] px-2 -mx-2"
                >
                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="space-y-3 bg-[#0A0A0A] p-3 border border-[#262626]">
                      <div className="flex items-center justify-between text-[11px] text-[#777777]">
                        <span>Editing quote #{idx + 1}</span>
                        <span className="tabular-nums">{editingText.trim().length} / 280</span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={280}
                        value={editingText}
                        onChange={(e) => {
                          setEditingText(e.target.value);
                          if (editError) setEditError(null);
                        }}
                        className="w-full bg-[#000000] border border-[#333333] focus:border-[#777777] text-xs md:text-sm text-[#E8E8E8] px-3 py-2 outline-none rounded-none resize-y leading-relaxed"
                        autoFocus
                      />

                      {editError && (
                        <p role="alert" className="text-xs text-[#FF7070]">
                          {editError}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-[#888888] hover:text-[#E8E8E8] border border-transparent hover:border-[#333333] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3 py-1.5 text-[11px] uppercase tracking-wider bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#E8E8E8] border border-[#333333] hover:border-[#555555] transition-colors cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : isConfirmingDelete ? (
                    /* Delete Confirmation Prompt */
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2 px-3 bg-[#0F0F0F] border border-[#262626]">
                      <span className="text-xs text-[#A0A0A0]">
                        Permanently delete &ldquo;{item.text.length > 38 ? item.text.slice(0, 38) + '...' : item.text}&rdquo;?
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => confirmDelete(item.id)}
                          className="text-xs uppercase tracking-wider text-[#FF7070] hover:text-[#FFA0A0] transition-colors cursor-pointer font-medium"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs uppercase tracking-wider text-[#777777] hover:text-[#E8E8E8] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Display Mode */
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-[11px] text-[#444444] tabular-nums shrink-0 pt-0.5 select-none">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <p className="text-xs md:text-sm text-[#CCCCCC] leading-relaxed break-words font-normal">
                          {item.text}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5 opacity-80 sm:opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(item.id, item.text)}
                          aria-label={`Edit quote: ${item.text}`}
                          className="p-1.5 text-[#666666] hover:text-[#E8E8E8] focus-visible:text-[#E8E8E8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888888] rounded-sm transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5 stroke-[1.4]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteId(item.id);
                            setEditingId(null);
                          }}
                          aria-label={`Delete quote: ${item.text}`}
                          className="p-1.5 text-[#666666] hover:text-[#FF7070] focus-visible:text-[#FF7070] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF7070] rounded-sm transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.4]" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reset collection to original default quotes */}
          <div className="pt-6 pb-12 border-t border-[#161616] flex items-center justify-between text-xs text-[#555555]">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 text-[11px] text-[#555555] hover:text-[#888888] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore default {INITIAL_QUOTES.length} affirmations</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-[#0A0A0A] p-2.5 border border-[#202020] w-full justify-between">
                <span className="text-[11px] text-[#888888]">
                  Reset entire collection to the original {INITIAL_QUOTES.length} affirmations?
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      resetQuotesToDefaults();
                      setConfirmReset(false);
                      setEditingId(null);
                      setConfirmDeleteId(null);
                    }}
                    className="text-[11px] text-[#E8E8E8] hover:underline cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-[11px] text-[#666666] hover:text-[#888888] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
