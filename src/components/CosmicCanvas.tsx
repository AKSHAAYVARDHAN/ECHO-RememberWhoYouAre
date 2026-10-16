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

      // Soft outer diffuse halo
      const outerGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
      outerGrad.addColorStop(0, 'rgba(150, 160, 175, 0.065)');
      outerGrad.addColorStop(0.25, 'rgba(120, 130, 145, 0.040)');
      outerGrad.addColorStop(0.55, 'rgba(70, 80, 95, 0.020)');
      outerGrad.addColorStop(0.85, 'rgba(30, 35, 45, 0.006)');
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.46);
      octx.fillStyle = outerGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.46, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Spiral dust arms
      const armCount = 2;
      const pointsPerArm = 90;
      for (let arm = 0; arm < armCount; arm++) {
        const armOffset = (arm * Math.PI * 2) / armCount;
        for (let i = 0; i < pointsPerArm; i++) {
          const t = i / pointsPerArm;
          const theta = t * Math.PI * 2.8 + armOffset;
          const r = t * (size * 0.42);

          const scatter = (Math.random() - 0.5) * (16 + t * 22);
          const px = cx + Math.cos(theta) * (r + scatter);
          const py = cy + Math.sin(theta) * ((r + scatter) * 0.44);

          const particleRadius = 6 + Math.random() * 16 * (1 - t * 0.4);
          const pGrad = octx.createRadialGradient(px, py, 0, px, py, particleRadius);
          const pAlpha = (0.015 + Math.random() * 0.022) * (1 - t * 0.5);
          pGrad.addColorStop(0, `rgba(185, 195, 210, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(0.5, `rgba(110, 120, 135, ${(pAlpha * 0.4).toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, particleRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      // Compact, soft core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.16);
      coreGrad.addColorStop(0, 'rgba(230, 235, 245, 0.095)');
      coreGrad.addColorStop(0.2, 'rgba(195, 205, 220, 0.065)');
      coreGrad.addColorStop(0.5, 'rgba(130, 140, 155, 0.028)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.52);
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.52, size * 0.16, 0, Math.PI * 2);
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
      grad.addColorStop(0, 'rgba(215, 225, 235, 0.075)');
      grad.addColorStop(0.18, 'rgba(165, 175, 190, 0.045)');
      grad.addColorStop(0.45, 'rgba(110, 120, 135, 0.022)');
      grad.addColorStop(0.75, 'rgba(50, 55, 65, 0.008)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.save();
      octx.scale(1.0, 0.65);
      octx.fillStyle = grad;
      octx.beginPath();
      octx.arc(cx, cy / 0.65, size * 0.46, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      return oc;
    };

    // C. Edge-on Slender Needle / Lenticular Galaxy with Dust Lane
    const createNeedleGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.5);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      octx.save();
      octx.scale(1.0, 0.18);
      const diskGrad = octx.createRadialGradient(cx, cy / 0.18, 0, cx, cy / 0.18, size * 0.48);
      diskGrad.addColorStop(0, 'rgba(210, 220, 235, 0.080)');
      diskGrad.addColorStop(0.25, 'rgba(160, 170, 185, 0.045)');
      diskGrad.addColorStop(0.60, 'rgba(95, 105, 120, 0.018)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = diskGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.18, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      const bulgeGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.13);
      bulgeGrad.addColorStop(0, 'rgba(225, 230, 240, 0.085)');
      bulgeGrad.addColorStop(0.4, 'rgba(170, 180, 195, 0.045)');
      bulgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.save();
      octx.scale(1.0, 0.55);
      octx.fillStyle = bulgeGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.55, size * 0.13, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Equatorial dust absorption lane
      const laneGrad = octx.createLinearGradient(cx - size * 0.35, 0, cx + size * 0.35, 0);
      laneGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      laneGrad.addColorStop(0.3, 'rgba(5, 5, 8, 0.055)');
      laneGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.075)');
      laneGrad.addColorStop(0.7, 'rgba(5, 5, 8, 0.055)');
      laneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = laneGrad;
      octx.fillRect(cx - size * 0.36, cy - 1.5, size * 0.72, 3);

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

      const haloGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
      haloGrad.addColorStop(0, 'rgba(165, 175, 190, 0.055)');
      haloGrad.addColorStop(0.3, 'rgba(125, 135, 150, 0.032)');
      haloGrad.addColorStop(0.7, 'rgba(60, 68, 80, 0.010)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = haloGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
      octx.fill();

      const armCount = 3;
      const points = 70;
      for (let arm = 0; arm < armCount; arm++) {
        const offset = (arm * Math.PI * 2) / armCount;
        for (let i = 0; i < points; i++) {
          const t = i / points;
          const theta = t * Math.PI * 2.2 + offset;
          const r = t * (size * 0.40);
          const px = cx + Math.cos(theta) * r + (Math.random() - 0.5) * 12;
          const py = cy + Math.sin(theta) * r + (Math.random() - 0.5) * 12;

          const pRadius = 5 + Math.random() * 12;
          const pGrad = octx.createRadialGradient(px, py, 0, px, py, pRadius);
          const pAlpha = 0.012 + Math.random() * 0.016;
          pGrad.addColorStop(0, `rgba(190, 200, 215, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, pRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
      coreGrad.addColorStop(0, 'rgba(225, 232, 242, 0.085)');
      coreGrad.addColorStop(0.4, 'rgba(175, 185, 200, 0.045)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // E. Rare Polar-Ring / Detached Ring Galaxy (Hoag's Object type)
    const createRingGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = size / 2;

      // Outer luminous stardust ring
      octx.save();
      octx.scale(1.0, 0.62);
      const ringOuterR = size * 0.44;
      const ringWidth = size * 0.08;

      const ringGrad = octx.createRadialGradient(cx, cy / 0.62, ringOuterR - ringWidth, cx, cy / 0.62, ringOuterR + ringWidth);
      ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ringGrad.addColorStop(0.5, 'rgba(175, 185, 200, 0.045)');
      ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      octx.fillStyle = ringGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.62, ringOuterR + ringWidth, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Detached central glowing spherical core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.11);
      coreGrad.addColorStop(0, 'rgba(225, 230, 242, 0.080)');
      coreGrad.addColorStop(0.4, 'rgba(160, 170, 185, 0.038)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = coreGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.11, 0, Math.PI * 2);
      octx.fill();

      return oc;
    };

    // F. Interacting / Satellite Galaxy Pair (with tidal bridge)
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
      grad1.addColorStop(0, 'rgba(215, 225, 235, 0.075)');
      grad1.addColorStop(0.4, 'rgba(140, 150, 165, 0.035)');
      grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = grad1;
      octx.beginPath();
      octx.arc(cx1, cy1, size * 0.28, 0, Math.PI * 2);
      octx.fill();

      // Secondary companion dwarf galaxy halo
      const grad2 = octx.createRadialGradient(cx2, cy2, 0, cx2, cy2, size * 0.18);
      grad2.addColorStop(0, 'rgba(200, 210, 225, 0.065)');
      grad2.addColorStop(0.4, 'rgba(130, 140, 155, 0.025)');
      grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = grad2;
      octx.beginPath();
      octx.arc(cx2, cy2, size * 0.18, 0, Math.PI * 2);
      octx.fill();

      // Faint tidal tail/bridge between them
      octx.strokeStyle = 'rgba(160, 170, 185, 0.028)';
      octx.lineWidth = 14;
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
      dGrad.addColorStop(0, 'rgba(170, 180, 195, 0.050)');
      dGrad.addColorStop(0.35, 'rgba(120, 130, 145, 0.025)');
      dGrad.addColorStop(0.75, 'rgba(55, 62, 75, 0.007)');
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

    // H. Sombrero / Lenticular Galaxy (Prominent Bulge & Dark Equatorial Dust Band)
    const createSombreroGalaxyCanvas = (size: number): HTMLCanvasElement => {
      const oc = document.createElement('canvas');
      oc.width = size;
      oc.height = Math.round(size * 0.6);
      const octx = oc.getContext('2d');
      if (!octx) return oc;

      const cx = size / 2;
      const cy = oc.height / 2;

      // Vast outer disk
      octx.save();
      octx.scale(1.0, 0.25);
      const diskGrad = octx.createRadialGradient(cx, cy / 0.25, 0, cx, cy / 0.25, size * 0.48);
      diskGrad.addColorStop(0, 'rgba(215, 225, 238, 0.085)');
      diskGrad.addColorStop(0.3, 'rgba(160, 172, 188, 0.050)');
      diskGrad.addColorStop(0.7, 'rgba(90, 100, 115, 0.018)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = diskGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.25, size * 0.48, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Broad luminous central bulge (spherical/elliptical)
      octx.save();
      octx.scale(1.0, 0.72);
      const bulgeGrad = octx.createRadialGradient(cx, cy / 0.72, 0, cx, cy / 0.72, size * 0.22);
      bulgeGrad.addColorStop(0, 'rgba(235, 240, 250, 0.100)');
      bulgeGrad.addColorStop(0.35, 'rgba(185, 195, 210, 0.060)');
      bulgeGrad.addColorStop(0.75, 'rgba(120, 130, 145, 0.020)');
      bulgeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = bulgeGrad;
      octx.beginPath();
      octx.arc(cx, cy / 0.72, size * 0.22, 0, Math.PI * 2);
      octx.fill();
      octx.restore();

      // Sharp equatorial dark dust lane slicing across the disk
      const dustLane = octx.createLinearGradient(cx - size * 0.42, 0, cx + size * 0.42, 0);
      dustLane.addColorStop(0, 'rgba(0, 0, 0, 0)');
      dustLane.addColorStop(0.2, 'rgba(5, 5, 8, 0.065)');
      dustLane.addColorStop(0.5, 'rgba(0, 0, 0, 0.095)');
      dustLane.addColorStop(0.8, 'rgba(5, 5, 8, 0.065)');
      dustLane.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = dustLane;
      octx.fillRect(cx - size * 0.42, cy - 2, size * 0.84, 4);

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
      haloGrad.addColorStop(0, 'rgba(175, 185, 200, 0.065)');
      haloGrad.addColorStop(0.35, 'rgba(120, 130, 145, 0.032)');
      haloGrad.addColorStop(0.75, 'rgba(55, 62, 75, 0.010)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = haloGrad;
      octx.beginPath();
      octx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
      octx.fill();

      // 4 sweeping spiral arms
      const armCount = 4;
      const points = 80;
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
          const pAlpha = (0.014 + Math.random() * 0.020) * (1 - t * 0.4);
          pGrad.addColorStop(0, `rgba(195, 205, 222, ${pAlpha.toFixed(4)})`);
          pGrad.addColorStop(0.6, `rgba(120, 130, 148, ${(pAlpha * 0.4).toFixed(4)})`);
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          octx.fillStyle = pGrad;
          octx.beginPath();
          octx.arc(px, py, pRadius, 0, Math.PI * 2);
          octx.fill();
        }
      }

      // Brilliant, soft core
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.14);
      coreGrad.addColorStop(0, 'rgba(235, 240, 252, 0.095)');
      coreGrad.addColorStop(0.35, 'rgba(180, 190, 205, 0.055)');
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
      const ringThick = size * 0.07;
      const ringGrad = octx.createRadialGradient(cx, cy / 0.72, ringR - ringThick, cx, cy / 0.72, ringR + ringThick);
      ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      ringGrad.addColorStop(0.5, 'rgba(180, 192, 208, 0.055)');
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
        octx.strokeStyle = 'rgba(150, 160, 175, 0.022)';
        octx.lineWidth = 6;
        octx.beginPath();
        octx.moveTo(cx, cy);
        octx.lineTo(x2, y2);
        octx.stroke();
      }

      // Compact bright nucleus
      const coreGrad = octx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.12);
      coreGrad.addColorStop(0, 'rgba(230, 238, 248, 0.090)');
      coreGrad.addColorStop(0.4, 'rgba(165, 175, 190, 0.045)');
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

      // 5-6 soft irregular clumps
      const clumps = [
        { x: cx - size * 0.12, y: cy - size * 0.06, r: size * 0.28, a: 0.045 },
        { x: cx + size * 0.15, y: cy + size * 0.04, r: size * 0.22, a: 0.040 },
        { x: cx - size * 0.02, y: cy + size * 0.12, r: size * 0.20, a: 0.035 },
        { x: cx + size * 0.08, y: cy - size * 0.10, r: size * 0.18, a: 0.032 },
        { x: cx - size * 0.22, y: cy + size * 0.08, r: size * 0.16, a: 0.025 },
      ];

      for (const cl of clumps) {
        const grad = octx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
        grad.addColorStop(0, `rgba(190, 200, 215, ${cl.a.toFixed(4)})`);
        grad.addColorStop(0.4, `rgba(130, 140, 155, ${(cl.a * 0.45).toFixed(4)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        octx.fillStyle = grad;
        octx.beginPath();
        octx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
        octx.fill();
      }

      return oc;
    };

    // 2. INITIALIZE RICH COSMIC FIELD WITH NUMEROUS DISTANT GALAXIES
    const initGalaxies = () => {
      galaxies.length = 0;
      const minDim = Math.min(width, height);
      const isMobile = width < 600;
      const isTablet = width >= 600 && width < 1024;

      // Galaxy 1: Upper-Right Spiral Galaxy
      const g1Size = Math.round(Math.min(460, Math.max(250, minDim * (isMobile ? 0.62 : 0.42))));
      galaxies.push({
        id: 'spiral-ur',
        relX: isMobile ? 0.82 : 0.80,
        relY: isMobile ? 0.20 : 0.22,
        width: g1Size,
        height: g1Size,
        angle: 0.58,
        driftVx: -0.003 * speedMultiplier,
        driftVy: 0.002 * speedMultiplier,
        alpha: 0.95,
        currentX: (isMobile ? 0.82 : 0.80) * width,
        currentY: (isMobile ? 0.20 : 0.22) * height,
        offscreenCanvas: createSpiralGalaxyCanvas(g1Size),
      });

      // Galaxy 2: Lower-Left Diffuse Elliptical Galaxy
      const g2Size = Math.round(Math.min(400, Math.max(210, minDim * (isMobile ? 0.54 : 0.36))));
      galaxies.push({
        id: 'elliptical-ll',
        relX: isMobile ? 0.18 : 0.18,
        relY: isMobile ? 0.82 : 0.78,
        width: g2Size,
        height: g2Size,
        angle: -0.42,
        driftVx: 0.002 * speedMultiplier,
        driftVy: -0.002 * speedMultiplier,
        alpha: 0.85,
        currentX: (isMobile ? 0.18 : 0.18) * width,
        currentY: (isMobile ? 0.82 : 0.78) * height,
        offscreenCanvas: createEllipticalGalaxyCanvas(g2Size),
      });

      // Galaxy 3: Mid-Right Slender Edge-On Needle Galaxy
      const g3Size = Math.round(Math.min(380, Math.max(200, minDim * (isMobile ? 0.50 : 0.34))));
      galaxies.push({
        id: 'needle-mr',
        relX: isMobile ? 0.86 : 0.87,
        relY: isMobile ? 0.56 : 0.60,
        width: g3Size,
        height: Math.round(g3Size * 0.5),
        angle: -0.32,
        driftVx: 0.002 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.90,
        currentX: (isMobile ? 0.86 : 0.87) * width,
        currentY: (isMobile ? 0.56 : 0.60) * height,
        offscreenCanvas: createNeedleGalaxyCanvas(g3Size),
      });

      // Galaxy 4: Upper-Left Face-On Spiral Galaxy (Below profile icon)
      const g4Size = Math.round(Math.min(350, Math.max(180, minDim * (isMobile ? 0.46 : 0.30))));
      galaxies.push({
        id: 'faceon-ul',
        relX: isMobile ? 0.16 : 0.14,
        relY: isMobile ? 0.40 : 0.42,
        width: g4Size,
        height: g4Size,
        angle: 0.22,
        driftVx: -0.001 * speedMultiplier,
        driftVy: -0.002 * speedMultiplier,
        alpha: 0.80,
        currentX: (isMobile ? 0.16 : 0.14) * width,
        currentY: (isMobile ? 0.40 : 0.42) * height,
        offscreenCanvas: createFaceOnSpiralCanvas(g4Size),
      });

      // Galaxy 5: Distant Ring Galaxy (Hoag's Object)
      const g5Size = Math.round(Math.min(300, Math.max(160, minDim * (isMobile ? 0.42 : 0.26))));
      galaxies.push({
        id: 'ring-galaxy',
        relX: isMobile ? 0.78 : 0.65,
        relY: isMobile ? 0.74 : 0.16,
        width: g5Size,
        height: g5Size,
        angle: -0.24,
        driftVx: 0.001 * speedMultiplier,
        driftVy: 0.002 * speedMultiplier,
        alpha: 0.75,
        currentX: (isMobile ? 0.78 : 0.65) * width,
        currentY: (isMobile ? 0.74 : 0.16) * height,
        offscreenCanvas: createRingGalaxyCanvas(g5Size),
      });

      // Galaxy 6: Interacting Galaxy Pair with Tidal Tail
      const g6Size = Math.round(Math.min(340, Math.max(190, minDim * (isMobile ? 0.48 : 0.30))));
      galaxies.push({
        id: 'interacting-pair',
        relX: isMobile ? 0.25 : 0.28,
        relY: isMobile ? 0.60 : 0.62,
        width: g6Size,
        height: Math.round(g6Size * 0.75),
        angle: 0.40,
        driftVx: -0.002 * speedMultiplier,
        driftVy: -0.001 * speedMultiplier,
        alpha: 0.75,
        currentX: (isMobile ? 0.25 : 0.28) * width,
        currentY: (isMobile ? 0.60 : 0.62) * height,
        offscreenCanvas: createInteractingPairCanvas(g6Size),
      });

      // Galaxy 7: Sombrero Galaxy (Lenticular with Dark Dust Ring)
      const g7Size = Math.round(Math.min(360, Math.max(180, minDim * (isMobile ? 0.46 : 0.28))));
      galaxies.push({
        id: 'sombrero-formation',
        relX: isMobile ? 0.24 : 0.44,
        relY: isMobile ? 0.22 : 0.76,
        width: g7Size,
        height: Math.round(g7Size * 0.6),
        angle: 0.18,
        driftVx: 0.001 * speedMultiplier,
        driftVy: -0.002 * speedMultiplier,
        alpha: 0.80,
        currentX: (isMobile ? 0.24 : 0.44) * width,
        currentY: (isMobile ? 0.22 : 0.76) * height,
        offscreenCanvas: createSombreroGalaxyCanvas(g7Size),
      });

      // Galaxy 8: Pinwheel 4-Arm Spiral Formation
      const g8Size = Math.round(Math.min(350, Math.max(170, minDim * (isMobile ? 0.44 : 0.27))));
      galaxies.push({
        id: 'pinwheel-formation',
        relX: isMobile ? 0.50 : 0.88,
        relY: isMobile ? 0.90 : 0.12,
        width: g8Size,
        height: g8Size,
        angle: -0.45,
        driftVx: -0.002 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.75,
        currentX: (isMobile ? 0.50 : 0.88) * width,
        currentY: (isMobile ? 0.90 : 0.12) * height,
        offscreenCanvas: createPinwheelGalaxyCanvas(g8Size),
      });

      // Galaxy 9: Cartwheel Galaxy with Radial Spokes
      const g9Size = Math.round(Math.min(310, Math.max(160, minDim * (isMobile ? 0.40 : 0.25))));
      galaxies.push({
        id: 'cartwheel-formation',
        relX: isMobile ? 0.36 : 0.10,
        relY: isMobile ? 0.74 : 0.26,
        width: g9Size,
        height: g9Size,
        angle: 0.30,
        driftVx: 0.002 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.70,
        currentX: (isMobile ? 0.36 : 0.10) * width,
        currentY: (isMobile ? 0.74 : 0.26) * height,
        offscreenCanvas: createCartwheelSpokeCanvas(g9Size),
      });

      // Galaxy 10: Clumpy Magellanic Cloud Satellite
      const g10Size = Math.round(Math.min(320, Math.max(160, minDim * (isMobile ? 0.42 : 0.26))));
      galaxies.push({
        id: 'magellanic-cloud',
        relX: isMobile ? 0.82 : 0.62,
        relY: isMobile ? 0.88 : 0.30,
        width: g10Size,
        height: Math.round(g10Size * 0.75),
        angle: -0.22,
        driftVx: -0.001 * speedMultiplier,
        driftVy: -0.002 * speedMultiplier,
        alpha: 0.68,
        currentX: (isMobile ? 0.82 : 0.62) * width,
        currentY: (isMobile ? 0.88 : 0.30) * height,
        offscreenCanvas: createMagellanicIrregularCanvas(g10Size),
      });

      // Galaxy 11: Top-Center Slender Edge-On Needle
      const g11Size = Math.round(Math.min(290, Math.max(150, minDim * (isMobile ? 0.38 : 0.23))));
      galaxies.push({
        id: 'needle-tc',
        relX: isMobile ? 0.58 : 0.48,
        relY: isMobile ? 0.08 : 0.09,
        width: g11Size,
        height: Math.round(g11Size * 0.5),
        angle: 0.55,
        driftVx: 0.002 * speedMultiplier,
        driftVy: 0.001 * speedMultiplier,
        alpha: 0.65,
        currentX: (isMobile ? 0.58 : 0.48) * width,
        currentY: (isMobile ? 0.08 : 0.09) * height,
        offscreenCanvas: createNeedleGalaxyCanvas(g11Size),
      });

      // Galaxy 12: Mobile Secondary Deep-Space Dwarf
      if (isMobile) {
        const g12Size = Math.round(minDim * 0.34);
        galaxies.push({
          id: 'dwarf-mobile',
          relX: 0.75,
          relY: 0.38,
          width: g12Size,
          height: Math.round(g12Size * 0.7),
          angle: -0.15,
          driftVx: 0.001 * speedMultiplier,
          driftVy: 0.002 * speedMultiplier,
          alpha: 0.65,
          currentX: 0.75 * width,
          currentY: 0.38 * height,
          offscreenCanvas: createDwarfGalaxyCanvas(g12Size),
        });

        // Galaxy 13: Mobile Lower Deep Dwarf
        const g13Size = Math.round(minDim * 0.30);
        galaxies.push({
          id: 'dwarf-mobile-lower',
          relX: 0.12,
          relY: 0.68,
          width: g13Size,
          height: Math.round(g13Size * 0.7),
          angle: 0.35,
          driftVx: -0.001 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.55,
          currentX: 0.12 * width,
          currentY: 0.68 * height,
          offscreenCanvas: createDwarfGalaxyCanvas(g13Size),
        });
      }

      // Additional galaxies on Tablet and Desktop (bringing total to 24+ deep sky objects)
      if (!isMobile) {
        // Galaxy 12: Bottom-Right Distant Companion Galaxy
        const g12Size = Math.round(Math.min(310, minDim * 0.27));
        galaxies.push({
          id: 'companion-br',
          relX: 0.68,
          relY: 0.88,
          width: g12Size,
          height: g12Size,
          angle: -0.28,
          driftVx: -0.002 * speedMultiplier,
          driftVy: -0.001 * speedMultiplier,
          alpha: 0.70,
          currentX: 0.68 * width,
          currentY: 0.88 * height,
          offscreenCanvas: createEllipticalGalaxyCanvas(g12Size),
        });

        // Galaxy 13: Bottom-Left Deep Edge-On Needle
        const g13Size = Math.round(Math.min(280, minDim * 0.24));
        galaxies.push({
          id: 'needle-bl',
          relX: 0.38,
          relY: 0.92,
          width: g13Size,
          height: Math.round(g13Size * 0.5),
          angle: 0.48,
          driftVx: 0.002 * speedMultiplier,
          driftVy: -0.002 * speedMultiplier,
          alpha: 0.60,
          currentX: 0.38 * width,
          currentY: 0.92 * height,
          offscreenCanvas: createNeedleGalaxyCanvas(g13Size),
        });

        // Galaxy 14: Far-Right Deep-Field Spiral
        const g14Size = Math.round(Math.min(270, minDim * 0.23));
        galaxies.push({
          id: 'spiral-fr',
          relX: 0.94,
          relY: 0.34,
          width: g14Size,
          height: g14Size,
          angle: -0.55,
          driftVx: -0.001 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.58,
          currentX: 0.94 * width,
          currentY: 0.34 * height,
          offscreenCanvas: createSpiralGalaxyCanvas(g14Size),
        });

        // Galaxy 15: Far-Left Deep-Field Dwarf
        const g15Size = Math.round(Math.min(240, minDim * 0.20));
        galaxies.push({
          id: 'dwarf-fl',
          relX: 0.06,
          relY: 0.70,
          width: g15Size,
          height: Math.round(g15Size * 0.7),
          angle: 0.12,
          driftVx: 0.001 * speedMultiplier,
          driftVy: -0.001 * speedMultiplier,
          alpha: 0.52,
          currentX: 0.06 * width,
          currentY: 0.70 * height,
          offscreenCanvas: createDwarfGalaxyCanvas(g15Size),
        });

        // Galaxy 16: Upper-Left Distant Elliptical
        const g16Size = Math.round(Math.min(230, minDim * 0.19));
        galaxies.push({
          id: 'elliptical-ul-dist',
          relX: 0.32,
          relY: 0.18,
          width: g16Size,
          height: g16Size,
          angle: -0.18,
          driftVx: 0.002 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.50,
          currentX: 0.32 * width,
          currentY: 0.18 * height,
          offscreenCanvas: createEllipticalGalaxyCanvas(g16Size),
        });

        // Galaxy 17: Mid-Upper Right Distant Ring Formation
        const g17Size = Math.round(Math.min(220, minDim * 0.18));
        galaxies.push({
          id: 'ring-mur',
          relX: 0.74,
          relY: 0.44,
          width: g17Size,
          height: g17Size,
          angle: 0.62,
          driftVx: -0.001 * speedMultiplier,
          driftVy: -0.001 * speedMultiplier,
          alpha: 0.48,
          currentX: 0.74 * width,
          currentY: 0.44 * height,
          offscreenCanvas: createRingGalaxyCanvas(g17Size),
        });

        // Galaxy 18: Distant Interacting Satellite System (North-East)
        const g18Size = Math.round(Math.min(250, minDim * 0.21));
        galaxies.push({
          id: 'interacting-ne',
          relX: 0.86,
          relY: 0.78,
          width: g18Size,
          height: Math.round(g18Size * 0.75),
          angle: -0.38,
          driftVx: 0.001 * speedMultiplier,
          driftVy: -0.002 * speedMultiplier,
          alpha: 0.50,
          currentX: 0.86 * width,
          currentY: 0.78 * height,
          offscreenCanvas: createInteractingPairCanvas(g18Size),
        });

        // Galaxy 19: Deep Background Faint Spiral (Center-Right)
        const g19Size = Math.round(Math.min(210, minDim * 0.17));
        galaxies.push({
          id: 'deep-spiral-cr',
          relX: 0.58,
          relY: 0.54,
          width: g19Size,
          height: g19Size,
          angle: 0.72,
          driftVx: -0.001 * speedMultiplier,
          driftVy: 0.001 * speedMultiplier,
          alpha: 0.42,
          currentX: 0.58 * width,
          currentY: 0.54 * height,
          offscreenCanvas: createFaceOnSpiralCanvas(g19Size),
        });

        if (!isTablet) {
          // Galaxy 20: Distant North-West Needle Galaxy
          const g20Size = Math.round(Math.min(220, minDim * 0.18));
          galaxies.push({
            id: 'needle-nw-dist',
            relX: 0.22,
            relY: 0.07,
            width: g20Size,
            height: Math.round(g20Size * 0.5),
            angle: -0.65,
            driftVx: 0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.45,
            currentX: 0.22 * width,
            currentY: 0.07 * height,
            offscreenCanvas: createNeedleGalaxyCanvas(g20Size),
          });

          // Galaxy 21: Far-West Edge-On Needle
          const g21Size = Math.round(Math.min(230, minDim * 0.19));
          galaxies.push({
            id: 'needle-fw',
            relX: 0.04,
            relY: 0.48,
            width: g21Size,
            height: Math.round(g21Size * 0.5),
            angle: 0.28,
            driftVx: -0.001 * speedMultiplier,
            driftVy: 0.002 * speedMultiplier,
            alpha: 0.44,
            currentX: 0.04 * width,
            currentY: 0.48 * height,
            offscreenCanvas: createNeedleGalaxyCanvas(g21Size),
          });

          // Galaxy 22: Distant Ultra-Faint Dwarf Cloud (Center Void Depth)
          const g22Size = Math.round(Math.min(260, minDim * 0.22));
          galaxies.push({
            id: 'deep-dwarf-center',
            relX: 0.46,
            relY: 0.42,
            width: g22Size,
            height: Math.round(g22Size * 0.7),
            angle: -0.40,
            driftVx: 0.001 * speedMultiplier,
            driftVy: -0.001 * speedMultiplier,
            alpha: 0.38,
            currentX: 0.46 * width,
            currentY: 0.42 * height,
            offscreenCanvas: createDwarfGalaxyCanvas(g22Size),
          });

          // Galaxy 23: Distant Sombrero Galaxy (South-East Edge)
          const g23Size = Math.round(Math.min(240, minDim * 0.20));
          galaxies.push({
            id: 'sombrero-se-dist',
            relX: 0.76,
            relY: 0.94,
            width: g23Size,
            height: Math.round(g23Size * 0.6),
            angle: -0.30,
            driftVx: 0.002 * speedMultiplier,
            driftVy: -0.001 * speedMultiplier,
            alpha: 0.45,
            currentX: 0.76 * width,
            currentY: 0.94 * height,
            offscreenCanvas: createSombreroGalaxyCanvas(g23Size),
          });

          // Galaxy 24: Distant 4-Arm Pinwheel Galaxy (North-East Horizon)
          const g24Size = Math.round(Math.min(220, minDim * 0.18));
          galaxies.push({
            id: 'pinwheel-ne-dist',
            relX: 0.92,
            relY: 0.06,
            width: g24Size,
            height: g24Size,
            angle: 0.50,
            driftVx: -0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.42,
            currentX: 0.92 * width,
            currentY: 0.06 * height,
            offscreenCanvas: createPinwheelGalaxyCanvas(g24Size),
          });

          // Galaxy 25: Distant Magellanic Clump (South-West)
          const g25Size = Math.round(Math.min(210, minDim * 0.17));
          galaxies.push({
            id: 'magellanic-sw-dist',
            relX: 0.14,
            relY: 0.94,
            width: g25Size,
            height: Math.round(g25Size * 0.75),
            angle: 0.32,
            driftVx: 0.001 * speedMultiplier,
            driftVy: 0.001 * speedMultiplier,
            alpha: 0.40,
            currentX: 0.14 * width,
            currentY: 0.94 * height,
            offscreenCanvas: createMagellanicIrregularCanvas(g25Size),
          });
        }
      }
    };

    // 3. INITIALIZE SUBTLE COSMIC DUST CLOUDS
    const initDustClouds = () => {
      dustClouds.length = 0;
      const isMobile = width < 600;
      const cloudCount = isMobile ? 7 : 12;

      const basePositions = [
        { x: 0.78, y: 0.24, rx: 200, ry: 100, rot: 0.4 },
        { x: 0.20, y: 0.76, rx: 180, ry: 90, rot: -0.3 },
        { x: 0.86, y: 0.58, rx: 170, ry: 80, rot: -0.2 },
        { x: 0.16, y: 0.42, rx: 160, ry: 80, rot: 0.3 },
        { x: 0.50, y: 0.11, rx: 150, ry: 75, rot: 0.1 },
        { x: 0.66, y: 0.86, rx: 160, ry: 80, rot: -0.4 },
        { x: 0.34, y: 0.62, rx: 150, ry: 70, rot: 0.5 },
        { x: 0.88, y: 0.32, rx: 140, ry: 65, rot: -0.25 },
        { x: 0.44, y: 0.76, rx: 165, ry: 85, rot: 0.2 },
        { x: 0.88, y: 0.12, rx: 145, ry: 70, rot: -0.35 },
        { x: 0.10, y: 0.26, rx: 155, ry: 75, rot: 0.45 },
        { x: 0.62, y: 0.30, rx: 140, ry: 70, rot: -0.15 },
      ];

      for (let i = 0; i < cloudCount; i++) {
        const bp = basePositions[i % basePositions.length];
        const scale = isMobile ? 0.75 : 1.0;
        dustClouds.push({
          relX: bp.x,
          relY: bp.y,
          radiusX: bp.rx * scale,
          radiusY: bp.ry * scale,
          rotation: bp.rot,
          alpha: 0.015 + Math.random() * 0.016,
          vx: (Math.random() - 0.5) * 0.005 * speedMultiplier,
          vy: (Math.random() - 0.5) * 0.005 * speedMultiplier,
          currentX: bp.x * width,
          currentY: bp.y * height,
        });
      }
    };

    // 4. INITIALIZE MULTI-LAYERED STARFIELD
    const initStars = () => {
      stars.length = 0;
      const isMobile = width < 600;
      const starCount = Math.floor(
        Math.min(460, Math.max(180, (width * height) / (isMobile ? 4800 : 3800)))
      );

      for (let i = 0; i < starCount; i++) {
        const layerRand = Math.random();
        let layer = 0;
        let radius = 0.4 + Math.random() * 0.25;
        let baseAlpha = 0.16 + Math.random() * 0.22;
        let speedFactor = 0.008;
        let hasGlow = false;

        if (layerRand > 0.90) {
          layer = 2;
          radius = 0.9 + Math.random() * 0.35;
          baseAlpha = 0.55 + Math.random() * 0.35;
          speedFactor = 0.026;
          hasGlow = Math.random() < 0.65;
        } else if (layerRand > 0.65) {
          layer = 1;
          radius = 0.6 + Math.random() * 0.30;
          baseAlpha = 0.30 + Math.random() * 0.28;
          speedFactor = 0.016;
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
      // 1. Dominant pure black background void
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // 2. Render subtle cosmic dust clouds
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

        const dGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cloud.radiusX);
        dGrad.addColorStop(0, `rgba(140, 150, 165, ${cloud.alpha.toFixed(4)})`);
        dGrad.addColorStop(0.5, `rgba(90, 100, 115, ${(cloud.alpha * 0.4).toFixed(4)})`);
        dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = dGrad;
        ctx.beginPath();
        ctx.arc(0, 0, cloud.radiusX, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Render multiple distant diffuse galaxy formations
      for (let i = 0; i < galaxies.length; i++) {
        const g = galaxies[i];
        g.currentX += g.driftVx;
        g.currentY += g.driftVy;

        const halfW = g.width / 2;
        const halfH = g.height / 2;

        ctx.save();
        ctx.globalAlpha = g.alpha;
        ctx.translate(g.currentX, g.currentY);
        ctx.rotate(g.angle);
        ctx.drawImage(g.offscreenCanvas, -halfW, -halfH, g.width, g.height);
        ctx.restore();
      }

      // 4. Render multi-layer starfield
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < -4) star.x = width + 4;
        if (star.x > width + 4) star.x = -4;
        if (star.y < -4) star.y = height + 4;
        if (star.y > height + 4) star.y = -4;

        star.twinklePhase += star.twinkleSpeed;
        const twinkleFactor = Math.sin(star.twinklePhase) * 0.42 + 0.58;
        star.currentAlpha = Math.max(0.06, Math.min(0.96, star.baseAlpha * twinkleFactor));

        if (star.hasGlow && star.currentAlpha > 0.45) {
          ctx.fillStyle = `rgba(215, 225, 240, ${(star.currentAlpha * 0.18).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${star.currentAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

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
