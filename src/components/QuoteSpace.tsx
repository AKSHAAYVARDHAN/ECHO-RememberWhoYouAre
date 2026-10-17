/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveQuoteInstance, QuoteItem } from '../types/quote';
import {
  getViewportMetrics,
  measureQuote,
  findCollisionFreePlacement,
  computeReservedBox,
  ViewportMetrics,
} from '../utils/placementEngine';
import { CosmicQuote } from './CosmicQuote';
import { useApp } from '../context/AppContext';

// Fisher-Yates array shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const QuoteSpace: React.FC = () => {
  const { quotes } = useApp();
  const [activeQuotes, setActiveQuotes] = useState<ActiveQuoteInstance[]>([]);

  // Stable references for scheduler loop
  const quotesRef = useRef<QuoteItem[]>(quotes);
  const poolRef = useRef<string[]>([]);
  const lastQuoteIdRef = useRef<string | null>(null);
  const activeQuotesRef = useRef<ActiveQuoteInstance[]>([]);
  const nextSpawnTimeoutRef = useRef<number | null>(null);
  const instanceCounterRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Keep quotesRef up to date with live quotes collection and allow obsolete visible quotes to fade away gracefully
  useEffect(() => {
    quotesRef.current = quotes;
    const currentQuotesMap = new Map(quotes.map((q) => [q.id, q]));
    poolRef.current = poolRef.current.filter((id) => currentQuotesMap.has(id));

    // When the collection changes, allow obsolete visible quotes to fade away gracefully:
    // Any active quote whose ID was deleted, or whose text changed in the collection,
    // transitions smoothly into its fade-out phase.
    setActiveQuotes((prevActive) => {
      if (prevActive.length === 0) return prevActive;
      const now = performance.now();
      let hasChanges = false;

      const updated = prevActive.map((instance) => {
        const liveQuote = currentQuotesMap.get(instance.quoteId);
        const isObsolete = !liveQuote || liveQuote.text !== instance.text;

        if (isObsolete) {
          const elapsed = now - instance.startTime;
          const currentProgress = elapsed / instance.durationMs;

          if (currentProgress < instance.fadeOutFraction) {
            hasChanges = true;
            const gracefulFadeDurationMs = 1800;
            const remainingFraction = Math.max(0.01, 1 - instance.fadeOutFraction);
            const newDuration = gracefulFadeDurationMs / remainingFraction;
            const newStartTime = now - (instance.fadeOutFraction * newDuration);

            return {
              ...instance,
              startTime: newStartTime,
              durationMs: newDuration,
            };
          }
        }
        return instance;
      });

      return hasChanges ? updated : prevActive;
    });
  }, [quotes]);

  // Keep activeQuotesRef synchronized with state
  activeQuotesRef.current = activeQuotes;

  // 1. SCHEDULER: Non-repeating random selection from live quote collection
  const getNextQuote = useCallback((): QuoteItem | null => {
    const liveQuotes = quotesRef.current;
    if (!liveQuotes || liveQuotes.length === 0) {
      return null;
    }

    const currentlyActiveQuoteIds = new Set(activeQuotesRef.current.map((q) => q.quoteId));

    // Refill pool if empty
    if (poolRef.current.length === 0) {
      let newPool = shuffle(liveQuotes.map((q) => q.id));

      // Prevent immediate succession with the last shown quote
      if (newPool.length > 1 && newPool[0] === lastQuoteIdRef.current) {
        const swapIdx = 1 + Math.floor(Math.random() * (newPool.length - 1));
        [newPool[0], newPool[swapIdx]] = [newPool[swapIdx], newPool[0]];
      }
      poolRef.current = newPool;
    }

    // Prefer a quote that is not currently visible on screen
    let chosenId: string | null = null;
    for (let i = 0; i < poolRef.current.length; i++) {
      if (!currentlyActiveQuoteIds.has(poolRef.current[i])) {
        chosenId = poolRef.current.splice(i, 1)[0];
        break;
      }
    }

    if (!chosenId && poolRef.current.length > 0) {
      chosenId = poolRef.current.shift()!;
    }

    if (!chosenId) {
      // Pick random from live collection
      chosenId = liveQuotes[Math.floor(Math.random() * liveQuotes.length)].id;
    }

    lastQuoteIdRef.current = chosenId;
    const found = liveQuotes.find((q) => q.id === chosenId);
    return found || liveQuotes[0];
  }, []);

  // 2. PLACEMENT ENGINE: Find collision-free coordinate or defer
  const trySpawnQuote = useCallback(
    (elapsedOffsetMs: number = 0, currentList?: ActiveQuoteInstance[]): boolean => {
      if (!isMountedRef.current) return false;

      const currentActive = currentList ?? activeQuotesRef.current;
      const metrics: ViewportMetrics = getViewportMetrics();

      // Check strict concurrency limit
      if (currentActive.length >= metrics.maxConcurrency) {
        return false;
      }

      const quoteItem = getNextQuote();
      if (!quoteItem) {
        return false;
      }

      const text = quoteItem.text;

      // Measure quote's exact dimensions and deliberate line wrapping
      const measured = measureQuote(text, metrics);

      // Animation parameters:
      // On mobile: gentle, modest scale [0.95 -> 1.00] with maxScale = 1.00
      // On desktop: snappy, organic scale [0.88 -> 1.00 -> 1.03]
      const initialScale = metrics.isMobile ? 0.95 : 0.88 + Math.random() * 0.04;
      const targetScale = metrics.isMobile ? 1.00 : 0.98 + Math.random() * 0.04;
      const exitScale = metrics.isMobile ? 1.00 : targetScale * (1.02 + Math.random() * 0.02);
      const maxScale = Math.max(initialScale, targetScale, exitScale);

      // Find collision-free placement (reserving top-left profile icon and all active quotes)
      const placement = findCollisionFreePlacement(measured, currentActive, metrics, maxScale);

      if (!placement) {
        // No safe space available currently; put ID back into pool to try later
        poolRef.current.unshift(quoteItem.id);
        return false;
      }

      // Slower, contemplative quote lifecycle: 12.0s - 16.5s
      const durationMs = 12000 + Math.random() * 4500;
      const maxOpacity = 0.84 + Math.random() * 0.14;

      instanceCounterRef.current += 1;
      const newInstance: ActiveQuoteInstance = {
        instanceId: `quote_${Date.now()}_${instanceCounterRef.current}`,
        quoteId: quoteItem.id,
        text,
        lines: measured.lines,
        x: placement.x,
        y: placement.y,
        width: measured.width,
        height: measured.height,
        fontSize: measured.fontSize,
        isWrapped: measured.isWrapped,
        reservedBox: placement.reservedBox,
        driftX: placement.driftX,
        driftY: placement.driftY,
        initialScale,
        targetScale,
        exitScale,
        maxOpacity,
        startTime: performance.now() - elapsedOffsetMs,
        durationMs,
        fadeInFraction: 0.22,
        fadeOutFraction: 0.76,
      };

      if (currentList) {
        currentList.push(newInstance);
      } else {
        setActiveQuotes((prev) => [...prev, newInstance]);
      }

      return true;
    },
    [getNextQuote]
  );

  // Master schedule loop: original contemplative appearance cadence
  const scheduleNextCheck = useCallback((delayMs: number) => {
    if (nextSpawnTimeoutRef.current) {
      clearTimeout(nextSpawnTimeoutRef.current);
    }
    nextSpawnTimeoutRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) return;

      const spawned = trySpawnQuote(0);
      const metrics = getViewportMetrics();

      if (spawned) {
        // Successfully spawned; schedule next appearance at original interval
        const nextInterval = metrics.isMobile
          ? 3800 + Math.random() * 2000
          : 2400 + Math.random() * 1800;
        scheduleNextCheck(nextInterval);
      } else {
        // Space was full or restricted; retry later as quotes fade out
        scheduleNextCheck(1600 + Math.random() * 800);
      }
    }, delayMs);
  }, [trySpawnQuote]);

  // Clean up completed quote instance when its lifecycle finishes
  const handleQuoteComplete = useCallback(
    (instanceId: string) => {
      setActiveQuotes((prev) => prev.filter((q) => q.instanceId !== instanceId));
      // As soon as a quote dissolves, check if space is available
      scheduleNextCheck(700);
    },
    [scheduleNextCheck]
  );

  // Handle window resizing & device orientation flips: Recalculate placements
  useEffect(() => {
    let resizeTimer: number;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        const metrics = getViewportMetrics();

        setActiveQuotes((prev) => {
          const adjustedList: ActiveQuoteInstance[] = [];

          for (const q of prev) {
            // Re-measure quote with the new viewport width and typography
            const remeasured = measureQuote(q.text, metrics);
            const maxScale = Math.max(q.initialScale, q.targetScale, q.exitScale);

            // Check if current position remains valid without clipping or collisions
            const halfW = (remeasured.width * maxScale) / 2;
            const halfH = (remeasured.height * maxScale) / 2;

            const clampedX = metrics.isMobile
              ? metrics.width / 2
              : Math.max(
                  metrics.safeArea.left + halfW,
                  Math.min(metrics.width - metrics.safeArea.right - halfW, q.x)
                );

            const clampedY = Math.max(
              metrics.safeArea.top + halfH + (metrics.isMobile ? 48 : 16),
              Math.min(metrics.height - metrics.safeArea.bottom - halfH, q.y)
            );

            const { reservedBox, visualBounds } = computeReservedBox(
              clampedX,
              clampedY,
              remeasured.width,
              remeasured.height,
              metrics.isMobile ? 0 : q.driftX,
              metrics.isMobile ? 0 : q.driftY,
              maxScale,
              metrics.paddingX,
              metrics.paddingY
            );

            // Verify safe bounds
            const isInside =
              visualBounds.left >= metrics.safeArea.left &&
              visualBounds.right <= metrics.width - metrics.safeArea.right &&
              visualBounds.top >= metrics.safeArea.top &&
              visualBounds.bottom <= metrics.height - metrics.safeArea.bottom;

            // Verify no collision with previously adjusted quotes
            let collidesWithOther = false;
            for (const other of adjustedList) {
              if (
                !(
                  reservedBox.right < other.reservedBox.left ||
                  reservedBox.left > other.reservedBox.right ||
                  reservedBox.bottom < other.reservedBox.top ||
                  reservedBox.top > other.reservedBox.bottom
                )
              ) {
                collidesWithOther = true;
                break;
              }
            }

            if (isInside && !collidesWithOther) {
              adjustedList.push({
                ...q,
                x: clampedX,
                y: clampedY,
                width: remeasured.width,
                height: remeasured.height,
                lines: remeasured.lines,
                fontSize: remeasured.fontSize,
                isWrapped: remeasured.isWrapped,
                reservedBox,
              });
            } else {
              // Try to find a new collision-free spot in the resized viewport
              const newPlacement = findCollisionFreePlacement(
                remeasured,
                adjustedList,
                metrics,
                maxScale
              );

              if (newPlacement) {
                adjustedList.push({
                  ...q,
                  x: newPlacement.x,
                  y: newPlacement.y,
                  width: remeasured.width,
                  height: remeasured.height,
                  lines: remeasured.lines,
                  fontSize: remeasured.fontSize,
                  isWrapped: remeasured.isWrapped,
                  reservedBox: newPlacement.reservedBox,
                });
              }
              // If space cannot accommodate this quote, let it dissolve cleanly
            }
          }

          return adjustedList;
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
      clearTimeout(resizeTimer);
    };
  }, []);

  // Initial mount: populate space immediately with staggered active quotes
  useEffect(() => {
    isMountedRef.current = true;
    const metrics = getViewportMetrics();

    // Determine initial count based on viewport capacity targets
    const initialTarget = metrics.isMobile
      ? metrics.height < 620
        ? 2
        : 3
      : metrics.isTablet
      ? metrics.width < 850
        ? 5
        : 6
      : metrics.width > 1600
      ? 8
      : 7;

    // Staggered elapsed offsets across a 12-16s lifecycle
    const initialStaggers = [
      7000,  // in full focus
      3200,  // emerging
      10500, // fading out
      1000,  // just appeared
      5000,  // in focus
      8500,  // nearing fade out
      1500,  // emerging
      6000,  // in focus
    ];

    const initialList: ActiveQuoteInstance[] = [];
    for (let i = 0; i < initialTarget; i++) {
      trySpawnQuote(initialStaggers[i % initialStaggers.length], initialList);
    }

    setActiveQuotes([...initialList]);

    // Schedule regular cycle at original pacing
    scheduleNextCheck(metrics.isMobile ? 3800 : 2400);

    return () => {
      isMountedRef.current = false;
      if (nextSpawnTimeoutRef.current) {
        clearTimeout(nextSpawnTimeoutRef.current);
      }
    };
  }, [trySpawnQuote, scheduleNextCheck]);

  return (
    <div className="fixed inset-0 cosmic-space-perspective overflow-hidden pointer-events-none z-10 w-full h-full">
      {activeQuotes.map((instance) => (
        <CosmicQuote
          key={instance.instanceId}
          instance={instance}
          onComplete={handleQuoteComplete}
        />
      ))}
    </div>
  );
};
