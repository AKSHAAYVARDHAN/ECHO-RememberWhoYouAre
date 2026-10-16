/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { ActiveQuoteInstance } from '../types/quote';

interface CosmicQuoteProps {
  instance: ActiveQuoteInstance;
  onComplete: (instanceId: string) => void;
}

// Gentle smoothstep easing
const smoothstep = (min: number, max: number, value: number): number => {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
};

export const CosmicQuote: React.FC<CosmicQuoteProps> = ({ instance, onComplete }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 600;

    const tick = () => {
      const now = performance.now();
      const elapsed = now - instance.startTime;
      const progress = Math.min(1, Math.max(0, elapsed / instance.durationMs));

      if (progress >= 1) {
        onComplete(instance.instanceId);
        return;
      }

      // 1. Calculate Opacity curve
      let opacity = 0;
      if (progress < instance.fadeInFraction) {
        // Emerging gradually from near-invisible darkness
        const t = progress / instance.fadeInFraction;
        opacity = smoothstep(0, 1, t) * instance.maxOpacity;
      } else if (progress <= instance.fadeOutFraction) {
        // Comfortably readable while floating quietly in space
        opacity = instance.maxOpacity;
      } else {
        // Fading away gradually into black
        const t = (progress - instance.fadeOutFraction) / (1 - instance.fadeOutFraction);
        opacity = (1 - smoothstep(0, 1, t)) * instance.maxOpacity;
      }

      // 2. Calculate scale and position drift
      if (prefersReducedMotion) {
        container.style.transform = 'translate3d(-50%, -50%, 0)';
        container.style.opacity = `${opacity.toFixed(3)}`;
      } else {
        // Subtle scale transition
        let currentScale: number;
        if (progress <= instance.fadeInFraction) {
          const t = progress / instance.fadeInFraction;
          currentScale = instance.initialScale + (instance.targetScale - instance.initialScale) * smoothstep(0, 1, t);
        } else {
          const t = (progress - instance.fadeInFraction) / (1 - instance.fadeInFraction);
          currentScale = instance.targetScale + (instance.exitScale - instance.targetScale) * smoothstep(0, 1, t);
        }

        // Spatial drift
        const currentDriftX = instance.driftX * progress;
        const currentDriftY = instance.driftY * progress;
        // On mobile: zero Z-depth shift to avoid perspective scale inflation beyond bounding box
        const subtleZ = isMobile ? 0 : (progress - 0.4) * 16;

        container.style.transform = `
          translate3d(-50%, -50%, 0)
          translate3d(${currentDriftX.toFixed(2)}px, ${currentDriftY.toFixed(2)}px, ${subtleZ.toFixed(1)}px)
          scale3d(${currentScale.toFixed(3)}, ${currentScale.toFixed(3)}, 1)
        `;
        container.style.opacity = `${opacity.toFixed(3)}`;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [instance, onComplete]);

  // Use pre-computed deliberate lines to ensure rendered output matches measurements exactly
  const linesToRender = instance.lines && instance.lines.length > 0 ? instance.lines : [instance.text];

  return (
    <div
      ref={containerRef}
      className="absolute will-change-transform pointer-events-none select-none"
      style={{
        left: `${instance.x}px`,
        top: `${instance.y}px`,
        opacity: 0,
        transform: 'translate3d(-50%, -50%, 0)',
        transformStyle: 'preserve-3d',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="relative inline-block text-center select-none"
        style={{
          width: `${instance.width}px`,
          maxWidth: 'calc(100vw - 24px)',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="font-mono text-[#E8E8E8] font-normal leading-[1.45] text-center"
          style={{
            fontFamily: "'IBM Plex Mono', 'Space Mono', 'JetBrains Mono', ui-monospace, monospace",
            fontSize: `${instance.fontSize}px`,
            letterSpacing: '0.035em',
            boxSizing: 'border-box',
          }}
        >
          {linesToRender.map((line, idx) => (
            <div
              key={idx}
              className="whitespace-nowrap overflow-visible"
              style={{
                lineHeight: 1.45,
                boxSizing: 'border-box',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
