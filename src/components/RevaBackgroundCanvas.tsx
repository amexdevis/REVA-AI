/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { VoiceSessionState } from '../types/voice.types.js';

interface RevaBackgroundCanvasProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
}

export const RevaBackgroundCanvas: React.FC<RevaBackgroundCanvasProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
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

    // Particle setup
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(Math.random() * 0.5 + 0.2),
      alpha: Math.random() * 0.6 + 0.2,
      baseAlpha: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.3 ? '#c084fc' : '#818cf8',
    }));

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Determine active audio intensity
      const audioBoost = Math.max(userAudioLevel, revaAudioLevel);

      // Draw floating particles
      particles.forEach((p) => {
        p.y += p.vy - audioBoost * 0.8;
        p.x += p.vx + Math.sin(tick * 0.02 + p.y * 0.01) * 0.2;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        // Pulse alpha with audio
        const currentAlpha = Math.min(1, p.baseAlpha + audioBoost * 0.5);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * (1 + audioBoost * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.shadowBlur = 8 + audioBoost * 12;
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
  }, [userAudioLevel, revaAudioLevel]);

  // Determine glow class and color based on state
  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const isThinking = sessionState === 'CONNECTING' || sessionState === 'READY';
  const isOffline = sessionState === 'OFFLINE' || sessionState === 'ERROR';

  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#05030a]">
      {/* Deep atmospheric gradient */}
      <div className="absolute inset-0 bg-radial from-purple-950/25 via-[#080410] to-[#040207]" />

      {/* Dynamic atmospheric back-glow behind REVA */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[750px] rounded-full blur-[120px] transition-all duration-700 pointer-events-none ${
          isSpeaking
            ? 'bg-purple-600/30 scale-110'
            : isListening
            ? 'bg-cyan-600/25 scale-105'
            : isThinking
            ? 'bg-fuchsia-600/20 scale-100'
            : isOffline
            ? 'bg-purple-950/10 scale-90'
            : 'bg-purple-800/20 scale-100'
        }`}
        style={{
          opacity: 0.6 + audioLevel * 0.4,
          transform: `translate(-50%, -50%) scale(${1 + audioLevel * 0.15})`,
        }}
      />

      {/* HTML5 Canvas for Floating Ambient Light Motes */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Holographic Pedestal Base at bottom center */}
      <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[480px] sm:w-[580px] h-[160px] pointer-events-none flex items-center justify-center opacity-70">
        {/* Perspective wrapper */}
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transform: 'perspective(600px) rotateX(68deg)' }}
        >
          {/* Outer rotating holographic ring */}
          <div
            className="absolute w-[440px] h-[440px] rounded-full border border-purple-500/30 border-dashed animate-holo-cw"
            style={{
              borderColor: isSpeaking
                ? 'rgba(192, 132, 252, 0.6)'
                : isListening
                ? 'rgba(56, 189, 248, 0.6)'
                : 'rgba(168, 85, 247, 0.3)',
              boxShadow: `0 0 ${15 + audioLevel * 30}px rgba(168, 85, 247, 0.4)`,
            }}
          />

          {/* Middle counter-rotating ring with tick marks */}
          <div
            className="absolute w-[340px] h-[340px] rounded-full border border-purple-400/40 animate-holo-ccw"
            style={{
              borderStyle: 'double',
              borderWidth: '3px',
              borderColor: isSpeaking
                ? 'rgba(216, 180, 254, 0.7)'
                : isListening
                ? 'rgba(147, 197, 253, 0.6)'
                : 'rgba(147, 51, 234, 0.4)',
            }}
          />

          {/* Inner pulsating core ring */}
          <div
            className="absolute w-[220px] h-[220px] rounded-full bg-purple-500/10 border border-purple-300/50 animate-ring-pulse"
            style={{
              transform: `scale(${1 + audioLevel * 0.25})`,
              boxShadow: `0 0 ${20 + audioLevel * 40}px rgba(192, 132, 252, 0.6), inset 0 0 20px rgba(168, 85, 247, 0.4)`,
            }}
          />

          {/* Floor grid / radial rays */}
          <div className="absolute w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.15)_0%,transparent_70%)]" />
        </div>
      </div>

      {/* Subtle corner HUD tech grid lines */}
      <div className="absolute top-4 left-4 w-24 h-24 border-l border-t border-purple-500/20 pointer-events-none opacity-40" />
      <div className="absolute top-4 right-4 w-24 h-24 border-r border-t border-purple-500/20 pointer-events-none opacity-40" />
      <div className="absolute bottom-4 left-4 w-24 h-24 border-l border-b border-purple-500/20 pointer-events-none opacity-40" />
      <div className="absolute bottom-4 right-4 w-24 h-24 border-r border-b border-purple-500/20 pointer-events-none opacity-40" />
    </div>
  );
};
