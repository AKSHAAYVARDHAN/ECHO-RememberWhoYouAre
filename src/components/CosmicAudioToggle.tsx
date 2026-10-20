/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Music, Sliders } from 'lucide-react';
import { useAudio } from '../context/AudioContext';

interface CosmicAudioToggleProps {
  className?: string;
  variant?: 'minimal' | 'expanded';
}

export const CosmicAudioToggle: React.FC<CosmicAudioToggleProps> = ({ className = '', variant = 'minimal' }) => {
  const {
    isPlaying,
    isMuted,
    volume,
    activeTrack,
    isLoadingTrack,
    isAutoplayBlocked,
    togglePlay,
    toggleMute,
    setVolume,
  } = useAudio();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close volume popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const soundLevelPercent = Math.round((isMuted ? 0 : volume) * 100);

  return (
    <div
      ref={containerRef}
      className={`fixed z-30 font-mono select-none ${className}`}
      style={{
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        right: 'max(16px, env(safe-area-inset-right, 16px))',
      }}
    >
      <div className="relative flex items-center gap-1.5">
        {/* Expanded Volume / Track Tooltip Drawer */}
        {isOpen && (
          <div
            role="region"
            aria-label="Cosmic Audio Controls"
            className="absolute bottom-full right-0 mb-2.5 bg-[#0A0A0A]/95 border border-[#222222] p-3 shadow-2xl backdrop-blur-md min-w-[210px] space-y-3"
          >
            {/* Active Track Title */}
            <div className="space-y-0.5 border-b border-[#181818] pb-2">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-[#666666]">
                <span>Soundtrack</span>
                <span className="text-[#888888]">{isPlaying && !isMuted ? 'PLAYING' : 'PAUSED'}</span>
              </div>
              <p
                className="text-[11px] text-[#DDDDDD] truncate max-w-[190px]"
                title={activeTrack.name}
              >
                {activeTrack.name}
              </p>
            </div>

            {/* Volume Slider Control */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-[#777777]">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="hover:text-[#CCCCCC] transition-colors cursor-pointer flex items-center gap-1"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3 h-3 text-[#FF7070]" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-[#999999]" />
                  )}
                  <span>{isMuted ? 'Muted' : 'Volume'}</span>
                </button>
                <span className="tabular-nums text-[#999999]">{soundLevelPercent}%</span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume slider"
                className="w-full h-1 bg-[#222222] rounded-none appearance-none cursor-pointer accent-[#D0D0D0]"
              />
            </div>
          </div>
        )}

        {/* Minimal Audio Status & Control Pill */}
        <div className="flex items-center bg-[#070707]/90 border border-[#1A1A1A] hover:border-[#333333] transition-colors shadow-lg backdrop-blur-xs">
          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={
              isPlaying
                ? `Pause cosmic sound (${activeTrack.name})`
                : `Play cosmic sound (${activeTrack.name})`
            }
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#888888] hover:text-[#EEEEEE] focus-visible:outline-none focus-visible:text-[#FFFFFF] transition-colors cursor-pointer group"
          >
            {isLoadingTrack ? (
              <div className="w-3 h-3 border border-[#444444] border-t-[#CCCCCC] rounded-full animate-spin" />
            ) : isPlaying && !isMuted ? (
              <span className="flex items-center gap-1.5">
                {/* Subtle sound wave animation */}
                <span className="flex items-end gap-[2px] h-3 w-3 justify-center">
                  <span className="w-[1.5px] bg-[#BBBBBB] h-2.5 animate-pulse" />
                  <span className="w-[1.5px] bg-[#999999] h-1.5 animate-pulse [animation-delay:150ms]" />
                  <span className="w-[1.5px] bg-[#CCCCCC] h-3 animate-pulse [animation-delay:300ms]" />
                </span>
                <span className="hidden sm:inline text-[10px] tracking-widest uppercase text-[#999999] group-hover:text-[#DDDDDD] max-w-[110px] truncate">
                  {activeTrack.name.length > 14 ? activeTrack.name.slice(0, 14) + '...' : activeTrack.name}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <VolumeX className="w-3.5 h-3.5 text-[#555555] group-hover:text-[#999999]" />
                <span className="hidden sm:inline text-[10px] tracking-widest uppercase text-[#555555] group-hover:text-[#888888]">
                  {isAutoplayBlocked ? 'Sound Ready' : 'Sound Off'}
                </span>
              </span>
            )}
          </button>

          {/* Volume Settings Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Audio level and soundtrack settings"
            className="px-2 py-1.5 text-[#555555] hover:text-[#CCCCCC] border-l border-[#1A1A1A] transition-colors cursor-pointer"
            title="Adjust volume"
          >
            <Sliders className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
