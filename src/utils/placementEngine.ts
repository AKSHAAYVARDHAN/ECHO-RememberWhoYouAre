/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoundingBox, ActiveQuoteInstance } from '../types/quote';

// Singleton canvas for fast, high-precision text measurement
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  maxConcurrency: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
}

export function getViewportMetrics(): ViewportMetrics {
  let width = 1200;
  let height = 800;

  if (typeof window !== 'undefined') {
    // Prefer visualViewport if available to account for mobile browser UI (e.g. address bars)
    if (window.visualViewport) {
      width = Math.round(window.visualViewport.width);
      height = Math.round(window.visualViewport.height);
    } else {
      width = window.innerWidth;
      height = window.innerHeight;
    }
    // Fallback safeguards
    if (!width || width <= 0) width = window.innerWidth || 360;
    if (!height || height <= 0) height = window.innerHeight || 640;
  }

  const isMobile = width < 600;
  const isTablet = width >= 600 && width < 1024;
  const isDesktop = width >= 1024;

  // Safe area insets (respecting mobile notches, dynamic islands, and home indicator bars)
  let safeTop = isMobile ? 32 : isTablet ? 36 : 44;
  let safeBottom = isMobile ? 32 : isTablet ? 36 : 44;
  let safeLeft = isMobile ? 16 : isTablet ? 24 : 40;
  let safeRight = isMobile ? 16 : isTablet ? 24 : 40;

  // Font sizing calibrated for crisp readability:
  let fontSize = 15.0;
  if (width < 340) {
    fontSize = 11.5;
  } else if (width < 420) {
    fontSize = 12.5;
  } else if (width < 600) {
    fontSize = 13.0;
  } else if (width < 1024) {
    fontSize = 14.5;
  } else {
    fontSize = 15.0;
  }

  // Simultaneous quote density targets:
  // Desktop: 8–12 active quotes
  // Tablet: 5–8 active quotes
  // Mobile: 3–5 active quotes
  let maxConcurrency = 10;
  if (isMobile) {
    if (height < 620) {
      // 320x568: target 3 active quotes
      maxConcurrency = 3;
    } else if (height < 780) {
      // 375x667: target 4 active quotes
      maxConcurrency = 4;
    } else {
      // 360x800, 390x844, 430x932: target 5 active quotes
      maxConcurrency = 5;
    }
  } else if (isTablet) {
    maxConcurrency = width < 850 || height < 850 ? 6 : 8;
  } else {
    // Desktop: 8-12 quotes depending on screen size
    maxConcurrency = width > 1600 ? 12 : width > 1200 ? 10 : 8;
  }

  // Clearance padding around quotes to prevent visual contact while enabling high density:
  const paddingX = isMobile ? 12 : isTablet ? 16 : 18;
  const paddingY = isMobile ? 14 : isTablet ? 15 : 16;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    safeArea: {
      top: safeTop,
      bottom: safeBottom,
      left: safeLeft,
      right: safeRight,
    },
    maxConcurrency,
    fontSize,
    paddingX,
    paddingY,
  };
}

export interface MeasuredQuote {
  width: number;
  height: number;
  lines: string[];
  isWrapped: boolean;
  fontSize: number;
}

/**
 * Calculates text width matching DOM CSS:
 * font-family: 'IBM Plex Mono', 'Space Mono', 'JetBrains Mono', monospace
 * letter-spacing: 0.035em
 */
function getLineWidth(ctx: CanvasRenderingContext2D | null, text: string, fontSize: number): number {
  const letterSpacingPx = fontSize * 0.035;

  if (!ctx) {
    const charW = fontSize * 0.61 + letterSpacingPx;
    return text.length * charW;
  }

  ctx.font = `${fontSize}px 'IBM Plex Mono', 'Space Mono', 'JetBrains Mono', ui-monospace, monospace`;

  if ('letterSpacing' in ctx) {
    try {
      (ctx as unknown as { letterSpacing: string }).letterSpacing = `${letterSpacingPx.toFixed(2)}px`;
      return ctx.measureText(text).width;
    } catch {
      // fallback below
    }
  }

  const baseW = ctx.measureText(text).width;
  const extraSpacing = Math.max(0, text.length - 1) * letterSpacingPx;
  return baseW + extraSpacing;
}

/**
 * Measures text and wraps into deliberate balanced lines
 * if it exceeds available horizontal space.
 * Prefer single-line when it fits; deliberate two-line wrap with balanced word boundaries.
 */
