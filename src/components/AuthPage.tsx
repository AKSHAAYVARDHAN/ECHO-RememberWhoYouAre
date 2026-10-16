/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, LogOut, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  onBack: () => void;
  onSuccessNavigate?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBack, onSuccessNavigate }) => {
  const { user, loading, isSigningIn, authError, authErrorCode, signInWithGoogle, signOutUser, clearAuthError } =
    useAuth();
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const handleGoogleSignIn = async (preferRedirect = false) => {
    clearAuthError();
    const result = await signInWithGoogle(preferRedirect);
    if (result.success && onSuccessNavigate) {
      onSuccessNavigate();
    }
  };

  return (
    <div className="relative z-30 w-full min-h-screen min-h-[100dvh] bg-[#000000] text-[#E8E8E8] font-mono selection:bg-[#222222] selection:text-[#FFFFFF] flex flex-col justify-between">
      {/* Top Bar with Back Button */}
      <header className="sticky top-0 z-40 bg-[#000000]/90 backdrop-blur-xs border-b border-[#141414] px-4 md:px-8 py-3.5 flex items-center justify-between">
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

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bg-[#080808] border border-[#1A1A1A] p-6 sm:p-8 space-y-8 shadow-2xl relative">
          {/* Subtle Corner Accents */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#444444]" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#444444]" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#444444]" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#444444]" />

          {/* Brand Header */}
          <div className="text-center space-y-2">
            <h1 className="text-xl sm:text-2xl tracking-[0.3em] uppercase text-[#EDEDED] font-normal">
              EXIF
            </h1>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#666666]">
              The Soul Within
            </p>
            <div className="w-8 h-[1px] bg-[#222222] mx-auto mt-3" />
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-5 h-5 border-2 border-[#333333] border-t-[#CCCCCC] rounded-full animate-spin" />
              <span className="text-[11px] tracking-widest uppercase text-[#555555]">
                Initialising Authentication...
              </span>
            </div>
          ) : user ? (
            /* Already Signed-In State */
            <div className="space-y-6">
              <div className="bg-[#0D0D0D] border border-[#222222] p-4 flex items-center gap-3.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-11 h-11 rounded-full border border-[#333333] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[#888888]">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#E8E8E8] truncate">
                      {user.displayName || 'Affirmation Keeper'}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#66AA66] shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#777777] truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-[#777777] leading-relaxed text-center">
                Signed in with Google. Your personal affirmations and identity settings are synchronized with your cosmic universe.
              </p>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full py-2.5 px-4 text-xs tracking-widest uppercase bg-[#141414] hover:bg-[#202020] text-[#E8E8E8] border border-[#2A2A2A] hover:border-[#444444] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  Return to Universe
                </button>

                <button
                  type="button"
                  onClick={signOutUser}
                  className="w-full py-2 px-4 text-[11px] tracking-widest uppercase text-[#888888] hover:text-[#FF7070] border border-transparent hover:border-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign-In Options */
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xs uppercase tracking-[0.16em] text-[#AAAAAA]">
                  Identity Authentication
                </h2>
                <p className="text-[11px] text-[#555555] leading-relaxed">
                  Sign in to preserve your custom affirmations and personal profile across devices.
                </p>
              </div>

              {/* Primary Action: Continue with Google */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(false)}
                  disabled={isSigningIn}
                  aria-label="Continue with Google"
                  className="w-full relative group py-3 px-4 bg-[#FFFFFF] hover:bg-[#F2F2F2] active:bg-[#E5E5E5] text-[#1F1F1F] text-xs font-medium tracking-wider flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait shadow-sm rounded-none border border-transparent"
                >
                  {isSigningIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#666666] border-t-[#000000] rounded-full animate-spin shrink-0" />
                      <span className="tracking-widest uppercase text-[11px]">Connecting...</span>
                    </>
                  ) : (
                    <>
                      {/* Official Google G Logo SVG */}
                      <svg
                        className="w-4 h-4 shrink-0"
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
                      <span className="font-sans font-medium text-[13px] text-[#1F1F1F]">
                        Continue with Google
                      </span>
                    </>
                  )}
                </button>

                {/* Mobile / Popup Blocked Fallback Link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleGoogleSignIn(true)}
                    disabled={isSigningIn}
                    className="text-[10px] uppercase tracking-wider text-[#666666] hover:text-[#999999] transition-colors cursor-pointer"
                  >
                    If popup is blocked: Continue via Redirect &rarr;
                  </button>
                </div>
              </div>

              {/* Error Notification */}
              {authError && (
                <div
                  role="alert"
                  className="bg-[#120808] border border-[#3A1414] p-3 text-xs text-[#FF8585] space-y-2 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#FF6060] shrink-0 mt-0.5" />
                    <p className="leading-relaxed flex-1">{authError}</p>
                  </div>

                  {authErrorCode === 'auth/unauthorized-domain' && (
                    <div className="pt-2 border-t border-[#331515] text-[11px] text-[#CCCCCC] space-y-1.5">
                      <p className="font-semibold text-[#FF9999]">How to authorize this domain:</p>
                      <ol className="list-decimal list-inside space-y-1 text-[#AAAAAA]">
                        <li>Open your Firebase Console.</li>
                        <li>Navigate to Authentication &rarr; Settings &rarr; Authorized domains.</li>
                        <li>
                          Add domain: <span className="text-[#FFFFFF] underline">{window.location.hostname}</span>
                        </li>
                      </ol>
                    </div>
                  )}

                  {authErrorCode === 'auth/operation-not-allowed' && (
                    <div className="pt-2 border-t border-[#331515] text-[11px] text-[#CCCCCC] space-y-1.5">
                      <p className="font-semibold text-[#FF9999]">How to enable Google Sign-In:</p>
                      <ol className="list-decimal list-inside space-y-1 text-[#AAAAAA]">
                        <li>Open your Firebase Console.</li>
                        <li>Go to Authentication &rarr; Sign-in method.</li>
                        <li>Click Google, enable the toggle, select support email, and Save.</li>
                      </ol>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleGoogleSignIn(false)}
                      className="text-[#E8E8E8] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={clearAuthError}
                      className="text-[#888888] hover:text-[#CCCCCC] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Subtle divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#181818]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-[#080808] px-3 text-[#444444] tracking-widest">
                    OR
                  </span>
                </div>
              </div>

              {/* Guest / Offline Mode Note */}
              <div className="text-center space-y-2">
                <p className="text-[11px] text-[#555555] leading-relaxed">
                  You can also continue using EXIF anonymously. Your affirmations and profile remain stored locally in your browser.
                </p>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-xs text-[#888888] hover:text-[#CCCCCC] tracking-wider uppercase underline underline-offset-4 cursor-pointer"
                >
                  Continue as Guest &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-6 text-center border-t border-[#101010] text-[10px] uppercase tracking-widest text-[#444444]">
        EXIF · The Soul Within · Secure Cloud Authentication
      </footer>
    </div>
  );
};
