/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BackgroundMusicManager,
  BackgroundMusicSettings,
  AmbientMusicMode,
  VoiceDuckingState,
} from '../lib/audio/background-music-manager.js';
import { VoiceSessionState, VoiceMachineState } from '../types/voice.types.js';

const STORAGE_KEY = 'reva_ambient_atmosphere_settings';

const DEFAULT_SETTINGS: BackgroundMusicSettings = {
  enabled: true,
  mode: 'SOFT_AMBIENT',
  volume: 0.1, // 10% default very soft background level
};

export function useRevaMusic(options?: {
  sessionState?: VoiceSessionState;
  machineState?: VoiceMachineState;
  revaAudioLevel?: number;
  userAudioLevel?: number;
}) {
  const [settings, setSettings] = useState<BackgroundMusicSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mode: AmbientMusicMode =
          parsed.mode === 'SOFT_SCIFI' || parsed.mode === 'SCI-FI'
            ? 'SOFT_SCIFI'
            : 'SOFT_AMBIENT';

        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled,
          mode,
          volume:
            typeof parsed.volume === 'number' && !isNaN(parsed.volume)
              ? Math.max(0, Math.min(0.2, parsed.volume))
              : DEFAULT_SETTINGS.volume,
        };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const managerRef = useRef<BackgroundMusicManager>(BackgroundMusicManager.getInstance());
  const hasUserInteractedRef = useRef<boolean>(false);

  // Apply settings to manager whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}

    managerRef.current.applySettings(settings);
  }, [settings]);

  // Autoplay & Browser audio policy unlock handling
  useEffect(() => {
    const handleFirstGesture = () => {
      if (!hasUserInteractedRef.current) {
        hasUserInteractedRef.current = true;
        managerRef.current.handleUserGestureUnlock();
      }
    };

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  // Real-time Voice Ducking Controller
  useEffect(() => {
    const session = options?.sessionState || 'OFFLINE';
    const machine = options?.machineState || 'MANUAL_IDLE';
    const revaLevel = options?.revaAudioLevel || 0;

    let duckingState: VoiceDuckingState = 'IDLE';

    if (session === 'REVA_SPEAKING' || machine === 'SPEAKING' || revaLevel > 0.04) {
      duckingState = 'SPEAKING';
    } else if (
      session === 'USER_SPEAKING' ||
      machine === 'LISTENING' ||
      machine === 'MANUAL_LISTENING'
    ) {
      duckingState = 'LISTENING';
    } else if (machine === 'THINKING') {
      duckingState = 'THINKING';
    } else if (session === 'ERROR' || machine === 'ERROR') {
      duckingState = 'ERROR';
    } else {
      duckingState = 'IDLE';
    }

    managerRef.current.updateVoiceState(duckingState);
  }, [options?.sessionState, options?.machineState, options?.revaAudioLevel, options?.userAudioLevel]);

  // Actions
  const setMusicEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
  }, []);

  const toggleMusic = useCallback(() => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setMusicMode = useCallback((mode: AmbientMusicMode) => {
    setSettings((prev) => ({ ...prev, mode }));
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(0.2, volume));
    setSettings((prev) => ({ ...prev, volume: clamped }));
  }, []);

  return {
    musicSettings: settings,
    setMusicEnabled,
    toggleMusic,
    setMusicMode,
    setMusicVolume,
  };
}
