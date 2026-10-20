/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import {
  AudioTrack,
  DEFAULT_TRACK,
  MAX_AUDIO_FILE_SIZE_BYTES,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_AUDIO_MIME_TYPES,
} from '../types/audio';
import {
  saveAudioRecord,
  getAudioRecordsForUser,
  getAudioBlob,
  deleteAudioRecord,
} from '../utils/audioStorage';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface AudioContextType {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  activeTrack: AudioTrack;
  tracks: AudioTrack[];
  isLoadingTrack: boolean;
  isAutoplayBlocked: boolean;
  playbackError: string | null;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (level: number) => void;
  selectTrack: (trackId: string, autoPlay?: boolean) => Promise<void>;
  uploadTrack: (file: File) => Promise<{ success: boolean; error?: string; track?: AudioTrack }>;
  deleteTrack: (trackId: string) => Promise<{ success: boolean; error?: string }>;
  clearPlaybackError: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

function selectedTrackStorageKey(uid?: string | null): string {
  return uid ? `echo_selected_track_${uid}` : 'echo_selected_track_guest';
}

function audioEnabledStorageKey(uid?: string | null): string {
  return uid ? `echo_audio_enabled_${uid}` : 'echo_audio_enabled_guest';
}

const VOLUME_STORAGE_KEY = 'echo_audio_volume';
const MUTED_STORAGE_KEY = 'echo_audio_muted';

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const currentUid = user?.uid ?? null;

  // Persistent HTMLAudioElement
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);

  const [tracks, setTracks] = useState<AudioTrack[]>([DEFAULT_TRACK]);
  const [activeTrack, setActiveTrack] = useState<AudioTrack>(DEFAULT_TRACK);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.65;
    try {
      const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (stored !== null) {
        const val = parseFloat(stored);
        if (!isNaN(val) && val >= 0 && val <= 1) return val;
      }
    } catch {
      // ignore
    }
    return 0.65;
  });
  const [isLoadingTrack, setIsLoadingTrack] = useState<boolean>(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState<boolean>(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Initialize Audio element once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = volume;
    audio.muted = isMuted;
    audioRef.current = audio;

    const onPlay = () => {
      setIsPlaying(true);
      setIsAutoplayBlocked(false);
      setPlaybackError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onError = () => {
      if (audio.error && audio.src) {
        console.warn('Audio playback error:', audio.error);
        setIsPlaying(false);
        setPlaybackError('Unable to play audio. The format may not be supported by this browser.');
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    };
  }, []);

  // Update volume and mute on the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, String(isMuted));
    } catch {
      // ignore
    }
  }, [isMuted]);

  // Load tracks list for current user (combining IndexedDB and Firestore when authenticated)
  useEffect(() => {
    let isMounted = true;

    async function loadTracks() {
      try {
        // 1. Load from local IndexedDB
        const localRecords = await getAudioRecordsForUser(currentUid);
        const mappedLocal: AudioTrack[] = localRecords.map((r) => ({
          id: r.id,
          name: r.name,
          filename: r.filename,
          size: r.size,
          type: r.type,
          createdAt: r.createdAt,
          userId: r.userId,
          isDefault: false,
        }));

        // 2. If authenticated, also fetch metadata from Firestore
        let remoteTracks: AudioTrack[] = [];
        if (currentUid && db) {
          try {
            const tracksRef = collection(db, 'users', currentUid, 'audioTracks');
            const snap = await getDocs(tracksRef);
            if (!snap.empty) {
              remoteTracks = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: data.id || d.id,
                  name: data.name || 'Custom Track',
                  filename: data.filename || 'audio.mp3',
                  size: data.size || 0,
                  type: data.type || 'audio/mpeg',
                  createdAt: data.createdAt || Date.now(),
                  userId: currentUid,
                  isDefault: false,
                };
              });
            }
          } catch (err) {
            console.warn('Could not fetch Firestore audio tracks:', err);
          }
        }

        // Merge unique by ID (local takes precedence since it contains the actual Blob)
        const trackMap = new Map<string, AudioTrack>();
        mappedLocal.forEach((t) => trackMap.set(t.id, t));
        remoteTracks.forEach((t) => {
          if (!trackMap.has(t.id)) {
            trackMap.set(t.id, t);
          }
        });

        if (!isMounted) return;

        const merged = [DEFAULT_TRACK, ...Array.from(trackMap.values())];
        setTracks(merged);

        // Restore previously selected track
        let preferredTrackId = DEFAULT_TRACK.id;
        try {
          const savedId = localStorage.getItem(selectedTrackStorageKey(currentUid));
          if (savedId && merged.some((t) => t.id === savedId)) {
            preferredTrackId = savedId;
          }
        } catch {
          // ignore
        }

        const target = merged.find((t) => t.id === preferredTrackId) || DEFAULT_TRACK;
        await setupAudioSource(target, false);
      } catch (err) {
        console.warn('Error loading audio tracks:', err);
      }
    }

    loadTracks();

    return () => {
      isMounted = false;
    };
  }, [currentUid]);

  // Load a track's source into audioRef
  const setupAudioSource = async (track: AudioTrack, shouldPlay = false): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;

    setIsLoadingTrack(true);
    setPlaybackError(null);

    try {
      // Pause current playback
      audio.pause();

      // Revoke prior Object URL if any
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      if (track.isDefault || track.id === DEFAULT_TRACK.id) {
        audio.src = DEFAULT_TRACK.url || '/assets/aistudio/Echo-audio_1890da38.mp3';
      } else {
        // Fetch from IndexedDB
        const blob = await getAudioBlob(track.id);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrlRef.current = blobUrl;
          audio.src = blobUrl;
        } else {
          // If blob is missing on this device (e.g. metadata synced from another device)
          setPlaybackError(`Audio file "${track.filename}" is not stored on this device.`);
          setIsLoadingTrack(false);
          return false;
        }
      }

      audio.load();
      setActiveTrack(track);

      // Save preference
      try {
        localStorage.setItem(selectedTrackStorageKey(currentUid), track.id);
      } catch {
        // ignore
      }

      setIsLoadingTrack(false);

      if (shouldPlay) {
        try {
          await audio.play();
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          try {
            localStorage.setItem(audioEnabledStorageKey(currentUid), 'true');
          } catch {
            // ignore
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'NotAllowedError') {
            setIsAutoplayBlocked(true);
            setIsPlaying(false);
          } else {
            console.warn('Playback error:', err);
            setPlaybackError('Could not start playback.');
          }
        }
      }

      return true;
    } catch (err) {
      console.warn('Failed to load track source:', err);
      setIsLoadingTrack(false);
      setPlaybackError('Failed to load track source.');
      return false;
    }
  };

  // Switch to another track
  const selectTrack = useCallback(
    async (trackId: string, autoPlay = true) => {
      const target = tracks.find((t) => t.id === trackId) || DEFAULT_TRACK;
      const wasPlaying = isPlaying || autoPlay;
      await setupAudioSource(target, wasPlaying);
    },
    [tracks, isPlaying, currentUid]
  );

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      try {
        localStorage.setItem(audioEnabledStorageKey(currentUid), 'false');
      } catch {
        // ignore
      }
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsAutoplayBlocked(false);
          setPlaybackError(null);
          try {
            localStorage.setItem(audioEnabledStorageKey(currentUid), 'true');
          } catch {
            // ignore
          }
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'NotAllowedError') {
            setIsAutoplayBlocked(true);
          } else {
            console.warn('Playback error:', err);
            setPlaybackError('Audio could not be started.');
          }
        });
    }
  }, [isPlaying, currentUid]);

  // Handle global unlock if autoplay was blocked
  useEffect(() => {
    if (!isAutoplayBlocked) return;

    const unlockAudio = () => {
      const audio = audioRef.current;
      if (audio && audio.paused) {
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsAutoplayBlocked(false);
          })
          .catch(() => {
            // user will manually click toggle
          });
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [isAutoplayBlocked]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Set Volume
  const setVolume = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // Upload a personal track
  const uploadTrack = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string; track?: AudioTrack }> => {
      // 1. Validation: file size
      if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
        return {
          success: false,
          error: `Audio file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`,
        };
      }

      // 2. Validation: format / extension
      const lowerName = file.name.toLowerCase();
      const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
      const hasValidMime = file.type ? SUPPORTED_AUDIO_MIME_TYPES.includes(file.type.toLowerCase()) : false;

      if (!hasValidExt && !hasValidMime) {
        return {
          success: false,
          error: `Unsupported audio format. Please upload MP3, WAV, M4A, AAC, or OGG.`,
        };
      }

      try {
        const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        // Clean display name (strip extension, trim, limit length)
        const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
        const displayName = (baseName.length > 60 ? baseName.substring(0, 60) + '...' : baseName) || 'Custom Track';

        const metadata = {
          id: trackId,
          userId: currentUid,
          name: displayName,
          filename: file.name,
          size: file.size,
          type: file.type || 'audio/mpeg',
          createdAt: Date.now(),
        };

        // Save binary blob to IndexedDB
        await saveAudioRecord(metadata, file);

        // If authenticated, also sync metadata to Firestore
        if (currentUid && db) {
          try {
            const trackDocRef = doc(db, 'users', currentUid, 'audioTracks', trackId);
            await setDoc(trackDocRef, metadata);
          } catch (firestoreErr) {
            console.warn('Could not sync track metadata to Firestore:', firestoreErr);
            // Non-fatal for client: local IndexedDB is preserved
          }
        }

        const newTrack: AudioTrack = {
          ...metadata,
          isDefault: false,
        };

        setTracks((prev) => [newTrack, ...prev.filter((t) => t.id !== newTrack.id)]);

        // Automatically switch and play the newly uploaded track
        await setupAudioSource(newTrack, true);

        return { success: true, track: newTrack };
      } catch (err) {
        console.error('Audio upload error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save audio file to library.',
        };
      }
    },
    [currentUid]
  );

  // Delete a track
  const deleteTrack = useCallback(
    async (trackId: string): Promise<{ success: boolean; error?: string }> => {
      if (trackId === DEFAULT_TRACK.id) {
        return { success: false, error: 'Cannot delete the default cosmic soundtrack.' };
      }

      try {
        // Delete from IndexedDB
        await deleteAudioRecord(trackId);

        // If authenticated, delete from Firestore
        if (currentUid && db) {
          try {
            const trackDocRef = doc(db, 'users', currentUid, 'audioTracks', trackId);
            await deleteDoc(trackDocRef);
          } catch (firestoreErr) {
            console.warn('Could not delete from Firestore:', firestoreErr);
          }
        }

        // If active track is the one deleted, switch back to DEFAULT_TRACK immediately
        if (activeTrack.id === trackId) {
          await setupAudioSource(DEFAULT_TRACK, isPlaying);
        }

        setTracks((prev) => prev.filter((t) => t.id !== trackId));

        return { success: true };
      } catch (err) {
        console.error('Delete track error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to delete audio track.',
        };
      }
    },
    [activeTrack, isPlaying, currentUid]
  );

  const clearPlaybackError = useCallback(() => {
    setPlaybackError(null);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isMuted,
        volume,
        activeTrack,
        tracks,
        isLoadingTrack,
        isAutoplayBlocked,
        playbackError,
        togglePlay,
        toggleMute,
        setVolume,
        selectTrack,
        uploadTrack,
        deleteTrack,
        clearPlaybackError,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
