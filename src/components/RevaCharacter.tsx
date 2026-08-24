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
  const [isBlinking, setIsBlinking] = useState(false);

  // Pre-process transparent cutout from master character image
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

  // 1. Natural Spontaneous Blinking Loop (3.5 to 7.5 seconds interval)
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        const nextDelay = 3500 + Math.random() * 4000;
        blinkTimeout = setTimeout(triggerBlink, nextDelay);
      }, 120);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 2. Continuous Organic Posture Sway (Dual-harmonic micro-movements)
  useEffect(() => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.06;
      const tilt = Math.sin(angle * 0.7) * 0.25 + Math.sin(angle * 1.3) * 0.1;
      const posX = Math.sin(angle * 0.5) * 1.2;
      const posY = Math.cos(angle * 0.6) * 0.9;

      const curiosityOffset = emotionalState === 'CURIOUS' ? 0.35 : 0;

      setNaturalTilt(tilt + curiosityOffset);
      setPostureOffset({ x: posX, y: posY });
    }, 250);

    return () => clearInterval(interval);
  }, [emotionalState]);

  // 3. Cinematic Environmental Lighting Integration Filter
  // Right side: Subtle warm sun bounce; Left side: Soft cosmic violet; Base: platform contact
  const characterFilter = useMemo(() => {
    if (isOffline) {
      return 'drop-shadow(0 0 10px rgba(107, 33, 168, 0.2)) brightness(0.92) contrast(1.02)';
    }

    if (isSpeaking) {
      const radius = 16 + revaAudioLevel * 30;
      return `drop-shadow(-3px 0 12px rgba(168, 85, 247, 0.45)) drop-shadow(3px -2px 14px rgba(254, 240, 138, 0.22)) drop-shadow(0 0 ${radius}px rgba(216, 180, 254, 0.4)) brightness(1.04) contrast(1.02)`;
    }

    if (isListening) {
      const radius = 12 + userAudioLevel * 25;
      return `drop-shadow(-3px 0 10px rgba(147, 51, 234, 0.4)) drop-shadow(3px -2px 12px rgba(254, 240, 138, 0.18)) drop-shadow(0 0 ${radius}px rgba(192, 132, 252, 0.35)) brightness(1.02)`;
    }

    if (isThinking) {
      return 'drop-shadow(-3px 0 10px rgba(168, 85, 247, 0.35)) drop-shadow(3px -2px 10px rgba(254, 240, 138, 0.15)) drop-shadow(0 0 16px rgba(216, 180, 254, 0.3))';
    }

    // Default Calm Idle: Subtle cinematic multi-directional rim light
    return 'drop-shadow(-3px 0 10px rgba(147, 51, 234, 0.3)) drop-shadow(3px -2px 10px rgba(254, 240, 138, 0.15)) drop-shadow(0 0 12px rgba(192, 132, 252, 0.22))';
  }, [isOffline, isSpeaking, isListening, isThinking, revaAudioLevel, userAudioLevel]);

  return (
    <div
      id="reva-character-container"
      onClick={onCharacterClick}
      className="relative flex flex-col items-center justify-end select-none cursor-pointer transition-all duration-700 ease-out z-10"
      style={{
        transform: `rotate(${naturalTilt}deg) translate(${postureOffset.x}px, ${postureOffset.y}px)`,
      }}
    >
      {/* 1. Soft atmospheric environmental haze behind REVA silhouette */}
      <div
        className={`absolute -inset-8 rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${
          isSpeaking
            ? 'bg-purple-500/20 scale-105'
            : isListening
            ? 'bg-purple-600/16 scale-100'
            : isOffline
            ? 'bg-transparent'
            : 'bg-purple-700/12 scale-95'
        }`}
      />

      {/* 2. Full-Body Character: Pure clean render with biological breathing and posture */}
      <div
        className={`relative z-10 h-[56vh] sm:h-[60vh] md:h-[63vh] max-h-[68vh] min-h-[420px] w-auto flex items-center justify-center transition-all duration-500 ${
          isOffline ? 'opacity-85' : 'opacity-100 animate-reva-breathe animate-reva-sway'
        } ${isListening ? '-translate-y-0.5' : 'translate-y-0'}`}
      >
        <img
          src={characterSrc}
          alt="REVA - Anime AI Companion"
          referrerPolicy="no-referrer"
          className="h-full w-auto object-contain pointer-events-none transition-all duration-300"
          style={{
            filter: characterFilter,
          }}
        />

        {/* Subtle Eyelid Micro-Blink */}
        {isBlinking && (
          <div
            className="absolute top-[17.5%] left-[45.5%] w-[9%] h-[2.5%] bg-[#1a0f2e]/85 rounded-full blur-[1px] pointer-events-none transition-opacity duration-75"
            style={{ opacity: 0.9 }}
          />
        )}

        {/* 3. Subtle audio reaction wave during REVA speech */}
        {isSpeaking && (
          <div
            className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-300/25 pointer-events-none transition-all duration-100"
            style={{
              width: `${210 + audioLevel * 120}px`,
              height: `${210 + audioLevel * 120}px`,
              opacity: 0.25 + audioLevel * 0.35,
              boxShadow: `0 0 ${14 + audioLevel * 20}px rgba(216, 180, 254, 0.4)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
