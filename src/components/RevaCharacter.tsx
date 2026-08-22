/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';
import { removeDarkBackground } from '../utils/imageTransparency.js';

import revaStandingImage from '../assets/images/reva_full_body_standing_1786954466183.jpg';

interface RevaCharacterProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
  onCharacterClick?: () => void;
}

export const RevaCharacter: React.FC<RevaCharacterProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState = 'CALM',
  onCharacterClick,
}) => {
  const [characterSrc, setCharacterSrc] = useState<string>(revaStandingImage);
  const [naturalTilt, setNaturalTilt] = useState(0);
  const [postureOffset, setPostureOffset] = useState({ x: 0, y: 0 });

  // Pre-process transparent cutout from the master clean character image
  useEffect(() => {
    let isMounted = true;
    removeDarkBackground(revaStandingImage).then((url) => {
      if (isMounted) setCharacterSrc(url);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const isThinking = sessionState === 'CONNECTING' || sessionState === 'READY';
  const isOffline = sessionState === 'OFFLINE' || sessionState === 'ERROR';

  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  // 1. Continuous Organic Posture Sway (Dual-harmonic non-repeating micro-movements)
  useEffect(() => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.08;
      // Combine two sine waves with incommensurate frequencies
      const tilt = Math.sin(angle * 0.7) * 0.35 + Math.sin(angle * 1.3) * 0.15;
      const posX = Math.sin(angle * 0.5) * 1.5;
      const posY = Math.cos(angle * 0.6) * 1.2;

      // When curious, add slight natural head tilt
      const curiosityOffset = emotionalState === 'CURIOUS' ? 0.4 : 0;

      setNaturalTilt(tilt + curiosityOffset);
      setPostureOffset({ x: posX, y: posY });
    }, 250);

    return () => clearInterval(interval);
  }, [emotionalState]);

  // 2. Dynamic Emotional & Audio Glow Lighting Filter (Applied as outer drop-shadow glow)
  const glowFilter = useMemo(() => {
    let emotionHue = 'rgba(168, 85, 247, 0.45)'; // Default CALM violet
    let emotionOuter = 'rgba(126, 34, 206, 0.25)';

    if (emotionalState === 'HAPPY') {
      emotionHue = 'rgba(216, 180, 254, 0.55)';
      emotionOuter = 'rgba(236, 72, 153, 0.3)';
    } else if (emotionalState === 'EXCITED') {
      emotionHue = 'rgba(232, 121, 249, 0.65)';
      emotionOuter = 'rgba(168, 85, 247, 0.45)';
    } else if (emotionalState === 'SAD') {
      emotionHue = 'rgba(147, 51, 234, 0.3)';
      emotionOuter = 'rgba(88, 28, 135, 0.2)';
    } else if (emotionalState === 'CURIOUS') {
      emotionHue = 'rgba(192, 132, 252, 0.6)';
      emotionOuter = 'rgba(147, 51, 234, 0.35)';
    }

    if (isOffline) {
      return 'drop-shadow(0 0 12px rgba(107, 33, 168, 0.22)) saturate(0.9) brightness(0.92)';
    }

    if (isSpeaking) {
      const radius = 22 + revaAudioLevel * 55;
      const alpha = 0.65 + revaAudioLevel * 0.35;
      return `drop-shadow(0 0 ${radius}px rgba(216, 180, 254, ${alpha})) drop-shadow(0 0 ${radius * 1.5}px ${emotionOuter}) saturate(1.15) brightness(1.05)`;
    }

    if (isListening) {
      const radius = 18 + userAudioLevel * 45;
      return `drop-shadow(0 0 ${radius}px rgba(192, 132, 252, 0.7)) drop-shadow(0 0 ${radius * 1.3}px ${emotionHue}) brightness(1.03)`;
    }

    if (isThinking) {
      return `drop-shadow(0 0 24px rgba(216, 180, 254, 0.55)) drop-shadow(0 0 42px ${emotionOuter})`;
    }

    return `drop-shadow(0 0 18px ${emotionHue}) drop-shadow(0 0 35px ${emotionOuter})`;
  }, [isOffline, isSpeaking, isListening, isThinking, revaAudioLevel, userAudioLevel, emotionalState]);

  return (
    <div
      id="reva-character-container"
      onClick={onCharacterClick}
      className="relative flex flex-col items-center justify-end select-none cursor-pointer transition-all duration-700 ease-out z-10"
      style={{
        transform: `rotate(${naturalTilt}deg) translate(${postureOffset.x}px, ${postureOffset.y}px)`,
      }}
    >
      {/* 1. Atmospheric Ambient Aura behind REVA */}
      <div
        className={`absolute -inset-10 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isSpeaking
            ? 'bg-purple-500/35 scale-105 animate-aura-pulse'
            : isListening
            ? 'bg-purple-600/30 scale-100'
            : isOffline
            ? 'bg-transparent'
            : emotionalState === 'EXCITED' || emotionalState === 'HAPPY'
            ? 'bg-fuchsia-600/25 scale-100 animate-aura-pulse'
            : 'bg-purple-700/20 scale-95 animate-aura-pulse'
        }`}
      />

      {/* 2. Full-Body Character: Pure clean render with biological breathing and posture */}
      <div
        className={`relative z-10 h-[56vh] sm:h-[60vh] md:h-[63vh] max-h-[68vh] min-h-[420px] w-auto flex items-center justify-center transition-all duration-500 ${
          isOffline ? 'opacity-85' : 'opacity-100 animate-reva-breathe animate-reva-sway'
        } ${isListening ? '-translate-y-1' : 'translate-y-0'}`}
      >
        <img
          src={characterSrc}
          alt="REVA - Anime AI Companion"
          referrerPolicy="no-referrer"
          className="h-full w-auto object-contain pointer-events-none transition-all duration-300 drop-shadow-2xl"
          style={{
            filter: glowFilter,
          }}
        />

        {/* 3. Real voice reaction soundwave ring during REVA speech (positioned around chest level) */}
        {isSpeaking && (
          <div
            className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-300/40 pointer-events-none transition-all duration-75"
            style={{
              width: `${220 + audioLevel * 170}px`,
              height: `${220 + audioLevel * 170}px`,
              opacity: 0.3 + audioLevel * 0.5,
              boxShadow: `0 0 ${20 + audioLevel * 32}px rgba(216, 180, 254, 0.6)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