export function measureQuote(text: string, metrics: ViewportMetrics): MeasuredQuote {
  const ctx = getMeasureContext();
  const trimmed = text.trim();

  // Maximum usable text width: keep safe distance from screen edges
  const edgeMargin = metrics.isMobile ? 14 : metrics.paddingX * 2;
  const usableWidth = Math.max(
    140,
    metrics.width - (metrics.safeArea.left + metrics.safeArea.right + edgeMargin)
  );

  const singleLineWidth = getLineWidth(ctx, trimmed, metrics.fontSize);

  // 1. Prefer a single line when it fits comfortably within usableWidth
  if (singleLineWidth <= usableWidth) {
    const width = Math.ceil(singleLineWidth);
    const height = Math.ceil(metrics.fontSize * 1.45);
    return {
      width,
      height,
      lines: [trimmed],
      isWrapped: false,
      fontSize: metrics.fontSize,
    };
  }

  // 2. If it exceeds usableWidth: attempt deliberate 2-line wrap
  const words = trimmed.split(/\s+/);

  let bestSplitIdx = -1;
  let bestDelta = Infinity;

  for (let i = 1; i < words.length; i++) {
    const line1 = words.slice(0, i).join(' ');
    const line2 = words.slice(i).join(' ');
    const w1 = getLineWidth(ctx, line1, metrics.fontSize);
    const w2 = getLineWidth(ctx, line2, metrics.fontSize);

    if (w1 <= usableWidth && w2 <= usableWidth) {
      const delta = Math.abs(w1 - w2);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSplitIdx = i;
      }
    }
  }

  if (bestSplitIdx !== -1) {
    const line1 = words.slice(0, bestSplitIdx).join(' ');
    const line2 = words.slice(bestSplitIdx).join(' ');
    const w1 = getLineWidth(ctx, line1, metrics.fontSize);
    const w2 = getLineWidth(ctx, line2, metrics.fontSize);
    const width = Math.ceil(Math.max(w1, w2));
    const height = Math.ceil(2 * metrics.fontSize * 1.45);
    return {
      width,
      height,
      lines: [line1, line2],
      isWrapped: true,
      fontSize: metrics.fontSize,
    };
  }

  // 3. Fallback for exceptionally long custom quotes (requires 3+ lines)
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = getLineWidth(ctx, testLine, metrics.fontSize);
    if (testWidth <= usableWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  let maxW = 0;
  for (const line of lines) {
    const w = getLineWidth(ctx, line, metrics.fontSize);
    if (w > maxW) maxW = w;
  }

  const width = Math.ceil(maxW);
  const height = Math.ceil(lines.length * metrics.fontSize * 1.45);

  return {
    width,
    height,
    lines,
    isWrapped: lines.length > 1,
    fontSize: metrics.fontSize,
  };
}

/**
 * Checks if two bounding boxes intersect (with clearance).
 */
export function doBoxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Computes full animation bounding box including scale variations, drift movement, and clearance padding.
 */
export function computeReservedBox(
  cx: number,
  cy: number,
  width: number,
  height: number,
  driftX: number,
  driftY: number,
  maxScale: number,
  paddingX: number,
  paddingY: number
): { reservedBox: BoundingBox; visualBounds: BoundingBox } {
  const halfW = (width * maxScale) / 2;
  const halfH = (height * maxScale) / 2;

  // Extents across full trajectory from (cx, cy) to (cx + driftX, cy + driftY)
  const minX = Math.min(cx, cx + driftX) - halfW;
  const maxX = Math.max(cx, cx + driftX) + halfW;
  const minY = Math.min(cy, cy + driftY) - halfH;
  const maxY = Math.max(cy, cy + driftY) + halfH;

  return {
    visualBounds: {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
    },
    reservedBox: {
      left: minX - paddingX,
      right: maxX + paddingX,
      top: minY - paddingY,
      bottom: maxY + paddingY,
    },
  };
}

export interface CandidatePlacement {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  reservedBox: BoundingBox;
}

/**
 * Finds a guaranteed collision-free placement within the viewport.
 * Guarantees quotes never collide with active quotes OR the top-left profile icon,
 * and never clip off the viewport boundaries.
 */
