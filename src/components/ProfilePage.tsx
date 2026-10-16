/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Trash2, Check, X, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProfileData } from '../types/quote';

interface ProfilePageProps {
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const {
    profile,
    updateProfile,
    quotes,
    addQuote,
    editQuote,
    deleteQuote,
    resetQuotesToDefaults,
  } = useApp();

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
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);

    const result = updateProfile(formData);
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
  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteAddError(null);

    const result = addQuote(newQuoteText);
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
  const handleSaveEdit = (id: string) => {
    setEditError(null);
    const result = editQuote(id, editingText);
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
  const confirmDelete = (id: string) => {
    deleteQuote(id);
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
            EXIF
          </span>
          <span className="hidden sm:inline text-[10px] tracking-[0.14em] text-[#444444]">
            · The Soul Within
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-16">
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
                placeholder="City, Country or Coordinates"
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

        {/* Section 2: Quote Management */}
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

          {/* Reset collection to original 11 quotes */}
          <div className="pt-6 pb-12 border-t border-[#161616] flex items-center justify-between text-xs text-[#555555]">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 text-[11px] text-[#555555] hover:text-[#888888] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore default 11 affirmations</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-[#0A0A0A] p-2.5 border border-[#202020] w-full justify-between">
                <span className="text-[11px] text-[#888888]">
                  Reset entire collection to the original 11 affirmations?
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
