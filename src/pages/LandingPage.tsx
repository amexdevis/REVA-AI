/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRevaVoice } from '../hooks/useRevaVoice.js';
import { useRevaMemory } from '../hooks/useRevaMemory.js';
import { useRevaTools } from '../hooks/useRevaTools.js';
import { useRevaProactive } from '../hooks/useRevaProactive.js';
import { useRevaMusic } from '../hooks/useRevaMusic.js';
import { AmbientParticles } from '../components/AmbientParticles.js';
import { HolographicPlatform } from '../components/HolographicPlatform.js';
import { RevaCharacter } from '../components/RevaCharacter.js';
import { AudioVisualizer } from '../components/AudioVisualizer.js';
import { MicrophoneControl } from '../components/MicrophoneControl.js';
import { MemoryIndicator } from '../components/MemoryIndicator.js';
import { MoodIndicator } from '../components/MoodIndicator.js';
import { RevaStatus } from '../components/RevaStatus.js';
import { VoiceModeSelector } from '../components/VoiceModeSelector.js';
import { SettingsButton } from '../components/SettingsButton.js';
import { RevaSettingsModal } from '../components/RevaSettingsModal.js';
import { RevaMemoryModal } from '../components/RevaMemoryModal.js';
import { Bell, Globe, FileText, CheckSquare, Box } from 'lucide-react';
import { CoreIdentityConfig } from '../config/core-identity.config.js';

