/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';

interface HolographicPlatformProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
}

interface PlatformSpark {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

const HolographicPlatformComponent: React.FC<HolographicPlatformProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState = 'CALM',
}) => {
  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  // Tiny subtle rising holographic dust motes
  const [sparks] = useState<PlatformSpark[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 260,
      y: (Math.random() - 0.5) * 40,
      size: Math.random() * 1.5 + 0.6,
      duration: 4.5 + Math.random() * 3,
      delay: Math.random() * 4,
    }))
  );

  return (
    <div className="absolute -bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2 w-[460px] sm:w-[580px] md:w-[660px] h-[180px] pointer-events-none flex items-center justify-center select-none z-0">
      {/* 3D Perspective Stage Wrapper */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-1000"
        style={{ transform: 'perspective(800px) rotateX(76deg)' }}
      >
        {/* Outermost soft volumetric light wash with smooth photometric falloff */}
        <div
          className="absolute w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(147,51,234,0.18)_0%,rgba(107,33,168,0.08)_40%,transparent_70%)] transition-opacity duration-700 pointer-events-none"
          style={{
            opacity: isSpeaking ? 1 : isListening ? 0.9 : 0.75,
            transform: `scale(${1 + audioLevel * 0.08})`,
          }}
        />

        {/* Realistic ground contact shadow & reflection basin */}
        <div
          className="absolute w-[320px] h-[320px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.25)_0%,rgba(88,28,135,0.12)_45%,transparent_75%)] pointer-events-none"
          style={{
            filter: 'blur(8px)',
            opacity: 0.85,
          }}
        />

        {/* Ring 4: Outermost Fine Orbit Ring (Slow CW 40s) */}
        <div
          className="absolute w-[460px] h-[460px] rounded-full border border-purple-500/25 animate-holo-cw transition-colors duration-700"
          style={{
            animationDuration: '40s',
            borderWidth: '0.85px',
            boxShadow: `0 0 ${12 + audioLevel * 16}px rgba(168, 85, 247, ${0.16 + audioLevel * 0.16})`,
          }}
        />

        {/* Ring 3: Middle Fine-Dashed Luminous Ring (Speed: Smooth CCW 28s) */}
        <div
          className="absolute w-[360px] h-[360px] rounded-full border border-dashed border-purple-400/40 animate-holo-ccw transition-all duration-500"
          style={{
            animationDuration: '28s',
            borderWidth: '0.85px',
            boxShadow: `0 0 ${10 + audioLevel * 14}px rgba(192, 132, 252, ${0.2 + audioLevel * 0.2})`,
          }}
        />

        {/* Ring 2: Inner Fine Emitter Ring (Speed: Smooth CW 20s) with glowing nodes */}
        <div
          className="absolute w-[260px] h-[260px] rounded-full border border-purple-300/60 animate-holo-cw transition-all duration-300"
          style={{
            animationDuration: '20s',
            transform: `scale(${1 + audioLevel * 0.05})`,
            boxShadow: `0 0 ${15 + audioLevel * 20}px rgba(216, 180, 254, ${0.35 + audioLevel * 0.25}), inset 0 0 10px rgba(168, 85, 247, 0.25)`,
          }}
        />

        {/* Ring 1: Core Radiant Disc directly under sneakers with realistic upward contact reflection */}
        <div
          className="absolute w-[160px] h-[160px] rounded-full bg-gradient-to-r from-purple-400/20 via-pink-300/25 to-purple-400/20 border border-purple-200/80 animate-ring-pulse transition-all duration-300"
          style={{
            transform: `scale(${1 + audioLevel * 0.08})`,
            boxShadow: `0 0 ${20 + audioLevel * 25}px rgba(216, 180, 254, 0.65), inset 0 0 16px rgba(192, 132, 252, 0.5)`,
          }}
        />
      </div>

      {/* Subtle Micro-Dust Light Beams rising from platform */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {sparks.map((spark) => (
          <div
            key={spark.id}
            className="absolute rounded-full bg-purple-200/80 animate-platform-spark"
            style={{
              left: `calc(50% + ${spark.x}px)`,
              bottom: `calc(20% + ${spark.y}px)`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              boxShadow: '0 0 6px rgba(216, 180, 254, 0.7)',
              animationDuration: `${spark.duration}s`,
              animationDelay: `${spark.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const HolographicPlatform = React.memo(HolographicPlatformComponent);
