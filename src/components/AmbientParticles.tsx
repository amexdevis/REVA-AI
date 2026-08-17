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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Create 55 atmospheric particles & sparklets with varied depths
    const particleCount = 55;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.6,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(Math.random() * 0.55 + 0.25),
      alpha: Math.random() * 0.6 + 0.25,
      baseAlpha: Math.random() * 0.6 + 0.25,
      color: Math.random() > 0.35 ? '#d8b4fe' : '#c084fc',
      pulseSpeed: Math.random() * 0.025 + 0.012,
      angle: Math.random() * Math.PI * 2,
    }));

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      const audioBoost = Math.max(userAudioLevel, revaAudioLevel);

      // Render vertical subtle light rays behind REVA
      const centerX = width / 2;
      const rayGradient = ctx.createLinearGradient(centerX, 0, centerX, height);
      rayGradient.addColorStop(0, 'rgba(147, 51, 234, 0)');
      rayGradient.addColorStop(0.3, `rgba(168, 85, 247, ${0.035 + audioBoost * 0.045})`);
      rayGradient.addColorStop(0.7, `rgba(192, 132, 252, ${0.065 + audioBoost * 0.085})`);
      rayGradient.addColorStop(1, 'rgba(147, 51, 234, 0)');

      ctx.fillStyle = rayGradient;
      ctx.fillRect(centerX - 190, 0, 380, height);

      // Render floating purple particles & light motes
      particles.forEach((p) => {
        // Particles gently accelerate and converge slightly toward center during speech
        const distFromCenter = p.x - centerX;
        const attraction = sessionState === 'REVA_SPEAKING' || sessionState === 'USER_SPEAKING' ? -Math.sign(distFromCenter) * 0.08 : 0;

        p.y += p.vy - audioBoost * 0.85;
        p.x += p.vx + attraction + Math.sin(tick * p.pulseSpeed + p.angle) * 0.3;

        if (p.y < -15) {
          p.y = height + 15;
          p.x = Math.random() * width;
        }

        const currentAlpha = Math.min(1, p.baseAlpha + audioBoost * 0.4 + Math.sin(tick * 0.04) * 0.15);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + audioBoost * 0.45), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.08, currentAlpha);
        ctx.shadowBlur = 8 + audioBoost * 14;
        ctx.shadowColor = p.color;
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [userAudioLevel, revaAudioLevel, sessionState]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#030107]">
      {/* Deep atmospheric gradient with subtle violet vignette */}
      <div className="absolute inset-0 bg-radial from-[#120426]/40 via-[#06020c] to-[#020005]" />

      {/* Central atmospheric violet glow directly behind REVA */}
      <div
        className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] sm:w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none transition-all duration-700"
        style={{
          backgroundColor:
            sessionState === 'REVA_SPEAKING'
              ? 'rgba(192, 132, 252, 0.28)'
              : sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING'
              ? 'rgba(168, 85, 247, 0.24)'
              : 'rgba(147, 51, 234, 0.18)',
          transform: `translate(-50%, -50%) scale(${1 + Math.max(userAudioLevel, revaAudioLevel) * 0.15})`,
        }}
      />

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
