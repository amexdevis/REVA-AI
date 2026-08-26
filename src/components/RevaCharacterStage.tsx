/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';

// Assets generated specifically for REVA full-body anime companion
import revaBaseImage from '../assets/images/reva_fullbody_character_1786953713468.jpg';
import revaAttentiveImage from '../assets/images/reva_attentive_character_1786953731872.jpg';

interface RevaCharacterStageProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
  onCharacterClick?: () => void;
}

export const RevaCharacterStage: React.FC<RevaCharacterStageProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState,
  onCharacterClick,
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [naturalTilt, setNaturalTilt] = useState(0);

  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const isThinking = sessionState === 'CONNECTING' || sessionState === 'READY';
  const isOffline = sessionState === 'OFFLINE' || sessionState === 'ERROR';

  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  // Natural spontaneous blinking loop
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
        // Schedule next blink in 3.5 to 7.5 seconds
        const nextDelay = 3500 + Math.random() * 4000;
        blinkTimeout = setTimeout(triggerBlink, nextDelay);
      }, 140);
    };

    blinkTimeout = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Natural micro-sway movement
  useEffect(() => {
    const interval = setInterval(() => {
      // Subtle tilt shift (-0.5deg to +0.5deg)
      const nextTilt = (Math.random() - 0.5) * 1.0;
      setNaturalTilt(nextTilt);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Determine active visual state glow
  const getGlowFilter = () => {
    if (isOffline) {
      return 'drop-shadow(0 0 8px rgba(107, 33, 168, 0.2)) saturate(0.9) brightness(0.88)';
    }
    if (isSpeaking) {
      const radius = 12 + revaAudioLevel * 20;
      return [
        `drop-shadow(-3.5px 0 9px rgba(168, 85, 247, 0.35))`,
        `drop-shadow(3.5px -2.5px 11px rgba(254, 243, 199, 0.18))`,
        `drop-shadow(-2px -2px 14px rgba(129, 140, 248, 0.14))`,
        `drop-shadow(0 7px ${radius}px rgba(192, 132, 252, 0.3))`,
        `saturate(1.05) brightness(1.02)`,
      ].join(' ');
    }
    if (isListening) {
      const radius = 10 + userAudioLevel * 16;
      return [
        `drop-shadow(-3.5px 0 8px rgba(147, 51, 234, 0.3))`,
        `drop-shadow(3.5px -2.5px 10px rgba(254, 243, 199, 0.16))`,
        `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.12))`,
        `drop-shadow(0 7px ${radius}px rgba(192, 132, 252, 0.25))`,
      ].join(' ');
    }
    if (isThinking) {
      return [
        `drop-shadow(-3.5px 0 8px rgba(168, 85, 247, 0.28))`,
        `drop-shadow(3.5px -2.5px 9px rgba(254, 243, 199, 0.15))`,
        `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.12))`,
        `drop-shadow(0 7px 12px rgba(216, 180, 254, 0.22))`,
      ].join(' ');
    }
    // Idle / Ready
    return [
      `drop-shadow(-3.5px 0 8px rgba(147, 51, 234, 0.22))`,
      `drop-shadow(3.5px -2.5px 9px rgba(254, 243, 199, 0.14))`,
      `drop-shadow(-2px -2px 12px rgba(129, 140, 248, 0.11))`,
      `drop-shadow(0 7px 10px rgba(168, 85, 247, 0.18))`,
    ].join(' ');
  };

  // Select image based on speaking/attentive state
  const activeImageSrc = isSpeaking || isListening ? revaAttentiveImage : revaBaseImage;

  return (
    <div
      id="reva-character-stage"
      onClick={onCharacterClick}
      className="relative flex flex-col items-center justify-center select-none cursor-pointer transition-transform duration-700"
      style={{
        transform: `rotate(${naturalTilt}deg)`,
      }}
    >
      {/* Dynamic aura halo backplate */}
      <div
        className={`absolute -inset-8 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isSpeaking
            ? 'bg-purple-500/30 scale-105 animate-aura-pulse'
            : isListening
            ? 'bg-cyan-500/25 scale-100'
            : isOffline
            ? 'bg-transparent'
            : 'bg-purple-600/20 scale-95 animate-aura-pulse'
        }`}
      />

      {/* Full Body Character Container with breathing animation */}
      <div
        className={`relative z-10 w-[300px] sm:w-[380px] md:w-[440px] max-h-[72vh] sm:max-h-[76vh] flex items-center justify-center transition-all duration-500 ${
          isOffline ? 'opacity-85' : 'opacity-100 animate-reva-breathe'
        }`}
      >
        {/* Full body image with dynamic reactive drop shadow */}
        <img
          src={activeImageSrc}
          alt="REVA - AI Companion"
          referrerPolicy="no-referrer"
          className="w-full h-auto object-contain pointer-events-none transition-all duration-300 mask-image-radial"
          style={{
            filter: getGlowFilter(),
            maskImage:
              'radial-gradient(ellipse 95% 90% at 50% 48%, black 75%, rgba(0,0,0,0.7) 90%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 95% 90% at 50% 48%, black 75%, rgba(0,0,0,0.7) 90%, transparent 100%)',
          }}
        />

        {/* Subtle blinking eyelid micro-overlay for lifelike animation */}
        {isBlinking && (
          <div
            className="absolute top-[18%] left-[45%] w-[10%] h-[3%] bg-[#1a0f2e]/80 rounded-full blur-[1px] pointer-events-none transition-opacity duration-100"
            style={{ opacity: 0.85 }}
          />
        )}

        {/* Audio Reactivity Energy Rings around torso when speaking */}
        {isSpeaking && (
          <div
            className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-400/40 pointer-events-none transition-all duration-100"
            style={{
              width: `${180 + audioLevel * 140}px`,
              height: `${180 + audioLevel * 140}px`,
              opacity: 0.3 + audioLevel * 0.5,
              boxShadow: `0 0 ${15 + audioLevel * 25}px rgba(192, 132, 252, 0.5)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