export const LandingPage: React.FC = () => {
  const {
    memories,
    userProfile,
    refreshMemories,
    deleteMemory,
    clearAllMemories,
  } = useRevaMemory();

  const {
    systemStatus,
    activeNotification,
    addRealtimeToolResult,
    handleTimerRing,
    handleClipboardSync,
    handleOpenUrl,
    dismissNotification,
  } = useRevaTools();

  const handleMemoryUpdated = useCallback(() => {
    refreshMemories();
  }, [refreshMemories]);

  const handleToolExecuted = useCallback((result: any) => {
    addRealtimeToolResult(result);
  }, [addRealtimeToolResult]);

  const handleTimerRingCallback = useCallback((timer: any) => {
    handleTimerRing(timer);
  }, [handleTimerRing]);

  const handleOpenUrlCallback = useCallback((url: string) => {
    handleOpenUrl(url);
  }, [handleOpenUrl]);

  const handleClipboardSyncCallback = useCallback((text: string) => {
    handleClipboardSync(text);
  }, [handleClipboardSync]);

  const {
    voiceMode,
    machineState,
    wakeWordStatus,
    isWakeWordSupported,
    sessionState,
    micState,
    userAudioLevel,
    revaAudioLevel,
    diagnostics,
    transcripts,
    setVoiceMode,
    startVoiceSession,
    toggleMute,
    handleInterrupt,
    testGreeting,
    sendProactiveEvent,
    sendProactiveSettingsUpdate,
    sendContextSettingsUpdate,
  } = useRevaVoice({
    onMemoryUpdated: handleMemoryUpdated,
    onToolExecuted: handleToolExecuted,
    onTimerRing: handleTimerRingCallback,
    onOpenUrl: handleOpenUrlCallback,
    onClipboardSync: handleClipboardSyncCallback,
  });

  const handleProactiveTrigger = useCallback((type: any, context: any) => {
    sendProactiveEvent(type, context);
  }, [sendProactiveEvent]);

  const {
    settings: proactiveSettings,
    triggerEvent: triggerProactiveEvent,
    updateSettings: updateProactiveSettings,
  } = useRevaProactive({
    onProactiveTrigger: handleProactiveTrigger,
  });

  const {
    musicSettings,
    toggleMusic,
    setMusicMode,
    setMusicVolume,
  } = useRevaMusic({
    sessionState,
    machineState,
    revaAudioLevel,
    userAudioLevel,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [energyFlareEnabled, setEnergyFlareEnabled] = useState(true);
  const [characterTestAnimation, setCharacterTestAnimation] = useState(false);
  const [activeDockTab, setActiveDockTab] = useState<'web' | 'notes' | 'tasks' | 'system'>('web');
  const hasTriggeredAppOpenRef = useRef(false);

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleOpenMemory = useCallback(() => setIsMemoryOpen(true), []);
  const handleCloseMemory = useCallback(() => setIsMemoryOpen(false), []);
  const handleToggleEnergyFlare = useCallback(() => setEnergyFlareEnabled((prev) => !prev), []);
  const handleToggleCharacterTestAnimation = useCallback(() => setCharacterTestAnimation((prev) => !prev), []);
  const handleUpdateProactiveSettings = useCallback((settings: any) => {
    sendProactiveSettingsUpdate(settings);
    updateProactiveSettings(settings);
  }, [sendProactiveSettingsUpdate, updateProactiveSettings]);

  const handleCharacterClick = useCallback(() => {
    if (voiceMode === 'OFF') {
      setVoiceMode('MANUAL');
      startVoiceSession();
    } else if (sessionState === 'OFFLINE' || machineState === 'MANUAL_IDLE') {
      startVoiceSession();
    }
  }, [voiceMode, sessionState, machineState, setVoiceMode, startVoiceSession]);

  // Trigger natural app opening interaction
  useEffect(() => {
    if (!hasTriggeredAppOpenRef.current && sessionState === 'READY' && voiceMode !== 'OFF') {
      hasTriggeredAppOpenRef.current = true;
      const timeout = setTimeout(() => {
        triggerProactiveEvent('APP_OPEN', {
          time: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [sessionState, voiceMode, triggerProactiveEvent]);

  // Live time and date
  const [timeString, setTimeString] = useState<string>('09:41 PM');
  const [dateString, setDateString] = useState<string>('May 17, Fri');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setDateString(
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Spacebar hotkey to talk / toggle microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isSettingsOpen ||
        isMemoryOpen ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (voiceMode === 'OFF') {
          setVoiceMode('MANUAL');
          startVoiceSession();
        } else if (sessionState === 'OFFLINE' || machineState === 'MANUAL_IDLE') {
          startVoiceSession();
        } else if (sessionState === 'REVA_SPEAKING' || machineState === 'SPEAKING') {
          handleInterrupt();
        } else {
          toggleMute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    voiceMode,
    sessionState,
    machineState,
    isSettingsOpen,
    isMemoryOpen,
    startVoiceSession,
    handleInterrupt,
    toggleMute,
    setVoiceMode,
  ]);

  return (
    <div
      id="reva-companion-viewport"
      className="relative w-screen h-screen min-h-screen bg-[#000000] text-zinc-100 overflow-hidden select-none font-sans flex flex-col justify-between"
    >
      {/* 1. Atmospheric Glows & Moving Particles */}
      <AmbientParticles
        sessionState={sessionState}
        userAudioLevel={userAudioLevel}
        revaAudioLevel={revaAudioLevel}
        emotionalState={diagnostics.personality?.revaEmotions}
      />

      {/* Atmospheric Depth Haze Overlay: Separates foreground character from distant cosmic background */}
      <div
        id="reva-atmospheric-depth-haze"
        className="absolute inset-0 w-full h-full pointer-events-none z-[1] bg-gradient-to-t from-[#150428]/35 via-[#1c0634]/18 to-[#0a0216]/10 mix-blend-screen transition-opacity duration-700"
      />

      {/* 2. Top Header HUD */}
      <header className="relative z-30 w-full px-8 lg:px-12 pt-6 flex items-center justify-between">
        {/* Top-Left: REVA AI COMPANION */}
        <div className="flex flex-col items-start select-none">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-300 shadow-[0_0_12px_#d8b4fe]" />
            <h1 className="text-3xl lg:text-4xl font-normal tracking-[0.28em] text-white drop-shadow-[0_0_20px_rgba(216,180,254,0.6)]">
              {CoreIdentityConfig.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5 pl-4 border-l-2 border-purple-500/50">
            <span className="text-[11px] font-sans text-purple-300/80 tracking-[0.32em] uppercase font-light">
              AI COMPANION
            </span>
          </div>
        </div>

        {/* Top-Center: Voice Mode Selector (Manual, Hands-Free, Off) */}
        <div className="flex justify-center">
          <VoiceModeSelector
            voiceMode={voiceMode}
            machineState={machineState}
            wakeWordStatus={wakeWordStatus}
            isWakeWordSupported={isWakeWordSupported}
            onSelectMode={setVoiceMode}
          />
        </div>

        {/* Top-Right: Unified Status Pill (Status, Time/Date, Settings) */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-full bg-[#0a0316]/80 border border-purple-900/60 backdrop-blur-2xl shadow-[0_0_25px_rgba(107,33,168,0.25)]">
            <RevaStatus
              sessionState={sessionState}
              voiceMode={voiceMode}
              machineState={machineState}
            />

            <div className="h-5 w-[1px] bg-purple-800/50" />

            <div className="flex flex-col items-end text-right font-sans leading-tight">
              <span className="text-xs font-normal text-purple-100 tracking-wide">
                {timeString}
              </span>
              <span className="text-[10px] text-purple-300/70 tracking-wider">
                {dateString}
              </span>
            </div>

            <div className="h-5 w-[1px] bg-purple-800/50" />

            <SettingsButton onClick={handleOpenSettings} />
          </div>
        </div>
      </header>

      {/* Floating System Alert Notification (e.g. Timer Alerts) */}
      {activeNotification && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-[#17052e]/95 border border-purple-400/80 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.5)] flex items-center gap-3 text-xs font-sans text-purple-100 max-w-[90vw] transition-all">
          <Bell className="w-4 h-4 text-purple-300 animate-bounce shrink-0" />
          <span>{activeNotification.message}</span>
          <button
            onClick={dismissNotification}
            className="px-2.5 py-0.5 bg-purple-700 hover:bg-purple-600 rounded-full text-purple-100 cursor-pointer text-[10px] shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* 3. Main Central Viewport: Centered Full-Body Anime REVA Standing on Holographic Platform */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-between px-6 sm:px-10 md:px-14 pointer-events-none pb-4">
        {/* Left Section: Dialogue Card + Memory Indicator Stack */}
        <div className="pointer-events-auto z-20 flex flex-col items-start gap-4 pl-0 -ml-2 sm:-ml-4 md:-ml-6 py-2">
          {/* Top: Dialogue & Waveform Card */}
          <AudioVisualizer
            sessionState={sessionState}
            userAudioLevel={userAudioLevel}
            revaAudioLevel={revaAudioLevel}
            transcripts={transcripts}
            userName={userProfile?.name || 'Master'}
          />

          {/* Bottom Left: Memory Card */}
          <div className="flex flex-col gap-3 w-full">
            <MemoryIndicator
              memoryCount={memories.length}
              onClick={handleOpenMemory}
            />
          </div>
        </div>

        {/* Center: Large Full-Body REVA Character with Holographic Pedestal at her feet */}
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-[2.5%] sm:bottom-[3%] md:bottom-[3.5%] flex flex-col items-center justify-end z-10">
          <HolographicPlatform
            sessionState={sessionState}
            userAudioLevel={userAudioLevel}
            revaAudioLevel={revaAudioLevel}
            emotionalState={diagnostics.personality?.revaEmotions}
          />

          <RevaCharacter
            sessionState={sessionState}
            userAudioLevel={userAudioLevel}
            revaAudioLevel={revaAudioLevel}
            emotionalState={diagnostics.personality?.revaEmotions}
            energyFlareEnabled={energyFlareEnabled}
            characterTestAnimation={characterTestAnimation}
            onCharacterClick={handleCharacterClick}
          />
        </div>

        {/* Right Section: Microphone Control & Mood Indicator */}
        <div className="pointer-events-auto z-20 flex flex-col items-end justify-between h-full py-2 -mr-2 sm:-mr-4 md:-mr-6">
          {/* Top / Center: Microphone Control */}
          <div className="flex-1 flex items-center justify-center w-full">
            <MicrophoneControl
              sessionState={sessionState}
              micState={micState}
              voiceMode={voiceMode}
              machineState={machineState}
              wakeWordStatus={wakeWordStatus}
              userAudioLevel={userAudioLevel}
              revaAudioLevel={revaAudioLevel}
              onToggleMute={toggleMute}
              onStartSession={startVoiceSession}
              onInterrupt={handleInterrupt}
              onSelectMode={setVoiceMode}
            />
          </div>

          {/* Bottom Right: Mood Card matching Left Memory Card */}
          <div className="flex flex-col gap-3 w-full items-end">
            <MoodIndicator
              personality={diagnostics.personality}
              onClick={handleOpenSettings}
            />
          </div>
        </div>
      </main>

      {/* 4. Bottom Page Footer with Creator Credit */}
      <footer className="relative z-30 w-full pb-3 pt-1 flex items-center justify-center pointer-events-auto">
        <span className="text-[11px] sm:text-xs font-sans text-purple-300/60 tracking-wider flex items-center gap-1.5 backdrop-blur-sm px-3 py-1 rounded-full border border-purple-500/10">
          Created by {CoreIdentityConfig.creator}
          <span className="text-purple-400 text-xs">💜</span>
        </span>
      </footer>

      {/* Settings Modal Overlay */}
      <RevaSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        diagnostics={diagnostics}
        voiceMode={voiceMode}
        machineState={machineState}
        wakeWordStatus={wakeWordStatus}
        isWakeWordSupported={isWakeWordSupported}
        onSelectMode={setVoiceMode}
        proactiveSettings={diagnostics.proactive?.settings || proactiveSettings}
        systemStatus={systemStatus}
        onUpdateProactiveSettings={handleUpdateProactiveSettings}
        onUpdateContextSettings={sendContextSettingsUpdate}
        onTestGreeting={testGreeting}
        musicSettings={musicSettings}
        onToggleMusic={toggleMusic}
        onSelectMusicMode={setMusicMode}
        onSetMusicVolume={setMusicVolume}
        energyFlareEnabled={energyFlareEnabled}
        onToggleEnergyFlare={handleToggleEnergyFlare}
        characterTestAnimation={characterTestAnimation}
        onToggleCharacterTestAnimation={handleToggleCharacterTestAnimation}
      />

      {/* Memory Modal Overlay */}
      <RevaMemoryModal
        isOpen={isMemoryOpen}
        onClose={handleCloseMemory}
        memories={memories}
        userProfile={userProfile}
        onDeleteMemory={deleteMemory}
        onClearAll={clearAllMemories}
        onRefreshMemories={refreshMemories}
      />
    </div>
  );
};
