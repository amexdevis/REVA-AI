/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoiceSessionState, RevaEmotionalState } from '../types/voice.types.js';

interface HolographicPlatformProps {
  sessionState: VoiceSessionState;
  userAudioLevel: number;
  revaAudioLevel: number;
  emotionalState?: RevaEmotionalState;
}

export const HolographicPlatform: React.FC<HolographicPlatformProps> = ({
  sessionState,
  userAudioLevel,
  revaAudioLevel,
  emotionalState = 'CALM',
}) => {
  const isSpeaking = sessionState === 'REVA_SPEAKING';
  const isListening = sessionState === 'LISTENING' || sessionState === 'USER_SPEAKING';
  const audioLevel = Math.max(userAudioLevel, revaAudioLevel);

  return (
    <div className="absolute -bottom-4 sm:-bottom-6 left-1/2 -translate-x-1/2 w-[440px] sm:w-[540px] md:w-[620px] h-[160px] pointer-events-none flex items-center justify-center select-none z-0">
      {/* 3D Perspective Stage Wrapper */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-700"
        style={{ transform: 'perspective(700px) rotateX(74deg)' }}
      >
        {/* Outermost glowing purple pulse ring */}
        <div
          className="absolute w-[480px] h-[480px] rounded-full border border-purple-600/30 transition-all duration-300 ease-out"
          style={{
            transform: `scale(${1 + audioLevel * 0.14})`,
            boxShadow: `0 0 ${20 + audioLevel * 40}px rgba(168, 85, 247, ${0.35 + audioLevel * 0.3}), inset 0 0 ${12 + audioLevel * 20}px rgba(168, 85, 247, 0.2)`,
          }}
        />

        {/* Outer dashed rotating ring with tech ticks */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full border border-dashed animate-holo-cw transition-colors duration-500"
          style={{
            borderColor: isSpeaking
              ? 'rgba(216, 180, 254, 0.85)'
              : isListening
              ? 'rgba(192, 132, 252, 0.8)'
              : emotionalState === 'EXCITED' || emotionalState === 'HAPPY'
              ? 'rgba(232, 121, 249, 0.7)'
              : 'rgba(168, 85, 247, 0.45)',
            borderWidth: '1.5px',
          }}
        />

        {/* Middle double-bordered ring rotating counter-clockwise */}
        <div
          className="absolute w-[310px] h-[310px] rounded-full border border-purple-400/50 animate-holo-ccw transition-all duration-300"
          style={{
            borderStyle: 'double',
            borderWidth: '3px',
            boxShadow: `0 0 ${12 + audioLevel * 28}px rgba(192, 132, 252, ${0.4 + audioLevel * 0.3})`,
          }}
        />

        {/* Inner concentric ring with fine ticks */}
        <div
          className="absolute w-[220px] h-[220px] rounded-full border border-purple-300/60 transition-all duration-200"
          style={{
            transform: `scale(${1 + audioLevel * 0.08})`,
            boxShadow: `0 0 ${16 + audioLevel * 35}px rgba(216, 180, 254, 0.55), inset 0 0 15px rgba(168, 85, 247, 0.4)`,
          }}
        />

        {/* Core vibrant pedestal disk under feet with breathing pulse */}
        <div
          className="absolute w-[140px] h-[140px] rounded-full bg-purple-600/20 border border-purple-200/75 animate-ring-pulse transition-all duration-200"
          style={{
            transform: `scale(${1 + audioLevel * 0.2})`,
            boxShadow: `0 0 ${25 + audioLevel * 45}px rgba(216, 180, 254, 0.75), inset 0 0 25px rgba(192, 132, 252, 0.55)`,
          }}
        />

        {/* Radial ground light wash */}
        <div
          className="absolute w-[440px] h-[440px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.32)_0%,rgba(147,51,234,0.14)_40%,transparent_70%)] transition-opacity duration-500"
          style={{
            opacity: isSpeaking ? 1 : isListening ? 0.9 : 0.75,
          }}
        />
      </div>
    </div>
  );
};
