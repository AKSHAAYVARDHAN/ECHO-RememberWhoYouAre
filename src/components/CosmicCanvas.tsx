/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  currentAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  vx: number;
  vy: number;
  layer: number; // 0 = deep faint background, 1 = mid space, 2 = near anchor
  hasGlow?: boolean;
}

interface GalaxyInstance {
  id: string;
  relX: number; // relative position [0, 1] across viewport
  relY: number;
  width: number;
  height: number;
  angle: number;
  driftVx: number;
  driftVy: number;
  alpha: number;
  currentX: number;
  currentY: number;
  offscreenCanvas: HTMLCanvasElement;
}

interface CosmicDustCloud {
  relX: number;
  relY: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  alpha: number;
  vx: number;
  vy: number;
  currentX: number;
  currentY: number;
}

export const CosmicCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speedMultiplier = prefersReducedMotion ? 0.05 : 1.0;

    const stars: Star[] = [];
    const galaxies: GalaxyInstance[] = [];
    const dustClouds: CosmicDustCloud[] = [];

    // 1. PROCEDURAL GALAXY TEXTURE BUILDERS (OFFSCREEN BUFFERS FOR 60FPS EFFICIENCY)

    // A. Tilted Barred Spiral Galaxy
    const createSpiralGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Outer diffuse halo - soft, ethereal falloff
      const outerGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
      outerGrad.addColorStop(0, 'rgba(150, 162, 178, 0.16)');
      outerGrad.addColorStop(0.28, 'rgba(115, 128, 144, 0.09)');
      outerGrad.addColorStop(0.60, 'rgba(65, 74, 88, 0.03)');
      outerGrad.addColorStop(0.90, 'rgba(25, 30, 38, 0.008)');
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.48);
      octx.fillStyle = outerGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.48, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Spiral dust arms with soft, organic particle density
      const armCount = 2;
      const pointsPerArm = 90;
      for (let arm = 0; arm < armCount; arm++) {
        const armOffset = (arm * Math.PI * 2) / armCount;
        for (let i = 0; i < pointsPerArm; i++) {
          const t = i / pointsPerArm;
          const theta = t * Math.PI * 2.8 + armOffset;
          const r = t * (size * 0.42);

          const scatter = (Math.random() - 0.5) * (14 + t * 20);
          const px = cx + Math.cos(theta) * (r + scatter);
          const py = cy + Math.sin(theta) * ((r + scatter) * 0.46);

          const particleRadius = 4 + Math.random() * 12 * (1 - t * 0.35);
          const pGrad = octx.createRadialGradient(px, py, 0, px, py, particleRadius);
          const pAlpha = (0.05 + Math.random() * 0.06) * (1 - t * 0.45);
          pGrad.addColorStop(0, `rgba(205, 218, 235, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(0.55, `rgba(130, 142, 160, ${(pAlpha * 0.45).toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, particleRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      // Compact, soft core without glaring highlight
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.16);
      coreGrad.addColorStop(0, 'rgba(240, 246, 255, 0.48)');
      coreGrad.addColorStop(0.25, 'rgba(200, 212, 230, 0.28)');
      coreGrad.addColorStop(0.55, 'rgba(135, 148, 165, 0.11)');
      coreGrad.addColorStop(0.85, 'rgba(70, 80, 95, 0.03)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.54);
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.54, size * 0.16, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      return oc;
    };

    // B. Diffuse Elliptical Galaxy
    const createEllipticalGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      const grad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.46);
      grad.addColorStop(0, 'rgba(235, 242, 252, 0.44)');
      grad.addColorStop(0.16, 'rgba(195, 208, 225, 0.26)');
      grad.addColorStop(0.38, 'rgba(145, 158, 175, 0.13)');
      grad.addColorStop(0.65, 'rgba(85, 96, 112, 0.04)');
      grad.addColorStop(0.88, 'rgba(35, 42, 52, 0.01)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.66);
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(cx, cy / 0.66, size * 0.46, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      return oc;
    };

    // C. Edge-on Slender Needle / Lenticular Galaxy with Soft Natural Dust Lane
    const createNeedleGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.5);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      // Disk
      octx.save();
      octx.scale(1.0, 0.20);
      const diskGrad = octx.createRadialGradient(cx, cy / 0.20, 0, cx, cy / 0.20, size * 0.48);
      diskGrad.addColorStop(0, 'rgba(215, 226, 240, 0.30)');
      diskGrad.addColorStop(0.30, 'rgba(160, 174, 192, 0.16)');
      diskGrad.addColorStop(0.65, 'rgba(95, 108, 124, 0.05)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = diskGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.20, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Bulge
      const bulgeGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14);
      bulgeGrad.addColorStop(0, 'rgba(242, 248, 255, 0.48)');
      bulgeGrad.addColorStop(0.40, 'rgba(185, 198, 215, 0.24)');
      bulgeGrad.addColorStop(0.75, 'rgba(120, 132, 148, 0.07)');
      bulgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.save();
      octx.scale(1.0, 0.56);
      octx.fillStyle = bulgeGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.56, size * 0.14, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Equatorial dark dust absorption lane (soft, organic falloff)
      const laneGrad = octx.createLinearGradient(cx - size * 0.38, 0, cx + size * 0.38, 0);
      laneGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      laneGrad.addColorStop(0.22, 'rgba(0, 0, 0, 0.50)');
      laneGrad.addColorStop(0.50, 'rgba(0, 0, 0, 0.80)');
      laneGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.50)');
      laneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = laneGrad;
      octx.fillRect(cx - size * 0.38, cy - 1.8, size * 0.76, 3.6);

      return oc;
    };

    // D. Delicate Face-On Spiral Galaxy
    const createFaceOnSpiralCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Halo
      const haloGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
      haloGrad.addColorStop(0, 'rgba(160, 172, 190, 0.15)');
      haloGrad.addColorStop(0.35, 'rgba(115, 126, 142, 0.08)');
      haloGrad.addColorStop(0.75, 'rgba(55, 65, 78, 0.02)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = haloGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
      octx.fill();

      // 3 sweeping spiral arms
      const armCount = 3;
      const points = 70;
      for (let arm = 0; arm < armCount; arm++) {
        const offset = (arm * Math.PI * 2) / armCount;
        for (let i = 0; i < points; i++) {
          const t = i / points;
          const theta = t * Math.PI * 2.3 + offset;
          const r = t * (size * 0.40);
          const px = cx + Math.cos(theta) * r + (Math.random() - 0.5) * 12;
          const py = cy + Math.sin(theta) * r + (Math.random() - 0.5) * 12;

          const pRadius = 4 + Math.random() * 11;
          const pGrad = octx.createRadialGradient(px, py, 0, px, py, pRadius);
          const pAlpha = 0.045 + Math.random() * 0.055;
          pGrad.addColorStop(0, `rgba(205, 218, 235, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(0.6, `rgba(125, 138, 155, ${(pAlpha * 0.4).toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, pRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      // Soft, gentle core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.13);
      coreGrad.addColorStop(0, 'rgba(240, 246, 255, 0.45)');
      coreGrad.addColorStop(0.40, 'rgba(185, 198, 215, 0.22)');
      coreGrad.addColorStop(0.75, 'rgba(115, 126, 142, 0.06)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // E. Rare Polar-Ring / Detached Ring Galaxy (Soft, feathered, no sharp glowing streaks)
    const createRingGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Outer diffuse, feathered stardust ring (gentle whisper, not sharp or high-contrast)
      octx.save();
      octx.scale(1.0, 0.64);
      const ringOuterR = size * 0.43;
      const ringWidth = size * 0.12;

      const ringGrad = octx.createRadialGradient(cx, cy / 0.64, ringOuterR - ringWidth, cx, cy / 0.64, ringOuterR + ringWidth);
      ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ringGrad.addColorStop(0.5, 'rgba(195, 208, 225, 0.20)');
      ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.fillStyle = ringGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.64, ringOuterR + ringWidth, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Detached central soft core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
      coreGrad.addColorStop(0, 'rgba(238, 244, 252, 0.40)');
      coreGrad.addColorStop(0.40, 'rgba(175, 188, 206, 0.20)');
      coreGrad.addColorStop(0.80, 'rgba(110, 120, 135, 0.05)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // F. Interacting / Satellite Galaxy Pair (Soft tidal bridge, no harsh streaks)
    const createInteractingPairCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.75);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx1 = size * 0.38;
      const cy1 = oc.height * 0.45;
      const cx2 = size * 0.68;
      const cy2 = oc.height * 0.58;

      // Primary galaxy halo
      const grad1 = octx.createRadialGradient(cx1, cy1, 0, cx1, cy1, size * 0.28);
      grad1.addColorStop(0, 'rgba(235, 242, 252, 0.38)');
      grad1.addColorStop(0.30, 'rgba(180, 194, 212, 0.20)');
      grad1.addColorStop(0.70, 'rgba(105, 118, 134, 0.05)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = grad1;
      octx.beginPath();
      octx.arc(cx1, cy1, size * 0.28, 0, Math.PI * 2);
      octx.fill();

      // Secondary companion dwarf galaxy halo
      const grad2 = octx.createRadialGradient(cx2, cy2, 0, cx2, cy2, size * 0.19);
      grad2.addColorStop(0, 'rgba(225, 235, 248, 0.30)');
      grad2.addColorStop(0.35, 'rgba(160, 174, 192, 0.15)');
      grad2.addColorStop(0.75, 'rgba(95, 108, 122, 0.04)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = grad2;
      octx.beginPath();
      octx.arc(cx2, cy2, size * 0.19, 0, Math.PI * 2);
      octx.fill();

      // Soft, delicate tidal bridge (gentle brush, no harsh glowing streak)
      octx.strokeStyle = 'rgba(160, 174, 192, 0.08)';
      octx.lineWidth = 10;
      octx.beginPath();
      octx.moveTo(cx1, cy1);
      octx.quadraticCurveTo(size * 0.52, oc.height * 0.62, cx2, cy2);
      octx.stroke();

      return oc;
    };

    // G. Faint Irregular Dwarf Galaxy Cloud
    const createDwarfGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.7);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      const dGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.42);
      dGrad.addColorStop(0, 'rgba(205, 218, 235, 0.24)');
      dGrad.addColorStop(0.38, 'rgba(140, 152, 170, 0.12)');
      dGrad.addColorStop(0.80, 'rgba(60, 70, 84, 0.03)');
      dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.68);
      octx.fillStyle = dGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.68, size * 0.42, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      return oc;
    };

    // H. Sombrero / Lenticular Galaxy (Soft Bulge & Gentle Equatorial Dust Band)
    const createSombreroGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.6);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      // Outer disk
      octx.save();
      octx.scale(1.0, 0.25);
      const diskGrad = octx.createRadialGradient(cx, cy / 0.25, 0, cx, cy / 0.25, size * 0.48);
      diskGrad.addColorStop(0, 'rgba(215, 226, 240, 0.28)');
      diskGrad.addColorStop(0.35, 'rgba(155, 168, 184, 0.14)');
      diskGrad.addColorStop(0.75, 'rgba(85, 96, 110, 0.04)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = diskGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.25, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Soft luminous central bulge
      octx.save();
      octx.scale(1.0, 0.72);
      const bulgeGrad = octx.createRadialGradient(cx, cy / 0.72, 0, cx, cy / 0.72, size * 0.22);
      bulgeGrad.addColorStop(0, 'rgba(242, 248, 255, 0.48)');
      bulgeGrad.addColorStop(0.40, 'rgba(190, 202, 220, 0.26)');
      bulgeGrad.addColorStop(0.80, 'rgba(125, 136, 152, 0.08)');
      bulgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = bulgeGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.72, size * 0.22, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Subtle equatorial dark dust lane
      const dustLane = octx.createLinearGradient(cx - size * 0.42, 0, cx + size * 0.42, 0);
      dustLane.addColorStop(0, 'rgba(0, 0, 0, 0)');
      dustLane.addColorStop(0.24, 'rgba(0, 0, 0, 0.55)');
      dustLane.addColorStop(0.50, 'rgba(0, 0, 0, 0.82)');
      dustLane.addColorStop(0.76, 'rgba(0, 0, 0, 0.55)');
      dustLane.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = dustLane;
      octx.fillRect(cx - size * 0.42, cy - 2.0, size * 0.84, 4.0);

      return oc;
    };

    // I. Pinwheel / Grand Design 4-Arm Spiral Galaxy
    const createPinwheelGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Outer glow halo
      const haloGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.46);
      haloGrad.addColorStop(0, 'rgba(190, 202, 218, 0.25)');
      haloGrad.addColorStop(0.35, 'rgba(135, 148, 165, 0.14)');
      haloGrad.addColorStop(0.75, 'rgba(65, 75, 90, 0.04)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = haloGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
      octx.fill();

      // 4 sweeping spiral arms
      const armCount = 4;
      const points = 95;
      for (let arm = 0; arm < armCount; arm++) {
        const offset = (arm * Math.PI * 2) / armCount;
        for (let i = 0; i < points; i++) {
          const t = i / points;
          const theta = t * Math.PI * 2.6 + offset;
          const r = t * (size * 0.43);
          const px = cx + Math.cos(theta) * r + (Math.random() - 0.5) * 14;
          const py = cy + Math.sin(theta) * r + (Math.random() - 0.5) * 14;

          const pRadius = 4 + Math.random() * 14 * (1 - t * 0.3);
          const pGrad = octx.createRadialGradient(px, py, 0, px, py, pRadius);
          const pAlpha = (0.07 + Math.random() * 0.09) * (1 - t * 0.4);
          pGrad.addColorStop(0, `rgba(220, 230, 245, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(0.6, `rgba(145, 158, 175, ${(pAlpha * 0.5).toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, pRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      // Brilliant, soft core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14);
      coreGrad.addColorStop(0, 'rgba(252, 254, 255, 0.65)');
      coreGrad.addColorStop(0.35, 'rgba(210, 222, 238, 0.38)');
      coreGrad.addColorStop(0.70, 'rgba(140, 152, 170, 0.14)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.14, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // J. Cartwheel / Collision Ring with Spoke Filaments
    const createCartwheelSpokeCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Outer ring
      octx.save();
      octx.scale(1.0, 0.72);
      const ringR = size * 0.40;
      const ringThick = size * 0.08;
      const ringGrad = octx.createRadialGradient(cx, cy / 0.72, ringR - ringThick, cx, cy / 0.72, ringR + ringThick);
      ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ringGrad.addColorStop(0.5, 'rgba(215, 225, 242, 0.38)');
      ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = ringGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.72, ringR + ringThick, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Spoke filaments connecting core to ring
      const spokeCount = 6;
      for (let s = 0; s < spokeCount; s++) {
        const angle = (s * Math.PI * 2) / spokeCount + 0.2;
        const x2 = cx + Math.cos(angle) * (size * 0.38);
        const y2 = cy + Math.sin(angle) * (size * 0.38 * 0.72);
        octx.strokeStyle = 'rgba(180, 192, 208, 0.16)';
        octx.lineWidth = 8;
        octx.beginPath();
        octx.moveTo(cx, cy);
        octx.lineTo(x2, y2);
        octx.stroke();
      }

      // Compact bright nucleus
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
      coreGrad.addColorStop(0, 'rgba(250, 252, 255, 0.62)');
      coreGrad.addColorStop(0.4, 'rgba(195, 208, 225, 0.34)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // K. Clumpy Magellanic Cloud / Irregular Satellite Galaxy
    const createMagellanicIrregularCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.75);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      // Soft irregular clumps
      const clumps = [
        { x: cx - size * 0.12, y: cy - size * 0.06, r: size * 0.28, a: 0.26 },
        { x: cx + size * 0.15, y: cy + size * 0.04, r: size * 0.22, a: 0.22 },
        { x: cx - size * 0.02, y: cy + size * 0.12, r: size * 0.20, a: 0.20 },
        { x: cx + size * 0.08, y: cy - size * 0.10, r: size * 0.18, a: 0.18 },
        { x: cx - size * 0.22, y: cy + size * 0.08, r: size * 0.16, a: 0.16 },
      ];

      for (const cl of clumps) {
        const grad = octx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
        grad.addColorStop(0, `rgba(220, 230, 245, ${cl.a.toFixed(4)})`);
        grad.addColorStop(0.4, `rgba(150, 162, 178, ${(cl.a * 0.5).toFixed(4)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        octx.fillStyle = grad;
        octx.beginPath();
        octx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
        octx.fill();
      }

      return oc;
    };

    // 2. INITIALIZE BALANCED, SPACIOUS COSMIC FIELD WITH GENEROUS NEGATIVE SPACE
    const initGalaxies = () => {
      galaxies.length = 0;
      const minDim = Math.min(width, height);
      const isMobile = width < 600;
      const isTablet = width >= 600 && width < 1024;

      // 1. Upper-Right Barred Spiral Galaxy (Corner anchor, gentle drift)
      const g1Size = Math.round(Math.min(420, Math.max(240, minDim * (isMobile ? 0.58 : 0.38))));
      galaxies.push({
        id: 'spiral-ur',
        relX: isMobile ? 0.85 : 0.84,
        relY: isMobile ? 0.16 : 0.16,
        width: g1Size,
        height: g1Size,
        angle: 0.55,
        driftVx: -0.002 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.72,
        currentX: (isMobile ? 0.85 : 0.84) * width,
        currentY: (isMobile ? 0.16 : 0.16) * height,
        offscreenCanvas: createSpiralGalaxyCanvas(g1Size),
      });

      // 2. Lower-Left Soft Diffuse Elliptical Galaxy (Corner anchor)
      const g2Size = Math.round(Math.min(380, Math.max(210, minDim * (isMobile ? 0.50 : 0.34))));
      galaxies.push({
        id: 'elliptical-ll',
        relX: isMobile ? 0.15 : 0.14,
        relY: isMobile ? 0.84 : 0.84,
        width: g2Size,
        height: g2Size,
        angle: -0.38,
        driftVx: 0.001 * speedMultiplier,
        driftVy: -0.001 * speedMultiplier,
        alpha: 0.68,
        currentX: (isMobile ? 0.15 : 0.14) * width,
        currentY: (isMobile ? 0.84 : 0.84) * height,
        offscreenCanvas: createEllipticalGalaxyCanvas(g2Size),
      });

      // 3. Mid-Right Edge Slender Edge-On Needle Galaxy
      const g3Size = Math.round(Math.min(360, Math.max(200, minDim * (isMobile ? 0.48 : 0.32))));
      galaxies.push({
        id: 'needle-mr',
        relX: isMobile ? 0.88 : 0.89,
        relY: isMobile ? 0.62 : 0.62,
        width: g3Size,
        height: Math.round(g3Size * 0.5),
        angle: -0.28,
        driftVx: 0.001 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.68,
        currentX: (isMobile ? 0.88 : 0.89) * width,
        currentY: (isMobile ? 0.62 : 0.62) * height,
        offscreenCanvas: createNeedleGalaxyCanvas(g3Size),
      });

      // 4. Upper-Left Delicate Face-On Spiral Galaxy
      const g4Size = Math.round(Math.min(330, Math.max(180, minDim * (isMobile ? 0.44 : 0.28))));
      galaxies.push({
        id: 'faceon-ul',
        relX: isMobile ? 0.14 : 0.12,
        relY: isMobile ? 0.26 : 0.26,
        width: g4Size,
        height: g4Size,
        angle: 0.20,
        driftVx: -0.001 * speedMultiplier,
        driftVy: -0.001 * speedMultiplier,
        alpha: 0.64,
        currentX: (isMobile ? 0.14 : 0.12) * width,
        currentY: (isMobile ? 0.26 : 0.26) * height,
        offscreenCanvas: createFaceOnSpiralCanvas(g4Size),
      });

      // 5. Lower-Right Sombrero Galaxy (Soft disk, gentle dust lane)
      const g5Size = Math.round(Math.min(340, Math.max(180, minDim * (isMobile ? 0.46 : 0.29))));
      galaxies.push({
        id: 'sombrero-br',
        relX: isMobile ? 0.80 : 0.80,
        relY: isMobile ? 0.86 : 0.86,
        width: g5Size,
        height: Math.round(g5Size * 0.6),
        angle: 0.16,
        driftVx: 0.001 * speedMultiplier,
        driftVy: -0.001 * speedMultiplier,
        alpha: 0.65,
        currentX: (isMobile ? 0.80 : 0.80) * width,
        currentY: (isMobile ? 0.86 : 0.86) * height,
        offscreenCanvas: createSombreroGalaxyCanvas(g5Size),
      });

      // Additional objects for Tablet and Desktop (well-spaced along perimeters, keeping center clear)
      if (!isMobile) {
        // 6. Top-Center Slender Edge-On Needle
        const g6Size = Math.round(Math.min(280, minDim * 0.22));
        galaxies.push({
          id: 'needle-tc',
          relX: 0.58,
          relY: 0.08,
          width: g6Size,
          height: Math.round(g6Size * 0.5),
          angle: 0.45,
          driftVx: 0.001 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.56,
          currentX: 0.58 * width,
          currentY: 0.08 * height,
          offscreenCanvas: createNeedleGalaxyCanvas(g6Size),
        });

        // 7. Bottom-Left Ethereal Dwarf Galaxy
        const g7Size = Math.round(Math.min(270, minDim * 0.22));
        galaxies.push({
          id: 'dwarf-bl',
          relX: 0.36,
          relY: 0.92,
          width: g7Size,
          height: Math.round(g7Size * 0.7),
          angle: 0.22,
          driftVx: -0.001 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.52,
          currentX: 0.36 * width,
          currentY: 0.92 * height,
          offscreenCanvas: createDwarfGalaxyCanvas(g7Size),
        });

        // Desktop-only distant subtle celestial objects (bringing desktop total to 11)
        if (!isTablet) {
          // 8. Distant Faint Elliptical (North-West)
          const g8Size = Math.round(Math.min(230, minDim * 0.18));
          galaxies.push({
            id: 'elliptical-nw',
            relX: 0.26,
            relY: 0.09,
            width: g8Size,
            height: g8Size,
            angle: -0.16,
            driftVx: 0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.48,
            currentX: 0.26 * width,
            currentY: 0.09 * height,
            offscreenCanvas: createEllipticalGalaxyCanvas(g8Size),
          });

          // 9. Far-East Distant Interacting Satellite System
          const g9Size = Math.round(Math.min(250, minDim * 0.20));
          galaxies.push({
            id: 'interacting-east',
            relX: 0.94,
            relY: 0.38,
            width: g9Size,
            height: Math.round(g9Size * 0.75),
            angle: -0.32,
            driftVx: 0.001 * speedMultiplier,
            driftVy: -0.001 * speedMultiplier,
            alpha: 0.48,
            currentX: 0.94 * width,
            currentY: 0.38 * height,
            offscreenCanvas: createInteractingPairCanvas(g9Size),
          });

          // 10. Distant Soft Feathered Ring Galaxy (South Edge)
          const g10Size = Math.round(Math.min(220, minDim * 0.17));
          galaxies.push({
            id: 'ring-se',
            relX: 0.66,
            relY: 0.94,
            width: g10Size,
            height: g10Size,
            angle: -0.20,
            driftVx: 0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.44,
            currentX: 0.66 * width,
            currentY: 0.94 * height,
            offscreenCanvas: createRingGalaxyCanvas(g10Size),
          });

          // 11. Far-West Distant Needle (Deep field perimeter)
          const g11Size = Math.round(Math.min(220, minDim * 0.17));
          galaxies.push({
            id: 'needle-fw',
            relX: 0.05,
            relY: 0.56,
            width: g11Size,
            height: Math.round(g11Size * 0.5),
            angle: 0.35,
            driftVx: -0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.46,
            currentX: 0.05 * width,
            currentY: 0.56 * height,
            offscreenCanvas: createNeedleGalaxyCanvas(g11Size),
          });
        }
      }
    };

    // 3. INITIALIZE SUBTLE, WELL-SPACED NEBULAR DUST CLOUDS
    const initDustClouds = () => {
      dustClouds.length = 0;
      const isMobile = width < 600;
      const cloudCount = isMobile ? 4 : 6;

      const basePositions = [
        { x: 0.84, y: 0.18, rx: 180, ry: 90, rot: 0.35 },
        { x: 0.14, y: 0.80, rx: 170, ry: 85, rot: -0.25 },
        { x: 0.88, y: 0.66, rx: 160, ry: 75, rot: -0.20 },
        { x: 0.12, y: 0.30, rx: 150, ry: 75, rot: 0.30 },
        { x: 0.52, y: 0.07, rx: 140, ry: 65, rot: 0.12 },
        { x: 0.72, y: 0.92, rx: 155, ry: 75, rot: -0.30 },
      ];

      for (let i = 0; i < cloudCount; i++) {
        const bp = basePositions[i % basePositions.length];
        const scale = isMobile ? 0.75 : 0.95;
        dustClouds.push({
          relX: bp.x,
          relY: bp.y,
          radiusX: bp.rx * scale,
          radiusY: bp.ry * scale,
          rotation: bp.rot,
          // Subtle, ethereal alpha: soft charcoal and silver-grey whisper
          alpha: 0.038 + Math.random() * 0.028,
          vx: (Math.random() - 0.5) * 0.004 * speedMultiplier,
          vy: (Math.random() - 0.5) * 0.004 * speedMultiplier,
          currentX: bp.x * width,
          currentY: bp.y * height,
        });
      }
    };

    // 4. INITIALIZE MULTI-LAYERED STARFIELD WITH DENSE, SPARKLING TEXTURE
    const initStars = () => {
      stars.length = 0;
      const isMobile = width < 600;
      // Dense starfield forming the primary background texture
      const areaDivisor = isMobile ? 2600 : 2100;
      const starCount = Math.floor(
        Math.min(800, Math.max(320, (width * height) / areaDivisor))
      );

      for (let i = 0; i < starCount; i++) {
        const layerRand = Math.random();
        let layer = 0;
        // Layer 0: Vast majority tiny faint stars (72%)
        let radius = 0.45 + Math.random() * 0.30;
        let baseAlpha = 0.28 + Math.random() * 0.24;
        let speedFactor = 0.007;
        let hasGlow = false;

        if (layerRand > 0.94) {
          // Layer 2: Only 6% foreground anchor stars - restrained and subtle
          layer = 2;
          radius = 1.15 + Math.random() * 0.40;
          baseAlpha = 0.75 + Math.random() * 0.16;
          speedFactor = 0.020;
          hasGlow = Math.random() < 0.60;
        } else if (layerRand > 0.72) {
          // Layer 1: Mid-space stars (22%)
          layer = 1;
          radius = 0.75 + Math.random() * 0.32;
          baseAlpha = 0.48 + Math.random() * 0.22;
          speedFactor = 0.013;
        }

        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius,
          baseAlpha,
          currentAlpha: baseAlpha,
          twinkleSpeed: (0.008 + Math.random() * 0.024) * (layer === 0 ? 0.6 : 1.0),
          twinklePhase: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * speedFactor * speedMultiplier,
          vy: (Math.random() - 0.5) * speedFactor * speedMultiplier,
          layer,
          hasGlow,
        });
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      initGalaxies();
      initDustClouds();
      initStars();
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // 5. MASTER RENDER LOOP
    const render = () => {
      // 1. Dominant pure black background void - true black preserved
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // 2. Render visible cosmic dust clouds and wispy nebulae
      for (let i = 0; i < dustClouds.length; i++) {
        const cloud = dustClouds[i];
        cloud.currentX += cloud.vx;
        cloud.currentY += cloud.vy;

        if (cloud.currentX < -cloud.radiusX) cloud.currentX = width + cloud.radiusX;
        if (cloud.currentX > width + cloud.radiusX) cloud.currentX = -cloud.radiusX;
        if (cloud.currentY < -cloud.radiusY) cloud.currentY = height + cloud.radiusY;
        if (cloud.currentY > height + cloud.radiusY) cloud.currentY = -cloud.radiusY;

        ctx.save();
        ctx.translate(cloud.currentX, cloud.currentY);
        ctx.rotate(cloud.rotation);
        ctx.scale(1.0, cloud.radiusY / cloud.radiusX);

        // Primary billowing dust body with silver-grey and muted cool-white tones
        const dGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cloud.radiusX);
        dGrad.addColorStop(0, `rgba(180, 192, 208, ${cloud.alpha.toFixed(4)})`);
        dGrad.addColorStop(0.35, `rgba(135, 146, 162, ${(cloud.alpha * 0.65).toFixed(4)})`);
        dGrad.addColorStop(0.70, `rgba(75, 84, 98, ${(cloud.alpha * 0.25).toFixed(4)})`);
        dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = dGrad;
        ctx.beginPath();
        ctx.arc(0, 0, cloud.radiusX, 0, Math.PI * 2);
        ctx.fill();

        // Secondary wispy offset lobe for organic nebular texture
        const subGrad = ctx.createRadialGradient(
          cloud.radiusX * 0.22,
          -cloud.radiusY * 0.18,
          0,
          cloud.radiusX * 0.22,
          -cloud.radiusY * 0.18,
          cloud.radiusX * 0.65
        );
        subGrad.addColorStop(0, `rgba(195, 208, 225, ${(cloud.alpha * 0.55).toFixed(4)})`);
        subGrad.addColorStop(0.5, `rgba(120, 132, 148, ${(cloud.alpha * 0.25).toFixed(4)})`);
        subGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = subGrad;
        ctx.beginPath();
        ctx.arc(cloud.radiusX * 0.22, -cloud.radiusY * 0.18, cloud.radiusX * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 3. Render multiple distant diffuse galaxy formations (subtly reduced brightness/glow by ~12.5%)
      for (let i = 0; i < galaxies.length; i++) {
        const g = galaxies[i];
        g.currentX += g.driftVx;
        g.currentY += g.driftVy;

        const halfW = g.width / 2;
        const halfH = g.height / 2;

        ctx.save();
        ctx.globalAlpha = g.alpha * 0.875;
        ctx.translate(g.currentX, g.currentY);
        ctx.rotate(g.angle);
        ctx.drawImage(g.offscreenCanvas, -halfW, -halfH, g.width, g.height);
        ctx.restore();
      }

      // 4. Render multi-layer starfield with subtle asynchronous twinkling and high-performance 60FPS drawing
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < -4) star.x = width + 4;
        if (star.x > width + 4) star.x = -4;
        if (star.y < -4) star.y = height + 4;
        if (star.y > height + 4) star.y = -4;

        star.twinklePhase += star.twinkleSpeed;
        const twinkleFactor = Math.sin(star.twinklePhase) * 0.28 + 0.72;
        star.currentAlpha = Math.max(0.18, Math.min(0.98, star.baseAlpha * twinkleFactor));

        // Soft glow on prominent anchor stars
        if (star.hasGlow && star.currentAlpha > 0.40) {
          ctx.globalAlpha = star.currentAlpha * 0.22;
          ctx.fillStyle = '#dce6f5';
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = star.currentAlpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000000]"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block bg-[#000000]"
      />
    </div>
  );
};
