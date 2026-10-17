/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const INITIAL_QUOTES: readonly string[] = [
  "I remember who I am.",
  "I am becoming who I was meant to be.",
  "I trust the person I am becoming.",
  "I am here to make a difference.",
  "I am filled with ingenious ideas.",
  "I turn my vision into reality.",
  "I am capable of extraordinary growth.",
  "I trust the journey unfolding before me.",
  "I am connected to something greater than myself.",
  "I have the courage to pursue what matters.",
  "I create the future I envision.",
] as const;

// Backward-compatible export
export const COSMIC_QUOTES = INITIAL_QUOTES;

export const DEFAULT_QUOTES_VERSION = 2;

export function getDefaultsSignature(defaults: readonly string[] = INITIAL_QUOTES): string {
  return `v${DEFAULT_QUOTES_VERSION}_${defaults.length}_` + defaults.map((q) => q.trim()).join('||');
}

export type QuoteOrigin = 'default' | 'user';

export interface QuoteItem {
  id: string;
  text: string;
  createdAt?: number;
  origin?: QuoteOrigin;
  defaultIndex?: number;
  defaultId?: string;
  isEdited?: boolean;
  originalText?: string;
}

export interface ProfileData {
  name: string;
  bio: string;
  location: string;
}

export interface BoundingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ActiveQuoteInstance {
  instanceId: string;
  quoteId: string;
  quoteIndex?: number;
  text: string;
  lines: string[];
  // Exact center coordinate in pixels
  x: number;
  y: number;
  // Computed rendered dimensions
  width: number;
  height: number;
  fontSize: number;
  isWrapped: boolean;
  // Full animation-aware bounding box (including scale + drift + clearance padding)
  reservedBox: BoundingBox;
  // Subtle drift vectors (in px)
  driftX: number;
  driftY: number;
  // Gentle scale parameters
  initialScale: number;
  targetScale: number;
  exitScale: number;
  // Opacity parameters
  maxOpacity: number;
  // Timing parameters (in milliseconds)
  startTime: number;
  durationMs: number;
  fadeInFraction: number;
  fadeOutFraction: number;
}
