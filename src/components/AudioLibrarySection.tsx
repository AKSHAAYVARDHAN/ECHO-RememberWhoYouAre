/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Music,
  Upload,
  Play,
  Pause,
  Trash2,
  Check,
  Volume2,
  VolumeX,
  AlertCircle,
  FileAudio,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import {
  AudioTrack,
  DEFAULT_TRACK,
  formatFileSize,
  SUPPORTED_AUDIO_EXTENSIONS,
} from '../types/audio';

export const AudioLibrarySection: React.FC = () => {
  const { user } = useAuth();
  const {
    tracks,
    activeTrack,
    isPlaying,
    isMuted,
    volume,
    isLoadingTrack,
    playbackError,
    togglePlay,
    toggleMute,
    setVolume,
    selectTrack,
    uploadTrack,
    deleteTrack,
    clearPlaybackError,
  } = useAudio();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    const res = await uploadTrack(file);
    setIsUploading(false);

    if (res.success && res.track) {
      setUploadSuccess(`"${res.track.name}" added and activated.`);
      const t = setTimeout(() => setUploadSuccess(null), 4000);
      return () => clearTimeout(t);
    } else {
      setUploadError(res.error || 'Failed to upload audio file.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
    // reset input value so re-uploading the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleDelete = async (trackId: string) => {
    const res = await deleteTrack(trackId);
    if (!res.success) {
      setUploadError(res.error || 'Failed to delete track.');
    }
    setConfirmDeleteId(null);
  };

  return (
    <section aria-labelledby="audio-library-heading" className="space-y-6 pt-4 font-mono">
      {/* Section Header */}
      <div className="border-b border-[#161616] pb-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <h2 id="audio-library-heading" className="text-xs uppercase tracking-[0.16em] text-[#A0A0A0] flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-[#888888]" />
            Cosmic Soundtrack & Audio Library
          </h2>
          <p className="text-[11px] text-[#555555] mt-1">
            Immersive ambient sound that loops continuously through your universe.
          </p>
        </div>
        <span className="text-xs text-[#777777] font-mono tabular-nums tracking-widest uppercase">
          {tracks.length} {tracks.length === 1 ? 'TRACK' : 'TRACKS'}
        </span>
      </div>

      {/* Playback Error Banner if any */}
      {playbackError && (
        <div className="bg-[#140808] border border-[#3A1414] p-3 text-xs text-[#FF8585] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{playbackError}</span>
          </div>
          <button
            type="button"
            onClick={clearPlaybackError}
            className="text-[11px] underline text-[#AAAAAA] hover:text-[#FFFFFF] cursor-pointer ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Currently Active Track Card & Controls */}
      <div className="bg-[#080808] border border-[#1A1A1A] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoadingTrack}
              aria-label={isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
              className="w-11 h-11 bg-[#141414] hover:bg-[#202020] active:bg-[#0A0A0A] border border-[#2B2B2B] hover:border-[#555555] flex items-center justify-center text-[#E8E8E8] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isLoadingTrack ? (
                <div className="w-4 h-4 border-2 border-[#444444] border-t-[#CCCCCC] rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current stroke-none" />
              ) : (
                <Play className="w-4 h-4 fill-current stroke-none ml-0.5" />
              )}
            </button>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-[#E8E8E8]">
                  {activeTrack.name}
                </span>
                {activeTrack.isDefault ? (
                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#141414] text-[#888888] border border-[#262626]">
                    Built-in
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-[#0F1E14] text-[#66BB66] border border-[#1E3824]">
                    Custom
                  </span>
                )}
                {isPlaying && (
                  <span className="inline-flex items-center gap-1 text-[9px] text-[#66BB66] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#66BB66] animate-pulse" />
                    Now Playing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#555555]">
                {activeTrack.filename} {activeTrack.size ? `· ${formatFileSize(activeTrack.size)}` : ''} · Continuous Loop
              </p>
            </div>
          </div>

          {/* Master Volume Slider */}
          <div className="flex items-center gap-3 w-full sm:w-auto sm:border-l sm:border-[#1A1A1A] sm:pl-4 justify-between sm:justify-end">
            <button
              type="button"
              onClick={toggleMute}
              className="text-[#777777] hover:text-[#CCCCCC] transition-colors cursor-pointer"
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#FF7070]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Master volume level"
                className="w-28 sm:w-24 h-1 bg-[#222222] appearance-none cursor-pointer accent-[#D0D0D0]"
              />
              <span className="text-[10px] text-[#666666] tabular-nums w-8 text-right">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="space-y-3">
        <label className="block text-xs uppercase tracking-wider text-[#888888]">
          Upload Personal Audio
        </label>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[#888888] bg-[#111111]'
              : 'border-[#262626] hover:border-[#444444] bg-[#070707] hover:bg-[#0A0A0A]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="w-9 h-9 rounded-full bg-[#121212] border border-[#222222] flex items-center justify-center text-[#888888]">
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-[#444444] border-t-[#CCCCCC] rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-[#CCCCCC]">
                {isUploading ? 'Encoding & storing track...' : 'Click or drag & drop audio track'}
              </p>
              <p className="text-[10px] text-[#555555]">
                Supports {SUPPORTED_AUDIO_EXTENSIONS.join(', ')} · Up to 25 MB
              </p>
            </div>
          </div>
        </div>

        {/* User Auth Guidance Note */}
        {!user && (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-2.5 flex items-start gap-2 text-[11px] text-[#777777]">
            <Radio className="w-3.5 h-3.5 text-[#555555] shrink-0 mt-0.5" />
            <span>
              <strong>Local Mode:</strong> Tracks uploaded while signed out are stored locally in this browser.
              Sign in with Google to synchronize your audio collection across devices.
            </span>
          </div>
        )}

        {/* Upload Status Feedback */}
        {uploadError && (
          <p role="alert" className="text-xs text-[#FF7070] tracking-wide">
            {uploadError}
          </p>
        )}
        {uploadSuccess && (
          <p role="status" className="text-xs text-[#66BB66] tracking-wide flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            {uploadSuccess}
          </p>
        )}
      </div>

      {/* Available Tracks Library Table */}
      <div className="space-y-2 pt-2">
        <label className="block text-xs uppercase tracking-wider text-[#888888]">
          Available Soundtracks ({tracks.length})
        </label>

        <div className="border-t border-[#161616]">
          {tracks.map((track, idx) => {
            const isActive = activeTrack.id === track.id;
            const isConfirmingDelete = confirmDeleteId === track.id;

            return (
              <div
                key={track.id}
                className={`py-3.5 border-b border-[#141414] transition-colors group px-2 -mx-2 ${
                  isActive ? 'bg-[#0A0A0A]' : 'hover:bg-[#070707]'
                }`}
              >
                {isConfirmingDelete ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-1.5 px-3 bg-[#0F0F0F] border border-[#262626]">
                    <span className="text-xs text-[#A0A0A0]">
                      Delete soundtrack &ldquo;{track.name}&rdquo;?
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(track.id)}
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
                  <div className="flex items-center justify-between gap-4">
                    {/* Track info & select trigger */}
                    <div
                      onClick={() => selectTrack(track.id, true)}
                      className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <span className="text-[11px] text-[#444444] tabular-nums shrink-0 select-none">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <div className="w-7 h-7 bg-[#141414] border border-[#222222] flex items-center justify-center shrink-0 text-[#888888] group-hover:text-[#CCCCCC]">
                        {isActive && isPlaying ? (
                          <div className="flex items-end gap-[1.5px] h-3 w-2.5 justify-center">
                            <span className="w-[1.5px] bg-[#66BB66] h-2.5 animate-pulse" />
                            <span className="w-[1.5px] bg-[#66BB66] h-1.5 animate-pulse [animation-delay:150ms]" />
                            <span className="w-[1.5px] bg-[#66BB66] h-3 animate-pulse [animation-delay:300ms]" />
                          </div>
                        ) : (
                          <FileAudio className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs md:text-sm leading-normal truncate ${
                              isActive ? 'text-[#FFFFFF] font-medium' : 'text-[#CCCCCC]'
                            }`}
                          >
                            {track.name}
                          </p>
                          {track.isDefault && (
                            <span className="px-1.5 py-0.2 text-[8px] uppercase tracking-wider bg-[#161616] text-[#777777] border border-[#242424] shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#555555] truncate">
                          {track.filename} {track.size ? `· ${formatFileSize(track.size)}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={() => (isPlaying ? togglePlay() : selectTrack(track.id, true))}
                          className="px-2.5 py-1 text-[10px] uppercase tracking-wider bg-[#102010] text-[#66BB66] border border-[#1E3824] flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#66BB66]" />
                          <span>{isPlaying ? 'Active · Playing' : 'Active · Paused'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectTrack(track.id, true)}
                          className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#777777] hover:text-[#E8E8E8] border border-[#202020] hover:border-[#444444] transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      )}

                      {!track.isDefault && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(track.id)}
                          aria-label={`Delete soundtrack: ${track.name}`}
                          className="p-1.5 text-[#555555] hover:text-[#FF7070] transition-colors cursor-pointer"
                          title="Delete track"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[1.4]" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
