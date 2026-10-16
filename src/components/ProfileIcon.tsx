/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from 'lucide-react';

interface ProfileIconProps {
  onNavigate: () => void;
}

export const ProfileIcon: React.FC<ProfileIconProps> = ({ onNavigate }) => {
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label="Manage profile and quotes"
      className="fixed z-20 flex items-center justify-center w-9 h-9 p-2 rounded-sm text-[#555555] hover:text-[#E8E8E8] focus-visible:text-[#E8E8E8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#666666] transition-colors duration-200 cursor-pointer select-none"
      style={{
        top: 'max(16px, env(safe-area-inset-top, 16px))',
        left: 'max(16px, env(safe-area-inset-left, 16px))',
      }}
    >
      <User className="w-4 h-4 stroke-[1.4]" aria-hidden="true" />
    </button>
  );
};
