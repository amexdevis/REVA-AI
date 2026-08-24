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

interface Star {
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
}

interface GalaxyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface DustMote {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  color: string;
  phase: number;
  driftSpeed: number;
}

interface GalacticDustCluster {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
  angleOffset: number;
  distRatio: number;
  speed: number;
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

    // Realistic Starfield: Magnitude distribution
    const starCount = 260;
    const realisticStarColors = [
      '#ffffff',
      '#f8fafc',
      '#e2e8f0',
      '#e0e7ff',
      '#ede9fe',
      '#fef08a',
      '#fde047',
      '#fed7aa',
    ];

    const stars: Star[] = Array.from({ length: starCount }, () => {
      const depth = Math.random();
      const isForeground = depth > 0.88;
      const size =
        depth < 0.65
          ? Math.random() * 0.7 + 0.3
          : depth < 0.88
          ? Math.random() * 1.1 + 0.6
          : Math.random() * 1.8 + 1.1;
      const baseAlpha =
        depth < 0.65
          ? Math.random() * 0.35 + 0.2
          : depth < 0.88
          ? Math.random() * 0.5 + 0.35
          : Math.random() * 0.4 + 0.6;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        depth,
        baseAlpha,
        twinkleSpeed: Math.random() * 0.015 + 0.004,
        twinklePhase: Math.random() * Math.PI * 2,
        color: realisticStarColors[Math.floor(Math.random() * realisticStarColors.length)],
        vx: (depth * 0.006 + 0.002) * -1,
        vy: (depth * 0.003 + 0.001) * -1,
        hasSpike: isForeground && Math.random() < 0.28,
      };
    });

    // Galactic Dust Clusters
    const galacticClusters: GalacticDustCluster[] = [];
    const arms = 2;
    for (let i = 0; i < 220; i++) {
      const distRatio = Math.pow(Math.random(), 0.85);
      const angleOffset = (Math.random() - 0.5) * 0.4;
      const radius = 10 + Math.random() * 26;
      const colors = [
        'rgba(216, 180, 254, 0.12)',
        'rgba(192, 132, 252, 0.08)',
        'rgba(147, 51, 234, 0.06)',
        'rgba(254, 240, 138, 0.06)',
        'rgba(255, 255, 255, 0.15)',
      ];
      galacticClusters.push({
        x: 0,
        y: 0,
        radius,
        alpha: Math.random() * 0.45 + 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
        angleOffset,
        distRatio,
        speed: 0.96 + Math.random() * 0.08,
      });
    }

    // Dynamic Fading Galaxy Energy Particles
    const galaxyParticles: GalaxyParticle[] = [];
    const maxGalaxyParticles = 35;

    // Cosmic Dust Motes
    const dustCount = 30;
    const dustMotes: DustMote[] = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(Math.random() * 0.12 + 0.04),
      alpha: Math.random() * 0.35 + 0.15,
      baseAlpha: Math.random() * 0.35 + 0.15,
      color: Math.random() > 0.6 ? '#f3e8ff' : '#d8b4fe',
      phase: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.008 + 0.004,
    }));

    let tick = 0;
    let galaxyRotation = 0;
    let saturnRingOscillation = 0;

    const render = () => {
      tick++;
      if (!prefersReducedMotion) {
        galaxyRotation += 0.00035;
        saturnRingOscillation += 0.0004;
      }

      const audioBoost = Math.max(userAudioLevel, revaAudioLevel);

      // ==========================================
      // 1. DEEP SPACE CANVAS WITH COLOR-GRADED VIOLET OBSIDIAN DEPTH
      // ==========================================
      const spaceGrad = ctx.createRadialGradient(
        width * 0.75, height * 0.32, 10,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.95
      );
      spaceGrad.addColorStop(0, '#0f0422');
      spaceGrad.addColorStop(0.35, '#060110');
      spaceGrad.addColorStop(0.7, '#020006');
      spaceGrad.addColorStop(1, '#000000');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, width, height);

      // ==========================================
      // 2. DIAGONAL GALACTIC DUST LANE (Crossing from center-left behind REVA to top-right)
      // ==========================================
      ctx.save();
      const dustLaneGrad = ctx.createLinearGradient(0, height * 0.65, width, height * 0.28);
      dustLaneGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      dustLaneGrad.addColorStop(0.25, 'rgba(59, 13, 100, 0.12)');
      dustLaneGrad.addColorStop(0.5, 'rgba(126, 34, 206, 0.18)');
      dustLaneGrad.addColorStop(0.72, 'rgba(217, 119, 6, 0.14)');
      dustLaneGrad.addColorStop(0.85, 'rgba(254, 240, 138, 0.16)');
      dustLaneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = dustLaneGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // ==========================================
      // 3. CURVED PLANETARY LIMB (Lower Left Earth/Titan Horizon)
      // Matching Reference Image with Rayleigh Atmosphere & City Lights
      // ==========================================
      const pLimbX = width * -0.12;
      const pLimbY = height * 1.15;
      const pLimbRadius = Math.min(width, height) * 0.88;

      ctx.save();
      // Dark planetary body
      const pBodyGrad = ctx.createRadialGradient(
        pLimbX, pLimbY, pLimbRadius * 0.6,
        pLimbX, pLimbY, pLimbRadius
      );
      pBodyGrad.addColorStop(0, '#010206');
      pBodyGrad.addColorStop(0.82, '#030818');
      pBodyGrad.addColorStop(0.96, '#081735');
      pBodyGrad.addColorStop(1, '#0e2452');
      ctx.fillStyle = pBodyGrad;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric Rayleigh scattering rim (Bright Cyan & Blue & Violet Glow)
      const atmoGrad = ctx.createRadialGradient(
        pLimbX, pLimbY, pLimbRadius - 6,
        pLimbX, pLimbY, pLimbRadius + 12
      );
      atmoGrad.addColorStop(0, 'rgba(96, 165, 250, 0.7)');
      atmoGrad.addColorStop(0.35, 'rgba(129, 140, 248, 0.55)');
      atmoGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.35)');
      atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.strokeStyle = atmoGrad;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius, -Math.PI * 0.45, 0.1);
      ctx.stroke();

      // Razor-sharp 1px outer atmospheric filament
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pLimbX, pLimbY, pLimbRadius, -Math.PI * 0.45, 0.1);
      ctx.stroke();
      ctx.restore();

      // ==========================================
      // 4. DISTANT RADIANT SUN & HORIZONTAL ANAMORPHIC FLARE
      // (Located at center-right horizon behind REVA's shoulder, as in reference image)
      // ==========================================
      const sunX = width * 0.74;
      const sunY = height * 0.31;
      const sunPulse = Math.sin(tick * 0.008) * 0.03 + 1;

      ctx.save();
      // Broad golden volumetric illumination
      const sunAmbient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 320 * sunPulse);
      sunAmbient.addColorStop(0, 'rgba(254, 243, 199, 0.32)');
      sunAmbient.addColorStop(0.2, 'rgba(251, 191, 36, 0.18)');
      sunAmbient.addColorStop(0.5, 'rgba(216, 180, 254, 0.08)');
      sunAmbient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunAmbient;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 320 * sunPulse, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal cinematic lens flare beam (matching reference image)
      const flareGrad = ctx.createLinearGradient(sunX - 280, sunY, sunX + 280, sunY);
      flareGrad.addColorStop(0, 'rgba(254, 243, 199, 0)');
      flareGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.25)');
      flareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
      flareGrad.addColorStop(0.65, 'rgba(254, 240, 138, 0.25)');
      flareGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(sunX - 280, sunY - 2, 560, 4);

      // Core Corona
      const sunCorona = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 50);
      sunCorona.addColorStop(0, '#ffffff');
      sunCorona.addColorStop(0.2, '#fef08a');
      sunCorona.addColorStop(0.6, 'rgba(245, 158, 11, 0.55)');
      sunCorona.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = sunCorona;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
      ctx.fill();

      // Intense White Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ==========================================
      // 5. REALISTIC STARS WITH 3-LAYER DEPTH & TWINKLING
      // ==========================================
      stars.forEach((s) => {
        if (!prefersReducedMotion) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0) s.x = width;
          if (s.y < 0) s.y = height;
        }

        const twinkle = Math.sin(tick * s.twinkleSpeed + s.twinklePhase) * 0.25 + 0.75;
        const currentAlpha = Math.min(
          1,
          s.baseAlpha * twinkle + (s.depth > 0.85 ? audioBoost * 0.15 : 0)
        );

        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.04, currentAlpha);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        if (s.hasSpike && twinkle > 0.88) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          const spikeLen = s.size * 3.2;
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
      // 6. GRAND SPIRAL GALAXY & FLOWING ENERGY PARTICLES
      // ==========================================
      const galCenterX = width * 0.82;
      const galCenterY = height * 0.22;
      const maxArmRadius = 180;

      ctx.save();
      ctx.translate(galCenterX, galCenterY);

      // Core galactic bulge
      const galBulge = ctx.createRadialGradient(0, 0, 0, 0, 0, 65);
      galBulge.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      galBulge.addColorStop(0.2, 'rgba(254, 240, 138, 0.35)');
      galBulge.addColorStop(0.5, 'rgba(192, 132, 252, 0.18)');
      galBulge.addColorStop(0.85, 'rgba(147, 51, 234, 0.06)');
      galBulge.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = galBulge;
      ctx.beginPath();
      ctx.ellipse(0, 0, 70, 36, 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Spiral arms dust clusters
      galacticClusters.forEach((gc, idx) => {
        const armIndex = idx % 2;
        const dist = 12 + gc.distRatio * (maxArmRadius - 12);
        const spiralAngle =
          armIndex * Math.PI +
          Math.log(dist / 10) * 1.55 +
          gc.angleOffset +
          galaxyRotation * gc.speed;

        const gx = Math.cos(spiralAngle) * dist;
        const gy = Math.sin(spiralAngle) * (dist * 0.58);

        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gc.radius);
        grad.addColorStop(0, gc.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, gc.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Occasionally release subtle luminous energy particles from galaxy core
      if (!prefersReducedMotion && Math.random() < 0.08 && galaxyParticles.length < maxGalaxyParticles) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.3 + 0.1;
        galaxyParticles.push({
          x: galCenterX + (Math.random() - 0.5) * 40,
          y: galCenterY + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 120 + Math.random() * 100,
          size: Math.random() * 1.4 + 0.6,
          color: Math.random() > 0.5 ? '#f3e8ff' : '#fed7aa',
        });
      }

      // Render flowing galaxy particles
      for (let i = galaxyParticles.length - 1; i >= 0; i--) {
        const gp = galaxyParticles[i];
        gp.life++;
        gp.x += gp.vx;
        gp.y += gp.vy;

        const progress = gp.life / gp.maxLife;
        const pAlpha = Math.sin(progress * Math.PI) * 0.5;

        ctx.fillStyle = gp.color;
        ctx.globalAlpha = pAlpha;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, gp.size, 0, Math.PI * 2);
        ctx.fill();

        if (gp.life >= gp.maxLife) {
          galaxyParticles.splice(i, 1);
        }
      }
      ctx.globalAlpha = 1.0;

      // ==========================================
      // 7. REALISTIC RINGED SATURN-LIKE PLANET (Upper Left, matching reference image)
      // ==========================================
      const rPlanetX = width * 0.31;
      const rPlanetY = height * 0.27;
      const rPlanetRadius = 26;

      ctx.save();
      ctx.translate(rPlanetX, rPlanetY);

      // Back of rings
      const ringTilt = -0.42 + Math.sin(saturnRingOscillation) * 0.015;
      ctx.save();
      ctx.rotate(ringTilt);

      // Outer ring back
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.3)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 64, 16, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Inner ring back
      ctx.strokeStyle = 'rgba(238, 210, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 12, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Planet Spherical Shading (Terminator aligned with sun to the right)
      const lightAngle = Math.atan2(sunY - rPlanetY, sunX - rPlanetX);
      const lightOffsetDist = rPlanetRadius * 0.45;
      const lightCenterX = Math.cos(lightAngle) * lightOffsetDist;
      const lightCenterY = Math.sin(lightAngle) * lightOffsetDist;

      const planetGrad = ctx.createRadialGradient(
        lightCenterX, lightCenterY, 2,
        0, 0, rPlanetRadius
      );
      planetGrad.addColorStop(0, '#f5d0fe');
      planetGrad.addColorStop(0.3, '#c084fc');
      planetGrad.addColorStop(0.65, '#581c87');
      planetGrad.addColorStop(0.88, '#1e0836');
      planetGrad.addColorStop(1, '#05010a');
      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rPlanetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric rim light on sunlit side
      ctx.strokeStyle = 'rgba(245, 208, 254, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, rPlanetRadius, lightAngle - Math.PI * 0.45, lightAngle + Math.PI * 0.45);
      ctx.stroke();

      // Front of rings
      ctx.save();
      ctx.rotate(ringTilt);

      // Outer ring front
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.4)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 64, 16, 0, 0, Math.PI);
      ctx.stroke();

      // Inner ring front
      ctx.strokeStyle = 'rgba(238, 210, 255, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 12, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // ==========================================
      // 8. DISTANT SATELLITE CELESTIAL BODIES (Right side, matching reference image)
      // ==========================================
      // Satellite 1: Mid-Right Planet
      const p1X = width * 0.66;
      const p1Y = height * 0.61;
      const p1Radius = 14;
      const p1LightAngle = Math.atan2(sunY - p1Y, sunX - p1X);
      const p1LX = p1X + Math.cos(p1LightAngle) * (p1Radius * 0.4);
      const p1LY = p1Y + Math.sin(p1LightAngle) * (p1Radius * 0.4);

      const p1Grad = ctx.createRadialGradient(p1LX, p1LY, 1, p1X, p1Y, p1Radius);
      p1Grad.addColorStop(0, '#e9d5ff');
      p1Grad.addColorStop(0.35, '#a855f7');
      p1Grad.addColorStop(0.75, '#3b0764');
      p1Grad.addColorStop(1, '#05010a');
      ctx.fillStyle = p1Grad;
      ctx.beginPath();
      ctx.arc(p1X, p1Y, p1Radius, 0, Math.PI * 2);
      ctx.fill();

      // Satellite 2: Lower-Right Rim-Lit Moon
      const p2X = width * 0.95;
      const p2Y = height * 0.7;
      const p2Radius = 24;
      const p2LightAngle = Math.atan2(sunY - p2Y, sunX - p2X);
      const p2LX = p2X + Math.cos(p2LightAngle) * (p2Radius * 0.45);
      const p2LY = p2Y + Math.sin(p2LightAngle) * (p2Radius * 0.45);

      const p2Grad = ctx.createRadialGradient(p2LX, p2LY, 1, p2X, p2Y, p2Radius);
      p2Grad.addColorStop(0, '#f3e8ff');
      p2Grad.addColorStop(0.3, '#9333ea');
      p2Grad.addColorStop(0.7, '#2e1065');
      p2Grad.addColorStop(1, '#020005');
      ctx.fillStyle = p2Grad;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, p2Radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(216, 180, 254, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p2X, p2Y, p2Radius, p2LightAngle - Math.PI * 0.4, p2LightAngle + Math.PI * 0.4);
      ctx.stroke();

      // ==========================================
      // 9. GENTLE DRIFTING COSMIC DUST MOTES
      // ==========================================
      dustMotes.forEach((d) => {
        if (!prefersReducedMotion) {
          d.y += d.vy;
          d.x += d.vx + Math.sin(tick * d.driftSpeed + d.phase) * 0.12;

          if (d.y < -10) {
            d.y = height + 10;
            d.x = Math.random() * width;
          }
        }

        const alphaPulse = Math.sin(tick * d.driftSpeed + d.phase) * 0.2 + 0.8;
        const currentAlpha = Math.min(0.6, d.baseAlpha * alphaPulse + audioBoost * 0.15);

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = Math.max(0.02, currentAlpha);
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
      {/* Soft atmospheric violet ambient aura centered behind REVA */}
      <div
        className="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] sm:w-[680px] h-[680px] rounded-full blur-[160px] pointer-events-none transition-all duration-1000"
        style={{
          backgroundColor: isSpeaking
            ? 'rgba(168, 85, 247, 0.16)'
            : isListening
            ? 'rgba(147, 51, 234, 0.13)'
            : 'rgba(107, 33, 168, 0.09)',
          transform: `translate(-50%, -50%) scale(${1 + audioLevel * 0.08})`,
          opacity: 0.85,
        }}
      />

      {/* Living Cosmic Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
