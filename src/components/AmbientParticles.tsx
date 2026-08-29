/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';

interface AmbientParticlesProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
}

interface RealisticStar {
  x: number;
  y: number;
  size: number;
  depth: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  vx: number;
  vy: number;
  hasSpike?: boolean;
  spectralType: 'O_BLUE' | 'A_WHITE' | 'G_WARM' | 'M_AMBER';
}

interface GalaxyGasPocket {
  armIndex: number;
  distRatio: number;
  angleOffset: number;
  radius: number;
  alpha: number;
  color: string;
  speed: number;
}

interface DustMote {
  x: number;
  y: number;
  size: number;
  depth: 'FAR' | 'MID' | 'FOREGROUND';
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  colorType: 'NEUTRAL' | 'WARM_GOLD' | 'VIOLET';
  phase: number;
  driftSpeed: number;
}

export const AmbientParticles: React.FC<AmbientParticlesProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState = 'CALM',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // ==========================================
    // REALISTIC STARFIELD GENERATION
    // Accurate magnitude distribution: mostly faint micro-points, very few bright foreground anchors
    // ==========================================
    const starCount = 260;
    const stars: RealisticStar[] = Array.from({ length: starCount }, () => {
      const depth = Math.random();
      // True astrophotography stars: pinpricks of light rather than large circles
      let size: number;
      let baseAlpha: number;
      let hasSpike = false;

      if (depth < 0.72) {
        // Deep background distant micro-stars (vast majority): ultra-soft, low brightness
        size = Math.random() * 0.35 + 0.25;
        baseAlpha = Math.random() * 0.22 + 0.08;
      } else if (depth < 0.93) {
        // Midground stars: soft natural light
        size = Math.random() * 0.45 + 0.5;
        baseAlpha = Math.random() * 0.32 + 0.25;
      } else {
        // Foreground prominent anchor stars (rare): crisp with delicate scintillation
        size = Math.random() * 0.6 + 0.85;
        baseAlpha = Math.random() * 0.3 + 0.55;
        hasSpike = Math.random() < 0.2;
      }

      // Realistic stellar spectral classification (O/B blue-white, A pure white, G warm yellow, M faint red/amber)
      const colorRoll = Math.random();
      let color = '#ffffff';
      let spectralType: RealisticStar['spectralType'] = 'A_WHITE';

      if (colorRoll < 0.48) {
        color = '#ffffff';
        spectralType = 'A_WHITE';
      } else if (colorRoll < 0.74) {
        color = '#e0f2fe'; // Pale Diamond Blue
        spectralType = 'O_BLUE';
      } else if (colorRoll < 0.89) {
        color = '#fef3c7'; // Warm Solar Cream
        spectralType = 'G_WARM';
      } else {
        color = '#fed7aa'; // Soft Amber
        spectralType = 'M_AMBER';
      }

      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        depth,
        baseAlpha,
        twinkleSpeed: Math.random() * 0.01 + 0.003,
        twinklePhase: Math.random() * Math.PI * 2,
        color,
        spectralType,
        vx: (depth * 0.0035 + 0.0008) * -1,
        vy: (depth * 0.0018 + 0.0006) * -1,
        hasSpike,
      };
    });

    // ==========================================
    // REALISTIC SPIRAL GALAXY GAS & DUST GENERATION
    // Logarithmic spiral distribution with dark dust lanes, volumetric gas clouds & subtle absorption
    // ==========================================
    const galaxyGasPockets: GalaxyGasPocket[] = [];
    const galaxyGasCount = 190;
    const gasColors = [
      'rgba(245, 235, 255, 0.06)', // Stellar core haze
      'rgba(216, 180, 254, 0.045)', // Ionized hydrogen / soft violet
      'rgba(167, 139, 250, 0.035)', // Interstellar medium
      'rgba(129, 140, 248, 0.03)', // Distant blue arm fringe
      'rgba(254, 243, 199, 0.04)', // Warm stellar cluster
      'rgba(76, 29, 149, 0.035)', // Deep violet absorption gas
    ];

    for (let i = 0; i < galaxyGasCount; i++) {
      const armIndex = i % 2;
      const distRatio = Math.pow(Math.random(), 0.85);
      const angleOffset = (Math.random() - 0.5) * 0.38;
      const radius = 14 + Math.random() * 26;
      galaxyGasPockets.push({
        armIndex,
        distRatio,
        angleOffset,
        radius,
        alpha: Math.random() * 0.3 + 0.08,
        color: gasColors[Math.floor(Math.random() * gasColors.length)],
        speed: 0.98 + Math.random() * 0.04,
      });
    }

    // ==========================================
    // COSMIC STARDUST MOTES WITH 3-TIER DEPTH PARALLAX
    // Low density: Far microscopic motes, mid drifting motes, foreground soft bokeh motes
    // ==========================================
    const dustMotes: DustMote[] = [];

    // Tier 1: FAR dust motes (almost stationary, micro pinpricks)
    for (let i = 0; i < 16; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.35 + 0.35,
        depth: 'FAR',
        vx: (Math.random() - 0.5) * 0.012,
        vy: -(Math.random() * 0.018 + 0.006),
        alpha: Math.random() * 0.1 + 0.04,
        baseAlpha: Math.random() * 0.1 + 0.04,
        colorType: Math.random() > 0.6 ? 'VIOLET' : 'NEUTRAL',
        phase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.003 + 0.001,
      });
    }

    // Tier 2: MID-DEPTH dust motes (gentle cosmic drift)
    for (let i = 0; i < 14; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.5 + 0.65,
        depth: 'MID',
        vx: (Math.random() - 0.5) * 0.025,
        vy: -(Math.random() * 0.04 + 0.012),
        alpha: Math.random() * 0.15 + 0.06,
        baseAlpha: Math.random() * 0.15 + 0.06,
        colorType: Math.random() > 0.5 ? 'WARM_GOLD' : Math.random() > 0.5 ? 'VIOLET' : 'NEUTRAL',
        phase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.005 + 0.002,
      });
    }

    // Tier 3: FOREGROUND soft bokeh dust motes (subtle floating, catch light)
    for (let i = 0; i < 8; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.7 + 1.1,
        depth: 'FOREGROUND',
        vx: (Math.random() - 0.5) * 0.04,
        vy: -(Math.random() * 0.06 + 0.02),
        alpha: Math.random() * 0.18 + 0.08,
        baseAlpha: Math.random() * 0.18 + 0.08,
        colorType: Math.random() > 0.4 ? 'WARM_GOLD' : 'VIOLET',
        phase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.006 + 0.003,
      });
    }

    let tick = 0;
    let galaxyRotation = 0;
    let saturnRingOscillation = 0;

    const render = () => {
      tick++;
      if (!prefersReducedMotion) {
        galaxyRotation += 0.00025;
        saturnRingOscillation += 0.0003;
      }

      const audioBoost = Math.max(userAudioLevel, revaAudioLevel);

      // ==========================================
      // CELESTIAL MOTION & PARALLAX COORDINATES
      // Continuous, majestic slow orbital drift with depth-based speeds
      // ==========================================
      const motionTick = prefersReducedMotion ? 0 : tick;

      // 1. Distant Sun: subtle, majestic solar arc across upper-right horizon (~15 min cycle)
      const sunTime = motionTick * 0.00012;
      const sunX = width * (0.74 + Math.sin(sunTime) * 0.08 + Math.cos(sunTime * 0.5) * 0.03);
      const sunY = height * (0.31 + Math.cos(sunTime * 0.75) * 0.06);
      const sunPulse = Math.sin(tick * 0.006) * 0.02 + 1;

      // 2. Ringed Planet (Upper-Left): deep orbital glide across upper space
      const rPlanetTime = motionTick * 0.00018;
      const rPlanetX = width * (0.31 + Math.sin(rPlanetTime) * 0.16 + Math.cos(rPlanetTime * 0.6) * 0.05);
      const rPlanetY = height * (0.27 + Math.cos(rPlanetTime * 0.8) * 0.09);
      const rPlanetRadius = 25;

      // 3. Satellite 1 (Mid-Right): mid-depth celestial body with slightly faster parallax
      const p1Time = motionTick * 0.00026 + 1.2;
      const p1X = width * (0.66 + Math.cos(p1Time) * 0.15 + Math.sin(p1Time * 0.7) * 0.04);
      const p1Y = height * (0.61 + Math.sin(p1Time * 0.85) * 0.11);
      const p1Radius = 13;

      // 4. Satellite 2 (Lower-Right): slow majestic horizon orbit
      const p2Time = motionTick * 0.00015 + 2.8;
      const p2X = width * (0.92 + Math.sin(p2Time) * 0.12);
      const p2Y = height * (0.70 + Math.cos(p2Time * 0.7) * 0.08);
      const p2Radius = 23;

      // ==========================================
      // 1. DEEP SPACE VOID WITH REALISTIC OPTICAL GRADIENT
      // Subtle deep obsidian with midnight navy and dark violet undertones (non-cartoon)
      // ==========================================
      const spaceGrad = ctx.createRadialGradient(
        sunX, sunY, 20,
        width * 0.5, height * 0.55, Math.max(width, height) * 0.95
      );
      spaceGrad.addColorStop(0, '#090315'); // Near sun/galaxy illumination
      spaceGrad.addColorStop(0.25, '#04010b'); // Deep cosmic violet
      spaceGrad.addColorStop(0.62, '#020105'); // Interstellar shadow
      spaceGrad.addColorStop(1, '#000000'); // Pure space void
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // ==========================================
      // 2. SOFT VOLUMETRIC INTERSTELLAR ABSORPTION & EMISSION NEBULA
      // Layered subtle gas clouds with light falloff providing 3D depth without extra brightness
      // ==========================================
      ctx.save();

      // Soft diagonal cosmic dust lane crossing the background
      const nebulaGrad = ctx.createLinearGradient(0, height * 0.72, width, height * 0.22);
      nebulaGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      nebulaGrad.addColorStop(0.22, 'rgba(20, 5, 36, 0.07)');
      nebulaGrad.addColorStop(0.48, 'rgba(40, 12, 70, 0.09)');
      nebulaGrad.addColorStop(0.72, 'rgba(12, 18, 36, 0.075)');
      nebulaGrad.addColorStop(0.86, 'rgba(38, 20, 14, 0.055)');
      nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant soft emission cloud behind the upper right horizon
      const emissionGlow = ctx.createRadialGradient(
        sunX + width * 0.04, sunY - height * 0.05, 30,
        sunX + width * 0.04, sunY - height * 0.05, Math.min(width, height) * 0.48
      );
      emissionGlow.addColorStop(0, 'rgba(99, 36, 196, 0.065)');
      emissionGlow.addColorStop(0.38, 'rgba(58, 20, 104, 0.038)');
      emissionGlow.addColorStop(0.75, 'rgba(15, 23, 42, 0.015)');
      emissionGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = emissionGlow;
      ctx.fillRect(0, 0, width, height);

      // Radial gradient depth mask applied directly over nebula clouds:
      // Darkens the center region to increase perceived distance from the foreground, while edges softly fade into deep black space
      const nebulaRadialMask = ctx.createRadialGradient(
        width * 0.5, height * 0.5, 40,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.75
      );
      nebulaRadialMask.addColorStop(0, 'rgba(2, 1, 5, 0.55)'); // Center: darkened for separation and deep distance
      nebulaRadialMask.addColorStop(0.3, 'rgba(3, 1, 8, 0.35)'); // Mid-inner transition
      nebulaRadialMask.addColorStop(0.65, 'rgba(10, 3, 20, 0.08)'); // Subtle celestial luminescence band
      nebulaRadialMask.addColorStop(1, 'rgba(0, 0, 0, 0.7)'); // Outer periphery: seamlessly blends into pure black void
      ctx.fillStyle = nebulaRadialMask;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();

      // ==========================================
      // 3. CURVED PLANETARY LIMB (Lower Left Horizon)
      // Realistic Rayleigh Scattering, Exponential Atmospheric Falloff, Dark Shadow Hemisphere
      // ==========================================
      const pLimbX = width * -0.12;
      const pLimbY = height * 1.15;
      const pLimbRadius = Math.min(width, height) * 0.88;

      ctx.save();

      // Deep unlit planetary mass with absolute shadow occlusion
      const pBodyGrad = ctx.createRadialGradient(
        pLimbX, pLimbY, pLimbRadius * 0.65,
        pLimbX, pLimbY, pLimbRadius
      );
      pBodyGrad.addColorStop(0, '#000000');
      pBodyGrad.addColorStop(0.85, '#010106');
      pBodyGrad.addColorStop(0.96, '#030614');
      pBodyGrad.addColorStop(1, '#051024');
      ctx.fillStyle = pBodyGrad;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric Rayleigh scattering: natural exponential gradient falloff into space
      const atmoGrad = ctx.createRadialGradient(
        pLimbX, pLimbY, pLimbRadius - 3,
        pLimbX, pLimbY, pLimbRadius + 16
      );
      atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
      atmoGrad.addColorStop(0.2, 'rgba(99, 102, 241, 0.26)');
      atmoGrad.addColorStop(0.55, 'rgba(147, 51, 234, 0.12)');
      atmoGrad.addColorStop(0.85, 'rgba(59, 130, 246, 0.03)');
      atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.strokeStyle = atmoGrad;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius + 2, -Math.PI * 0.45, 0.1);
      ctx.stroke();

      // Fine grazing sunlight horizon airglow
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius, -Math.PI * 0.45, 0.08);
      ctx.stroke();

      ctx.restore();

      // ==========================================
      // 4. DISTANT RADIANT SUN & OPTICAL CORONA (Center-Right Horizon)
      // Natural Solar Photometrics, Soft Warm-White/Gold Light, Gentle Falloff
      // ==========================================
      ctx.save();

      // Broad astronomical ambient illumination (soft gold into deep violet space)
      const sunAmbient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 260 * sunPulse);
      sunAmbient.addColorStop(0, 'rgba(255, 252, 242, 0.18)');
      sunAmbient.addColorStop(0.14, 'rgba(253, 230, 138, 0.09)');
      sunAmbient.addColorStop(0.38, 'rgba(196, 148, 250, 0.035)');
      sunAmbient.addColorStop(0.75, 'rgba(24, 16, 52, 0.01)');
      sunAmbient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunAmbient;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 260 * sunPulse, 0, Math.PI * 2);
      ctx.fill();

      // Subtle horizontal optical lens dispersion (feathered, non-intrusive)
      const flareWidth = 380;
      const flareGrad = ctx.createLinearGradient(sunX - flareWidth / 2, sunY, sunX + flareWidth / 2, sunY);
      flareGrad.addColorStop(0, 'rgba(254, 243, 199, 0)');
      flareGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.045)');
      flareGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.38)');
      flareGrad.addColorStop(0.52, 'rgba(255, 255, 255, 0.38)');
      flareGrad.addColorStop(0.65, 'rgba(254, 240, 138, 0.045)');
      flareGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(sunX - flareWidth / 2, sunY - 1, flareWidth, 2);

      // Inner Solar Corona Atmosphere
      const sunCorona = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 32);
      sunCorona.addColorStop(0, '#ffffff');
      sunCorona.addColorStop(0.22, '#fef9c3');
      sunCorona.addColorStop(0.55, 'rgba(245, 158, 11, 0.22)');
      sunCorona.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunCorona;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
      ctx.fill();

      // Stellar Core Pinprick
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // ==========================================
      // 5. REALISTIC STARS WITH 3-LAYER DEPTH & NATURAL TWINKLE
      // Sub-pixel pinpricks, delicate scintillation, spectral temperature colors
      // ==========================================
      stars.forEach((s) => {
        if (!prefersReducedMotion) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0) s.x = width;
          if (s.y < 0) s.y = height;
        }

        const twinkle = Math.sin(tick * s.twinkleSpeed + s.twinklePhase) * 0.2 + 0.8;
        const currentAlpha = Math.min(
          1,
          s.baseAlpha * twinkle + (s.depth > 0.88 ? audioBoost * 0.12 : 0)
        );

        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.03, currentAlpha);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Very delicate diffraction spikes only for bright foreground anchor stars at peak twinkle
        if (s.hasSpike && twinkle > 0.92) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.4;
          const spikeLen = s.size * 2.6;
          ctx.beginPath();
          ctx.moveTo(s.x - spikeLen, s.y);
          ctx.lineTo(s.x + spikeLen, s.y);
          ctx.moveTo(s.x, s.y - spikeLen);
          ctx.lineTo(s.x, s.y + spikeLen);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1.0;

      // ==========================================
      // 6. REALISTIC SPIRAL GALAXY (Upper Right)
      // Smooth Logarithmic Spiral Arms, Warm Stellar Core Bulge, Dark Absorption Dust Lanes
      // ==========================================
      const galCenterX = width * 0.82;
      const galCenterY = height * 0.22;
      const maxArmRadius = 175;

      ctx.save();
      ctx.translate(galCenterX, galCenterY);

      // Galactic core stellar population (dense warm bulge with smooth exponential falloff)
      const galBulge = ctx.createRadialGradient(0, 0, 0, 0, 0, 55);
      galBulge.addColorStop(0, 'rgba(255, 253, 245, 0.45)');
      galBulge.addColorStop(0.18, 'rgba(254, 240, 138, 0.25)');
      galBulge.addColorStop(0.48, 'rgba(216, 180, 254, 0.1)');
      galBulge.addColorStop(0.8, 'rgba(109, 40, 217, 0.03)');
      galBulge.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = galBulge;
      ctx.beginPath();
      ctx.ellipse(0, 0, 60, 32, 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Soft galactic spiral arm gas and dust clusters
      galaxyGasPockets.forEach((gc) => {
        const dist = 10 + gc.distRatio * (maxArmRadius - 10);
        const spiralAngle =
          gc.armIndex * Math.PI +
          Math.log(dist / 9) * 1.52 +
          gc.angleOffset +
          galaxyRotation * gc.speed;

        const gx = Math.cos(spiralAngle) * dist;
        const gy = Math.sin(spiralAngle) * (dist * 0.54);

        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gc.radius);
        grad.addColorStop(0, gc.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, gc.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Dark dust absorption lanes running along inner spiral arms
      for (let arm = 0; arm < 2; arm++) {
        ctx.beginPath();
        for (let d = 20; d < maxArmRadius - 20; d += 15) {
          const laneAngle = arm * Math.PI + Math.log(d / 9) * 1.52 - 0.12 + galaxyRotation;
          const lx = Math.cos(laneAngle) * d;
          const ly = Math.sin(laneAngle) * (d * 0.54);
          if (d === 20) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        }
        ctx.strokeStyle = 'rgba(4, 1, 10, 0.28)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      ctx.restore();

      // ==========================================
      // 7. REALISTIC RINGED PLANET WITH PHYSICAL SHADING & RING SHADOWS (Upper Left)
      // Photorealistic Spherical Terminator, Cast Shadows, Atmospheric Limb Glint & Atmospheric Space Haze
      // ==========================================
      ctx.save();

      // Subtle atmospheric space haze around ringed planet
      const rPlanetHaze = ctx.createRadialGradient(rPlanetX, rPlanetY, 0, rPlanetX, rPlanetY, rPlanetRadius * 2.6);
      rPlanetHaze.addColorStop(0, 'rgba(168, 85, 247, 0.035)');
      rPlanetHaze.addColorStop(0.5, 'rgba(109, 40, 217, 0.015)');
      rPlanetHaze.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rPlanetHaze;
      ctx.beginPath();
      ctx.arc(rPlanetX, rPlanetY, rPlanetRadius * 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(rPlanetX, rPlanetY);

      const ringTilt = -0.42 + Math.sin(saturnRingOscillation) * 0.012;
      const lightAngle = Math.atan2(sunY - rPlanetY, sunX - rPlanetX);
      const lightOffsetDist = rPlanetRadius * 0.42;
      const lightCenterX = Math.cos(lightAngle) * lightOffsetDist;
      const lightCenterY = Math.sin(lightAngle) * lightOffsetDist;

      // 1. BACK OF RINGS (behind planet)
      ctx.save();
      ctx.rotate(ringTilt);

      // Back outer A-ring (ice-dust composition)
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 15, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Cassini Division (dark gap)
      ctx.strokeStyle = 'rgba(2, 1, 6, 0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 54, 13, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Back inner B-ring (dense reflective ice)
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.28)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48, 11.5, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Faint transparent C-ring (crepe ring)
      ctx.strokeStyle = 'rgba(196, 181, 253, 0.08)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 10, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Shadow cast by planet onto the back rings
      ctx.fillStyle = 'rgba(1, 0, 4, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, rPlanetRadius + 1, lightAngle + Math.PI * 0.58, lightAngle + Math.PI * 1.42);
      ctx.ellipse(0, 0, 64, 16, 0, lightAngle + Math.PI * 0.58, lightAngle + Math.PI * 1.42);
      ctx.fill();

      ctx.restore();

      // 2. PLANET BODY WITH REALISTIC SPHERICAL SHADING & SUBTLE CLOUD BANDS
      const planetGrad = ctx.createRadialGradient(
        lightCenterX, lightCenterY, 2,
        0, 0, rPlanetRadius
      );
      planetGrad.addColorStop(0, '#fdf4ff'); // Soft warm solar illumination
      planetGrad.addColorStop(0.22, '#c4b5fd'); // Atmospheric diffusion
      planetGrad.addColorStop(0.55, '#581c87'); // Deep violet planetary mantle
      planetGrad.addColorStop(0.82, '#1e0836'); // Terminator twilight
      planetGrad.addColorStop(1, '#020006'); // Complete night-side shadow
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rPlanetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle atmospheric cloud bands across the planet
      ctx.save();
      ctx.clip(); // Clip to planet sphere
      ctx.rotate(ringTilt * 0.6);
      for (let b = -rPlanetRadius; b < rPlanetRadius; b += 4) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.022)';
        ctx.fillRect(-rPlanetRadius, b, rPlanetRadius * 2, 1.8);
      }

      // Natural shadow cast by rings onto the planet's sunlit hemisphere
      ctx.fillStyle = 'rgba(2, 0, 6, 0.6)';
      ctx.fillRect(-rPlanetRadius, -1.8, rPlanetRadius * 2, 3.2);
      ctx.restore();

      // Atmospheric rim light on sunlit crest (grazing sunlight)
      ctx.strokeStyle = 'rgba(233, 213, 255, 0.4)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, rPlanetRadius, lightAngle - Math.PI * 0.42, lightAngle + Math.PI * 0.42);
      ctx.stroke();

      // 3. FRONT OF RINGS (passing in front of planet)
      ctx.save();
      ctx.rotate(ringTilt);

      // Front outer A-ring
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.24)';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 15, 0, 0, Math.PI);
      ctx.stroke();

      // Cassini Division front
      ctx.strokeStyle = 'rgba(2, 1, 6, 0.92)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 54, 13, 0, 0, Math.PI);
      ctx.stroke();

      // Front inner B-ring
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.38)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48, 11.5, 0, 0, Math.PI);
      ctx.stroke();

      // Front transparent C-ring
      ctx.strokeStyle = 'rgba(196, 181, 253, 0.12)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 10, 0, 0, Math.PI);
      ctx.stroke();

      ctx.restore();
      ctx.restore();

      // ==========================================
      // 8. DISTANT CELESTIAL SATELLITE BODIES (Mid-Right & Lower-Right)
      // Natural Lambertian Shading, Dark Obsidian Night Side, Delicate Rim Light
      // ==========================================
      // Satellite 1: Mid-Right Planetoid
      const p1LightAngle = Math.atan2(sunY - p1Y, sunX - p1X);
      const p1LX = p1X + Math.cos(p1LightAngle) * (p1Radius * 0.38);
      const p1LY = p1Y + Math.sin(p1LightAngle) * (p1Radius * 0.38);

      const p1Grad = ctx.createRadialGradient(p1LX, p1LY, 1, p1X, p1Y, p1Radius);
      p1Grad.addColorStop(0, '#f5f3ff');
      p1Grad.addColorStop(0.24, '#7c3aed');
      p1Grad.addColorStop(0.62, '#310954');
      p1Grad.addColorStop(0.88, '#0d0217');
      p1Grad.addColorStop(1, '#000000');
      ctx.fillStyle = p1Grad;
      ctx.beginPath();
      ctx.arc(p1X, p1Y, p1Radius, 0, Math.PI * 2);
      ctx.fill();

      // Satellite 2: Lower-Right Celestial Body
      const p2LightAngle = Math.atan2(sunY - p2Y, sunX - p2X);
      const p2LX = p2X + Math.cos(p2LightAngle) * (p2Radius * 0.42);
      const p2LY = p2Y + Math.sin(p2LightAngle) * (p2Radius * 0.42);

      const p2Grad = ctx.createRadialGradient(p2LX, p2LY, 1, p2X, p2Y, p2Radius);
      p2Grad.addColorStop(0, '#fdf4ff');
      p2Grad.addColorStop(0.22, '#6d28d9');
      p2Grad.addColorStop(0.6, '#23074d');
      p2Grad.addColorStop(0.86, '#080114');
      p2Grad.addColorStop(1, '#000000');
      ctx.fillStyle = p2Grad;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, p2Radius, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric rim light on sunlit crest
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.35)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, p2Radius, p2LightAngle - Math.PI * 0.38, p2LightAngle + Math.PI * 0.38);
      ctx.stroke();

      // ==========================================
      // 9. DRIFTING BOKEH STARDUST MOTES WITH 3-TIER DEPTH
      // Microscopic stardust drift with soft optical alpha and ambient light catching
      // ==========================================
      dustMotes.forEach((d) => {
        if (!prefersReducedMotion) {
          d.y += d.vy;
          d.x += d.vx + Math.sin(tick * d.driftSpeed + d.phase) * 0.05;

          if (d.y < -15) {
            d.y = height + 15;
            d.x = Math.random() * width;
          }
          if (d.x < -15) d.x = width + 15;
          if (d.x > width + 15) d.x = -15;
        }

        const alphaPulse = Math.sin(tick * d.driftSpeed + d.phase) * 0.15 + 0.85;
        let currentAlpha = d.baseAlpha * alphaPulse + audioBoost * 0.05;

        // Dynamic light catching: particles catch warm gold near sun or violet in ambient field
        const dxSun = d.x - sunX;
        const dySun = d.y - sunY;
        const distToSun = Math.sqrt(dxSun * dxSun + dySun * dySun);

        let moteColor = '#f1f5f9';
        if (d.colorType === 'WARM_GOLD' || (distToSun < 360 && d.depth !== 'FAR')) {
          const warmFactor = Math.max(0, 1 - distToSun / 360);
          moteColor = warmFactor > 0.35 ? '#fef3c7' : '#fed7aa';
          currentAlpha += warmFactor * 0.07;
        } else if (d.colorType === 'VIOLET') {
          moteColor = '#e9d5ff';
        } else {
          moteColor = '#f8fafc';
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = moteColor;
        ctx.globalAlpha = Math.min(0.38, Math.max(0.02, currentAlpha));
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [userAudioLevel, revaAudioLevel, sessionState, emotionalState]);

  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#000000]">
      {/* Cinematic subtle atmospheric violet back-illumination centered behind REVA */}
      <div
        className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] sm:w-[640px] h-[640px] rounded-full blur-[180px] pointer-events-none transition-all duration-1000"
        style={{
          backgroundColor: isSpeaking
            ? 'rgba(147, 51, 234, 0.12)'
            : isListening
            ? 'rgba(126, 34, 206, 0.09)'
            : 'rgba(76, 29, 149, 0.06)',
          transform: `translate(-50%, -50%) scale(${1 + audioLevel * 0.06})`,
          opacity: 0.8,
        }}
      />

      {/* Living Cosmic Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
