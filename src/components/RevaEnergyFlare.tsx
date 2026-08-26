/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface RevaEnergyFlareProps {
  isOffline?: boolean;
  enabled?: boolean;
}

interface Particle {
  id: number;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  size: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export const RevaEnergyFlare: React.FC<RevaEnergyFlareProps> = ({
  isOffline,
  enabled = true,
}) => {
  if (isOffline || !enabled) return null;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 600 });

  // Update canvas sizing matching REVA's container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    // 10-14 sparse trailing luminous particles
    const particles: Particle[] = [];
    const maxParticles = 12;

    const createParticle = (flareProgress: number, width: number, height: number): Particle => {
      const currentY = height * (1 - flareProgress);
      // Spawn around the core ribbon contour
      const spreadX = (Math.random() - 0.5) * (width * 0.5);
      return {
        id: Math.random(),
        x: width * 0.5 + spreadX,
        y: currentY + (Math.random() - 0.5) * 20,
        size: Math.random() * 2.2 + 1.2,
        alpha: Math.random() * 0.5 + 0.45,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.6 + 0.3),
        life: 0,
        maxLife: Math.random() * 45 + 35,
      };
    };

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const cycleDuration = 4.8; // 3.0s rise from feet to head + 1.8s calm pause
      const progressInCycle = (elapsed % cycleDuration) / cycleDuration;

      const { width, height } = dimensions;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      // Active flare phase: 0.0 to 0.625 (first 3.0s of 4.8s cycle)
      const isRising = progressInCycle <= 0.625;
      const riseFactor = isRising ? progressInCycle / 0.625 : 1; // 0 (feet) to 1 (head)

      if (isRising) {
        // Smooth easeInOut curve
        const smoothT =
          riseFactor < 0.5
            ? 2 * riseFactor * riseFactor
            : -1 + (4 - 2 * riseFactor) * riseFactor;

        // Flare Y coordinate: from 98% height (feet) up to 2% height (above head)
        const flareY = height * (0.98 - smoothT * 0.96);

        // Alpha envelope: fade in smoothly at feet, peak at waist/torso, fade softly at head
        let flareAlpha = 1.0;
        if (riseFactor < 0.1) {
          flareAlpha = riseFactor / 0.1;
        } else if (riseFactor > 0.8) {
          flareAlpha = Math.max(0, (1 - riseFactor) / 0.2);
        }

        // Width dynamics: narrow at feet, expands around hips/torso, narrows above head
        const dynamicWidth = width * (0.45 + Math.sin(smoothT * Math.PI) * 0.28);
        const coreCenterX = width * 0.5 + Math.sin(smoothT * Math.PI * 2.5) * 8; // Gentle S-curve drape

        ctx.save();

        // 1. Soft Lavender/Purple Outer Volumetric Aura (20-30px radius)
        const outerAura = ctx.createRadialGradient(
          coreCenterX, flareY, 2,
          coreCenterX, flareY, 28
        );
        outerAura.addColorStop(0, `rgba(168, 85, 247, ${0.45 * flareAlpha})`);
        outerAura.addColorStop(0.4, `rgba(147, 51, 234, ${0.28 * flareAlpha})`);
        outerAura.addColorStop(0.75, `rgba(126, 34, 206, ${0.12 * flareAlpha})`);
        outerAura.addColorStop(1, 'rgba(107, 33, 168, 0)');

        ctx.fillStyle = outerAura;
        ctx.beginPath();
        ctx.ellipse(coreCenterX, flareY, dynamicWidth * 0.55, 32, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Luminous Violet Ribbon Streak (5-8px core with glow)
        const ribbonGrad = ctx.createLinearGradient(
          coreCenterX - dynamicWidth * 0.5, flareY,
          coreCenterX + dynamicWidth * 0.5, flareY
        );
        ribbonGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
        ribbonGrad.addColorStop(0.2, `rgba(192, 132, 252, ${0.4 * flareAlpha})`);
        ribbonGrad.addColorStop(0.5, `rgba(233, 213, 255, ${0.9 * flareAlpha})`); // Bright lavender-violet core
        ribbonGrad.addColorStop(0.8, `rgba(192, 132, 252, ${0.4 * flareAlpha})`);
        ribbonGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');

        ctx.strokeStyle = ribbonGrad;
        ctx.lineWidth = 6;
        ctx.shadowColor = '#A855F7';
        ctx.shadowBlur = 18;

        // Draw curved energetic wave across silhouette
        ctx.beginPath();
        ctx.moveTo(coreCenterX - dynamicWidth * 0.48, flareY + 3);
        ctx.quadraticCurveTo(
          coreCenterX, flareY - 7,
          coreCenterX + dynamicWidth * 0.48, flareY + 4
        );
        ctx.stroke();

        // 3. Ultra-Bright Thin Core Center (2px)
        const coreGrad = ctx.createLinearGradient(
          coreCenterX - dynamicWidth * 0.35, flareY,
          coreCenterX + dynamicWidth * 0.35, flareY
        );
        coreGrad.addColorStop(0, 'rgba(216, 180, 254, 0)');
        coreGrad.addColorStop(0.5, `rgba(250, 232, 255, ${0.95 * flareAlpha})`);
        coreGrad.addColorStop(1, 'rgba(216, 180, 254, 0)');

        ctx.strokeStyle = coreGrad;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#d8b4fe';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(coreCenterX - dynamicWidth * 0.35, flareY + 2);
        ctx.quadraticCurveTo(
          coreCenterX, flareY - 5,
          coreCenterX + dynamicWidth * 0.35, flareY + 2
        );
        ctx.stroke();

        // Spawn trailing particles
        if (particles.length < maxParticles && Math.random() < 0.45) {
          particles.push(createParticle(smoothT, width, height));
        }

        ctx.restore();
      }

      // Render and update rising luminous particles
      ctx.save();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        const lifeRatio = p.life / p.maxLife;
        if (lifeRatio >= 1) {
          particles.splice(i, 1);
          continue;
        }

        const particleAlpha = p.alpha * Math.sin(lifeRatio * Math.PI);

        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(233, 213, 255, ${particleAlpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, enabled, isOffline]);

  return (
    <div
      ref={containerRef}
      id="reva-energy-flare-layer"
      className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};
