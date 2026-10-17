/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { CosmicCanvas } from './components/CosmicCanvas';
import { QuoteSpace } from './components/QuoteSpace';
import { ProfileIcon } from './components/ProfileIcon';
import { ProfilePage } from './components/ProfilePage';
import { AuthPage } from './components/AuthPage';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useApp();
  const isProfileOpen = currentPath === '/profile';
  const isAuthOpen = currentPath === '/auth';
  const isSubpageOpen = isProfileOpen || isAuthOpen;

  // Manage body scrolling: scope overflow:hidden to cosmic homepage; natural scroll for profile and auth
  useEffect(() => {
    if (isSubpageOpen) {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
    } else {
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSubpageOpen]);

  return (
    <main
      className={
        isSubpageOpen
          ? 'relative w-full min-h-screen min-h-[100dvh] bg-[#000000] text-[#E8E8E8]'
          : 'relative w-full h-screen h-[100dvh] overflow-hidden bg-[#000000] select-none cursor-default'
      }
      role="region"
      aria-label="ECHO — Remember Who You Are."
    >
      {/* 1. Pure Black Universe with Tiny Twinkling White Stars & Galaxies (Running in Viewport) */}
      <CosmicCanvas />

      {/* 2. Multiple Monospaced Quotes Floating Simultaneously with Collision-Free Placement */}
      {!isSubpageOpen && <QuoteSpace />}

      {/* 3. Small Discreet Profile / Auth Icon in Top-Left Corner on Cosmic Homepage */}
      {!isSubpageOpen && (
        <ProfileIcon onNavigate={() => navigate('/profile')} />
      )}

      {/* 4. Discreet Branding in Top-Right Corner on Cosmic Homepage */}
      {!isSubpageOpen && (
        <header
          className="fixed z-20 pointer-events-none select-none text-right font-mono"
          style={{
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            right: 'max(16px, env(safe-area-inset-right, 16px))',
          }}
        >
          <h1 className="text-xs sm:text-sm tracking-[0.26em] uppercase text-[#D8D8D8] font-normal leading-tight">
            ECHO
          </h1>
        </header>
      )}

      {/* 5. Dedicated Profile Management Page */}
      {isProfileOpen && (
        <ProfilePage
          onBack={() => navigate('/')}
          onNavigateAuth={() => navigate('/auth')}
        />
      )}

      {/* 5. Dedicated Authentication Page with Google Sign-In */}
      {isAuthOpen && (
        <AuthPage
          onBack={() => navigate('/')}
          onSuccessNavigate={() => navigate('/profile')}
        />
      )}
    </main>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
