/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfileIconProps {
  onNavigate: () => void;
}

export const ProfileIcon: React.FC<ProfileIconProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={user ? `Signed in as ${user.displayName || user.email}. Manage profile and affirmations` : 'Manage profile and affirmations'}
      className="fixed z-20 flex items-center justify-center w-9 h-9 p-1.5 rounded-sm text-[#666666] hover:text-[#E8E8E8] focus-visible:text-[#E8E8E8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#666666] transition-colors duration-200 cursor-pointer select-none"
      style={{
        top: 'max(16px, env(safe-area-inset-top, 16px))',
        left: 'max(16px, env(safe-area-inset-left, 16px))',
      }}
    >
      {user?.photoURL ? (
        <img
          src={user.photoURL}
          alt={user.displayName || 'User profile'}
          className="w-5 h-5 rounded-full border border-[#444444] object-cover hover:border-[#888888] transition-colors"
          referrerPolicy="no-referrer"
        />
      ) : (
        <User className="w-4 h-4 stroke-[1.4]" aria-hidden="true" />
      )}
    </button>
  );
};
