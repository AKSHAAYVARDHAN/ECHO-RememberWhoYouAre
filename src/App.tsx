/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { CosmicCanvas } from './components/CosmicCanvas';
import { QuoteSpace } from './components/QuoteSpace';
import { ProfileIcon } from './components/ProfileIcon';
import { ProfilePage } from './components/ProfilePage';
import { AppProvider, useApp } from './context/AppContext';

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useApp();
  const isProfileOpen = currentPath === '/profile';

  // Manage body scrolling: scope overflow:hidden to homepage only; enable natural document scroll for profile
  useEffect(() => {
    if (isProfileOpen) {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
    } else {
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isProfileOpen]);

  return (
    <main
      className={
        isProfileOpen
          ? 'relative w-full min-h-screen min-h-[100dvh] bg-[#000000] text-[#E8E8E8]'
          : 'relative w-full h-screen h-[100dvh] overflow-hidden bg-[#000000] select-none cursor-default'
      }
      role="region"
      aria-label="EXIF - The Soul Within"
    >
      {/* 1. Pure Black Universe with Tiny Twinkling White Stars (Persistently Running in Viewport) */}
      <CosmicCanvas />

      {/* 2. Multiple Monospaced Quotes Floating Simultaneously with Collision-Free Placement */}
      <QuoteSpace />

      {/* 3. Small Discreet Profile Icon in Top-Left Corner on Cosmic Homepage */}
      {!isProfileOpen && (
        <ProfileIcon onNavigate={() => navigate('/profile')} />
      )}

      {/* 4. Dedicated Profile Management Page (Permits natural vertical scrolling of all content) */}
      {isProfileOpen && (
        <ProfilePage onBack={() => navigate('/')} />
      )}
    </main>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