export function findCollisionFreePlacement(
  measured: MeasuredQuote,
  activeQuotes: ActiveQuoteInstance[],
  metrics: ViewportMetrics,
  maxScale: number
): CandidatePlacement | null {
  const { width, height, safeArea, paddingX, paddingY, isMobile, isTablet } = metrics;

  // Reserved obstacle bounding box for the top-left Profile Icon:
  const profileIconReservedBox: BoundingBox = {
    left: 0,
    top: 0,
    right: Math.max(safeArea.left, 16) + 44 + paddingX,
    bottom: Math.max(safeArea.top, 20) + 44 + paddingY,
  };

  // Drift settings:
  // Mobile: zero drift prevents accidental encroachment while quotes animate fast
  // Desktop: gentle dynamic drift
  const maxDriftX = isMobile ? 0 : 14;
  const maxDriftY = isMobile ? 0 : 10;

  const candidatePoints: { x: number; y: number }[] = [];

  if (isMobile) {
    const halfW = (measured.width * maxScale) / 2;
    const halfH = (measured.height * maxScale) / 2;

    const minX = safeArea.left + halfW;
    const maxX = width - safeArea.right - halfW;
    if (minX > maxX) {
      return null;
    }

    const cx = width / 2;
    const horizontalOptions: number[] = [cx];
    // For shorter quotes, allow subtle left/right staggering
    const wiggle = (maxX - minX) * 0.28;
    if (wiggle > 14) {
      horizontalOptions.push(Math.max(minX, cx - wiggle));
      horizontalOptions.push(Math.min(maxX, cx + wiggle));
    }

    // Top vertical boundary: safely below profile icon obstacle
    const minCy = Math.max(profileIconReservedBox.bottom + halfH, safeArea.top + halfH + 8);
    // Bottom vertical boundary
    const maxCy = height - safeArea.bottom - halfH - 8;

    if (minCy > maxCy) {
      return null;
    }

    // Stratified vertical sample points across [minCy, maxCy]
    const sampleCount = 20;
    const step = (maxCy - minCy) / (sampleCount - 1 || 1);
    for (let i = 0; i < sampleCount; i++) {
      const y = minCy + i * step;
      for (const x of horizontalOptions) {
        candidatePoints.push({ x, y });
      }
    }
  } else {
    // Desktop and Tablet: Multi-column, multi-row dense sampling
    const cols = isTablet ? 6 : 9;
    const rows = isTablet ? 6 : 8;
    const usableW = width - safeArea.left - safeArea.right;
    const usableH = height - safeArea.top - safeArea.bottom;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cx = safeArea.left + ((c + 0.5) / cols) * usableW;
        const cy = safeArea.top + ((r + 0.5) / rows) * usableH;
        // Jitter by up to +/- 12px
        const jx = (Math.random() - 0.5) * 24;
        const jy = (Math.random() - 0.5) * 20;
        candidatePoints.push({ x: cx + jx, y: cy + jy });
      }
    }
  }

  // Shuffle candidate points for organic spatial variety
  for (let i = candidatePoints.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidatePoints[i], candidatePoints[j]] = [candidatePoints[j], candidatePoints[i]];
  }

  let bestCandidate: CandidatePlacement | null = null;
  let bestScore = -1;

  for (const pt of candidatePoints) {
    const driftX = (Math.random() - 0.5) * 2 * maxDriftX;
    const driftY = (Math.random() - 0.5) * 2 * maxDriftY;

    const { reservedBox, visualBounds } = computeReservedBox(
      pt.x,
      pt.y,
      measured.width,
      measured.height,
      driftX,
      driftY,
      maxScale,
      paddingX,
      paddingY
    );

    // 1. Viewport boundaries check: entire visual text must stay completely within safe bounds
    if (
      visualBounds.left < safeArea.left ||
      visualBounds.right > width - safeArea.right ||
      visualBounds.top < safeArea.top ||
      visualBounds.bottom > height - safeArea.bottom
    ) {
      continue;
    }

    // 2. Profile icon collision check: quotes must NEVER overlap or encroach upon the profile icon
    if (doBoxesIntersect(reservedBox, profileIconReservedBox)) {
      continue;
    }

    // 3. Collision check against all active quotes (visible, emerging, or fading)
    let hasCollision = false;
    let minDistanceToAny = Infinity;

    for (const active of activeQuotes) {
      if (doBoxesIntersect(reservedBox, active.reservedBox)) {
        hasCollision = true;
        break;
      }
      // Compute center-to-center distance for scoring
      const dx = pt.x - active.x;
      const dy = pt.y - active.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistanceToAny) {
        minDistanceToAny = dist;
      }
    }

    if (hasCollision) {
      continue;
    }

    // Found collision-free placement. Score by clearance distance from existing quotes.
    const score = activeQuotes.length === 0 ? 1000 : minDistanceToAny;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = {
        x: pt.x,
        y: pt.y,
        driftX,
        driftY,
        reservedBox,
      };
      // Accept high-clearance candidates immediately for speed
      if (score > (isMobile ? 120 : 160)) {
        return bestCandidate;
      }
    }
  }

  return bestCandidate;
}
