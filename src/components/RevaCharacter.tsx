/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';
import { removeDarkBackground } from '../utils/imageTransparency.js';
import { RevaEnergyFlare } from './RevaEnergyFlare.js';

import revaStandingImage from '../assets/images/reva_full_body_standing_1786954466183.jpg';

interface RevaCharacterProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
  onCharacterClick?: () => void;
  energyFlareEnabled?: boolean;
  characterTestAnimation?: boolean;
}

export const RevaCharacter: React.FC<RevaCharacterProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState = 'CALM',
  onCharacterClick,
  energyFlareEnabled = true,
  characterTestAnimation = false,
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

  // 3. Dynamic Cosmic Time & Directional Ambient Space Lighting
  const [lightPhase, setLightPhase] = useState(0);

  useEffect(() => {
    let animId: number;
    let startTime = performance.now();

    const updateLight = () => {
      const elapsed = (performance.now() - startTime) * 0.00018;
      setLightPhase(elapsed);
      animId = requestAnimationFrame(updateLight);
    };

    animId = requestAnimationFrame(updateLight);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute realistic multi-directional environmental light integration
  // - Upper-Right: Soft warm sunlight reflecting off right hair, shoulder, and arm silhouette
  // - Upper-Left: Subtle deep violet space rim light along left hair and silhouette
  // - Ambient Mid: Cool blue-violet cosmic fill from spiral galaxy
  // - Base / Pedestal: Soft upward violet platform reflection fading off towards upper torso
  const characterFilter = useMemo(() => {
    // Micro-shifts matching celestial motion
    const sunOffsetX = 3.5 + Math.sin(lightPhase) * 0.8;
    const sunOffsetY = -2.5 + Math.cos(lightPhase * 0.8) * 0.6;
    const galaxyIntensity = 0.22 + Math.sin(lightPhase * 1.4) * 0.03;

    if (isOffline) {
      return 'drop-shadow(0 0 8px rgba(107, 33, 168, 0.2)) brightness(0.92) contrast(1.02)';
    }

    if (isSpeaking) {
      const radius = 12 + revaAudioLevel * 20;
      return [
        `drop-shadow(-3.5px 0 9px rgba(168, 85, 247, ${0.32 + revaAudioLevel * 0.15}))`, // Violet space rim
        `drop-shadow(${sunOffsetX}px ${sunOffsetY}px 11px rgba(254, 243, 199, 0.18))`, // Warm sun bounce
        `drop-shadow(-2px -2px 14px rgba(129, 140, 248, 0.14))`, // Cool cosmic galaxy fill
        `drop-shadow(0 7px ${radius}px rgba(192, 132, 252, ${0.28 + revaAudioLevel * 0.2}))`, // Upward platform bounce
        `brightness(1.02) contrast(1.02)`,
      ].join(' ');
    }

    if (isListening) {
      const radius = 10 + userAudioLevel * 16;
      return [
        `drop-shadow(-3.5px 0 8px rgba(147, 51, 234, ${0.28 + userAudioLevel * 0.12}))`,
        `drop-shadow(${sunOffsetX}px ${sunOffsetY}px 10px rgba(254, 243, 199, 0.16))`,
        `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.12))`,
        `drop-shadow(0 7px ${radius}px rgba(192, 132, 252, ${0.24 + userAudioLevel * 0.15}))`,
        `brightness(1.01)`,
      ].join(' ');
    }

    if (isThinking) {
      return [
        `drop-shadow(-3.5px 0 8px rgba(168, 85, 247, 0.28))`,
        `drop-shadow(${sunOffsetX}px ${sunOffsetY}px 9px rgba(254, 243, 199, 0.15))`,
        `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.12))`,
        `drop-shadow(0 7px 12px rgba(216, 180, 254, 0.22))`,
      ].join(' ');
    }

    // Default Calm Idle: Balanced multi-source cinematic lighting
    return [
      `drop-shadow(-3.5px 0 8px rgba(147, 51, 234, ${galaxyIntensity}))`, // Violet space rim
      `drop-shadow(${sunOffsetX}px ${sunOffsetY}px 9px rgba(254, 243, 199, 0.14))`, // Gentle warm sun
      `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.11))`, // Cool cosmic fill
      `drop-shadow(0 7px 10px rgba(168, 85, 247, 0.18))`, // Ground platform bounce
    ].join(' ');
  }, [isOffline, isSpeaking, isListening, isThinking, revaAudioLevel, userAudioLevel, lightPhase]);

  return (
    <div
      id="reva-character-container"
      onClick={onCharacterClick}
      className="relative flex flex-col items-center justify-end select-none cursor-pointer transition-all duration-700 ease-out z-10"
      style={{
        transform: `rotate(${naturalTilt}deg) translate(${postureOffset.x}px, ${postureOffset.y}px)`,
      }}
    >
      {/* 1. Soft Ambient Space Light Field behind REVA (Subtle violet-to-gold environmental blend) */}
      <div
        className={`absolute -inset-10 rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${
          isSpeaking
            ? 'bg-[radial-gradient(ellipse_at_70%_35%,rgba(254,243,199,0.06)_0%,rgba(168,85,247,0.18)_50%,transparent_75%)] scale-105'
            : isListening
            ? 'bg-[radial-gradient(ellipse_at_70%_35%,rgba(254,243,199,0.05)_0%,rgba(147,51,234,0.15)_50%,transparent_75%)] scale-100'
            : isOffline
            ? 'bg-transparent'
            : 'bg-[radial-gradient(ellipse_at_70%_35%,rgba(254,243,199,0.04)_0%,rgba(126,34,206,0.12)_50%,transparent_75%)] scale-95'
        }`}
      />

      {/* 2. Full-Body Character: Pure clean render with biological breathing and posture */}
      <div
        className={`relative z-10 h-[56vh] sm:h-[60vh] md:h-[63vh] max-h-[68vh] min-h-[420px] w-auto flex items-center justify-center transition-all duration-500 ${
          isOffline ? 'opacity-85' : 'opacity-100 animate-reva-breathe animate-reva-sway'
        } ${isListening ? '-translate-y-0.5' : 'translate-y-0'} ${
          characterTestAnimation ? 'animate-character-debug' : ''
        }`}
      >
        {/* Base Sharp Character Model */}
        <img
          src={characterSrc}
          alt="REVA - Anime AI Companion"
          referrerPolicy="no-referrer"
          className="h-full w-auto object-contain pointer-events-none transition-all duration-300 select-none"
          style={{
            filter: characterFilter,
          }}
        />

        {/* Soft upward platform light reflection layer at feet/lower body with natural falloff */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-purple-500/10 via-purple-600/04 to-transparent pointer-events-none rounded-b-xl"
          style={{
            mixBlendMode: 'screen',
            opacity: isSpeaking ? 0.9 : isListening ? 0.75 : 0.6,
          }}
        />

        {/* 3. Rising Purple Energy Flare Effect (Feet to Head) */}
        <RevaEnergyFlare isOffline={isOffline} enabled={energyFlareEnabled} />

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
