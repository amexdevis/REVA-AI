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

const RevaCharacterComponent: React.FC<RevaCharacterProps> = ({
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

  // 3. Dynamic Cosmic Time & Environmental Space Lighting Engine
  // Computes synchronized astronomical light vectors matching the moving space background:
  // - Rotating Galaxy: slow orbital purple rim shifts on hair, shoulders, arms, and clothing
  // - Moving Sun: slow shifting solar angle with warm golden side grazing and cooler opposing shadow
  // - Orbiting Planets: barely noticeable ambient illumination shift when planetary bodies drift near
  // - Rising Purple Energy Flare: brief gentle purple reflection swell as the flare ascends past REVA
  // - Holographic Platform: upward violet bounce on shoes, legs, and lower body pulsing smoothly with platform resonance
  const [spaceTime, setSpaceTime] = useState({
    galaxyAngle: 0,
    sunAngle: 0,
    planetCycle: 0,
    flarePhase: 0,
    platformPulse: 0,
  });

  useEffect(() => {
    let animId: number;
    const startTime = performance.now();

    const updateSpaceLight = (now: number) => {
      const elapsedSeconds = (now - startTime) / 1000;

      // 1. Galaxy rotation match: ~0.00025 rad/frame (approx 250s full cycle)
      const galaxyAngle = elapsedSeconds * 0.025;

      // 2. Distant Sun orbit match: long continuous solar arc (~15 min cycle = ~900s)
      const sunAngle = elapsedSeconds * 0.007;

      // 3. Orbiting planets match: slow celestial drift (~120s cycle)
      const planetCycle = elapsedSeconds * 0.052;

      // 4. Purple Energy Flare match: 4.8s total cycle (3.0s ascending rise + 1.8s pause)
      const flareProgress = (elapsedSeconds % 4.8) / 4.8;
      // Flare reflection factor (highest when flare is traversing body between 0.15 and 0.55)
      let flareReflection = 0;
      if (flareProgress <= 0.625) {
        const riseFactor = flareProgress / 0.625;
        // Peak reflection at torso (riseFactor ~0.4)
        flareReflection = Math.sin(riseFactor * Math.PI) * 0.065;
      }

      // 5. Holographic Platform energy oscillation (~4.0s pulse)
      const platformPulse = Math.sin(elapsedSeconds * 1.57) * 0.5 + 0.5;

      setSpaceTime({
        galaxyAngle,
        sunAngle,
        planetCycle,
        flarePhase: flareReflection,
        platformPulse,
      });

      animId = requestAnimationFrame(updateSpaceLight);
    };

    animId = requestAnimationFrame(updateSpaceLight);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute realistic multi-directional environmental light integration
  // 1. Galaxy Light: Slowly shifting soft purple rim along hair, shoulders, arms, and clothing edges
  // 2. Solar Light: Slow shifting warm sunlight angle with subtle color temperature modulation
  // 3. Planet Ambient Light: Barely noticeable soft fill illumination as celestial bodies pass
  // 4. Energy Flare Reflection: Smooth, brief illumination swell as the flare wave sweeps past
  // 5. Platform Uplight: Grounded, soft upward violet gradient on shoes, legs, and lower body
  const characterFilter = useMemo(() => {
    const { galaxyAngle, sunAngle, planetCycle, flarePhase, platformPulse } = spaceTime;

    // Moving Sun directional vector: shifts horizontally and vertically across the upper right
    const sunDirX = 3.0 + Math.sin(sunAngle) * 1.4;
    const sunDirY = -2.2 + Math.cos(sunAngle * 0.8) * 0.9;
    const sunWarmth = 0.16 + Math.sin(sunAngle * 1.1) * 0.035;

    // Rotating Galaxy rim vector: slowly rotates around the silhouette edges
    const galaxyRimX = -2.8 + Math.cos(galaxyAngle) * 1.2;
    const galaxyRimY = -1.0 + Math.sin(galaxyAngle * 0.9) * 1.1;
    const galaxyIntensity = 0.22 + Math.sin(galaxyAngle * 1.4) * 0.04 + flarePhase;

    // Passing Planet subtle ambient fill variation
    const planetAmbientFill = 0.10 + Math.sin(planetCycle) * 0.025;

    // Platform upward reflection
    const platformBounceIntensity = 0.18 + platformPulse * 0.05 + flarePhase * 0.5;

    if (isOffline) {
      return 'drop-shadow(0 0 8px rgba(107, 33, 168, 0.2)) brightness(0.92) contrast(1.02)';
    }

    if (isSpeaking) {
      const radius = 12 + revaAudioLevel * 18;
      return [
        `drop-shadow(${galaxyRimX}px ${galaxyRimY}px 8px rgba(168, 85, 247, ${galaxyIntensity + 0.10 + revaAudioLevel * 0.12}))`, // 1. Moving galaxy rim
        `drop-shadow(${sunDirX}px ${sunDirY}px 8.5px rgba(254, 243, 199, ${sunWarmth + 0.04}))`, // 2. Moving sun grazing
        `drop-shadow(-4px -2px 16px rgba(139, 92, 246, ${planetAmbientFill + 0.04}))`, // 3. Passing planet diffuse fill
        `drop-shadow(0 9px ${radius}px rgba(192, 132, 252, ${platformBounceIntensity + 0.10 + revaAudioLevel * 0.16}))`, // 4. Platform upward bounce
        `brightness(1.02) contrast(1.02)`,
      ].join(' ');
    }

    if (isListening) {
      const radius = 10 + userAudioLevel * 14;
      return [
        `drop-shadow(${galaxyRimX}px ${galaxyRimY}px 7px rgba(168, 85, 247, ${galaxyIntensity + 0.05 + userAudioLevel * 0.10}))`,
        `drop-shadow(${sunDirX}px ${sunDirY}px 8px rgba(254, 243, 199, ${sunWarmth + 0.02}))`,
        `drop-shadow(-4px -2px 14px rgba(139, 92, 246, ${planetAmbientFill + 0.02}))`,
        `drop-shadow(0 9px ${radius}px rgba(192, 132, 252, ${platformBounceIntensity + 0.06 + userAudioLevel * 0.12}))`,
        `brightness(1.01) contrast(1.01)`,
      ].join(' ');
    }

    if (isThinking) {
      return [
        `drop-shadow(${galaxyRimX}px ${galaxyRimY}px 7px rgba(168, 85, 247, ${galaxyIntensity + 0.04}))`,
        `drop-shadow(${sunDirX}px ${sunDirY}px 8px rgba(254, 243, 199, ${sunWarmth}))`,
        `drop-shadow(-4px -2px 14px rgba(139, 92, 246, ${planetAmbientFill}))`,
        `drop-shadow(0 9px 12px rgba(216, 180, 254, ${platformBounceIntensity + 0.04}))`,
        `brightness(1.01)`,
      ].join(' ');
    }

    // Default Calm Idle: Cinematic, soft natural space illumination
    return [
      `drop-shadow(${galaxyRimX}px ${galaxyRimY}px 6.5px rgba(168, 85, 247, ${galaxyIntensity}))`, // 1. Moving galaxy rim
      `drop-shadow(${sunDirX}px ${sunDirY}px 7.5px rgba(254, 243, 199, ${sunWarmth}))`, // 2. Moving sun grazing
      `drop-shadow(-4px -2px 14px rgba(139, 92, 246, ${planetAmbientFill}))`, // 3. Passing planet diffuse fill
      `drop-shadow(0 8px 11px rgba(192, 132, 252, ${platformBounceIntensity}))`, // 4. Platform upward bounce
      `contrast(1.015) brightness(1.01)`,
    ].join(' ');
  }, [isOffline, isSpeaking, isListening, isThinking, revaAudioLevel, userAudioLevel, spaceTime]);

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
        className={`relative z-10 h-[64vh] sm:h-[68vh] md:h-[72vh] lg:h-[74vh] max-h-[76vh] min-h-[480px] w-auto flex items-center justify-center transition-all duration-500 ${
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

        {/* Soft upward platform light reflection layer across shoes, legs, and shorts with natural quadratic fall-off */}
        <div
          className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-purple-400/18 via-purple-600/07 via-purple-900/02 to-transparent pointer-events-none rounded-b-xl transition-opacity duration-500"
          style={{
            mixBlendMode: 'screen',
            opacity: (isSpeaking ? 0.85 : isListening ? 0.72 : 0.58) + spaceTime.platformPulse * 0.08 + spaceTime.flarePhase * 0.4,
          }}
        />

        {/* Delicate base contact illumination on shoes from holographic platform rim */}
        <div
          className="absolute inset-x-[15%] bottom-0 h-[8%] bg-gradient-to-t from-purple-300/22 via-purple-500/08 to-transparent pointer-events-none blur-[2px] transition-opacity duration-300"
          style={{
            mixBlendMode: 'screen',
            opacity: isOffline ? 0.2 : 0.72 + spaceTime.platformPulse * 0.08,
          }}
        />

        {/* Permanent Creator Tattoo on Upper/Back of Hand: "Keshav K." */}
        <div
          id="reva-hand-tattoo"
          className="absolute top-[49.2%] left-[62.2%] pointer-events-none select-none z-20"
          style={{
            transform: 'translate(-50%, -50%) rotate(15deg)',
          }}
          aria-label="Tattoo: Keshav K."
        >
          <span
            className="block text-[12.5px] sm:text-[13.5px] md:text-[14.5px] lg:text-[15.5px] leading-none tracking-tight font-bold text-[#140b20] antialiased"
            style={{
              fontFamily: "'Dancing Script', 'Caveat', 'Alex Brush', cursive",
              mixBlendMode: 'multiply',
              filter: 'drop-shadow(0 0 0.35px rgba(20, 11, 32, 0.6))',
              textShadow: '0 0 0.35px rgba(20, 11, 32, 0.4)',
              opacity: 0.95,
            }}
          >
            Keshav K.
          </span>
        </div>

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

export const RevaCharacter = React.memo(RevaCharacterComponent);
