/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const INITIAL_QUOTES: readonly string[] = [
  "Quote 1",
  "Quote 2",
  "Quote 3",
  "Quote 4",
  "Quote 5",
  "Quote 6",
  "Quote 7",
  "Quote 8",
  "Quote 9",
  "Quote 10",
  "Quote 11",
] as const;

// Backward-compatible export
export const COSMIC_QUOTES = INITIAL_QUOTES;

export interface QuoteItem {
  id: string;
  text: string;
  createdAt?: number;
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
