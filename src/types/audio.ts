/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioTrack {
  id: string;
  name: string;
  filename: string;
  url?: string;
  size?: number;
  type?: string;
  createdAt?: number;
  isDefault?: boolean;
  userId?: string | null;
}

export const DEFAULT_TRACK: AudioTrack = {
  id: 'default',
  name: 'Celestial Drift (Default)',
  filename: 'Echo-audio_1890da38.mp3',
  url: '/assets/aistudio/Echo-audio_1890da38.mp3',
  isDefault: true,
  userId: null,
};

export const MAX_AUDIO_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max limit

export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

export function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
