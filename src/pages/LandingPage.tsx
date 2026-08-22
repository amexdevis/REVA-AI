/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useRevaVoice } from '../hooks/useRevaVoice.js';
import { useRevaMemory } from '../hooks/useRevaMemory.js';
import { useRevaTools } from '../hooks/useRevaTools.js';
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
import { Bell } from 'lucide-react';

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
    sendProactiveSettingsUpdate,
    sendContextSettingsUpdate,
  } = useRevaVoice({
    onMemoryUpdated: () => {
      refreshMemories();
    },
    onToolExecuted: (result) => {
      addRealtimeToolResult(result);
    },
    onTimerRing: (timer) => {
      handleTimerRing(timer);
    },
    onOpenUrl: (url) => {
      handleOpenUrl(url);
    },
    onClipboardSync: (text) => {
      handleClipboardSync(text);
    },
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);

  // Live time and date
  const [timeString, setTimeString] = useState<string>('10:42 PM');
  const [dateString, setDateString] = useState<string>('Friday, 16 May 2025');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setDateString(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
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
      className="relative w-screen h-screen min-h-screen bg-[#030107] text-zinc-100 overflow-hidden select-none font-sans flex flex-col justify-between"
    >
      {/* 1. Atmospheric Glows & Moving Particles */}
      <AmbientParticles
        sessionState={sessionState}
        userAudioLevel={userAudioLevel}
        revaAudioLevel={revaAudioLevel}
        emotionalState={diagnostics.personality?.revaEmotions}
      />

      {/* 2. Top Header HUD */}
      <header className="relative z-30 w-full px-6 sm:px-10 pt-4 sm:pt-6 flex items-center justify-between">
        {/* Top-Left: REVA AI COMPANION */}
        <div className="flex-1 flex flex-col items-start select-none">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extralight tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-purple-200 to-pink-200 drop-shadow-[0_0_18px_rgba(216,180,254,0.7)]">
            REVA
          </h1>
          <span className="text-[10px] sm:text-xs font-mono text-purple-300/70 tracking-[0.3em] uppercase mt-0.5">
            AI COMPANION
          </span>
        </div>

        {/* Top-Center: Dedicated Voice Mode Selector (Horizontally Centered, Safely Above REVA) */}
        <div className="flex-initial flex items-center justify-center px-2">
          <VoiceModeSelector
            voiceMode={voiceMode}
            machineState={machineState}
            wakeWordStatus={wakeWordStatus}
            isWakeWordSupported={isWakeWordSupported}
            onSelectMode={setVoiceMode}
          />
        </div>

        {/* Top-Right: Status, Live Clock & Settings */}
        <div className="flex-1 flex items-center justify-end gap-3 sm:gap-4">
          <RevaStatus
            sessionState={sessionState}
            voiceMode={voiceMode}
            machineState={machineState}
          />

          <div className="hidden lg:flex flex-col items-end text-right font-sans">
            <span className="text-sm sm:text-base md:text-lg text-purple-100 font-medium tracking-wide drop-shadow-[0_0_8px_rgba(216,180,254,0.4)]">
              {timeString}
            </span>
            <span className="text-[11px] sm:text-xs text-purple-400/60 tracking-wider">
              {dateString}
            </span>
          </div>

          <SettingsButton onClick={() => setIsSettingsOpen(true)} />
        </div>
      </header>

      {/* Floating System Voice Notification */}
      {activeNotification && (
        <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-[#1b0638]/95 border border-purple-400/70 rounded-full shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center gap-3 text-xs font-sans text-purple-100 animate-bounce">
          <Bell className="w-4 h-4 text-purple-300 animate-spin" />
          <span>{activeNotification}</span>
          <button
            onClick={dismissNotification}
            className="px-2.5 py-0.5 bg-purple-700 hover:bg-purple-600 rounded-full text-purple-100 cursor-pointer text-[10px]"
          >
            OK
          </button>
        </div>
      )}

      {/* 3. Main Central Viewport: Centered Full-Body Anime REVA Standing on Holographic Platform */}
      <main className="relative z-10 flex-1 w-full h-full flex items-center justify-between px-6 sm:px-10 md:px-14 pointer-events-none">
        {/* Left Section: Equalizer Waveform, Dialogue & Subtitle */}
        <div className="pointer-events-auto z-20 flex justify-start pl-2">
          <AudioVisualizer
            sessionState={sessionState}
            userAudioLevel={userAudioLevel}
            revaAudioLevel={revaAudioLevel}
            transcripts={transcripts}
            userName={userProfile?.name || 'Master'}
          />
        </div>

        {/* Center: Large Full-Body REVA Character with Holographic Pedestal at her feet */}
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-[8%] sm:bottom-[9%] md:bottom-[10%] flex flex-col items-center justify-end z-10">
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
            onCharacterClick={() => {
              if (voiceMode === 'OFF') {
                setVoiceMode('MANUAL');
                startVoiceSession();
              } else if (sessionState === 'OFFLINE' || machineState === 'MANUAL_IDLE') {
                startVoiceSession();
              }
            }}
          />
        </div>

        {/* Right Section: Large Circular Holographic Microphone Control */}
        <div className="pointer-events-auto z-20 flex justify-end pr-2">
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
      </main>

      {/* 4. Bottom Footer HUD */}
      <footer className="relative z-30 w-full px-6 sm:px-10 pb-4 sm:pb-6 flex items-center justify-between">
        {/* Bottom-Left: Memory Indicator Card */}
        <div className="flex-1 flex justify-start">
          <MemoryIndicator
            memoryCount={memories.length}
            onClick={() => setIsMemoryOpen(true)}
          />
        </div>

        {/* Bottom-Center: Subtle Voice Talk Instruction */}
        <div className="flex-1 flex justify-center text-center">
          <p className="text-xs sm:text-sm text-purple-300/70 font-sans tracking-wide">
            {voiceMode === 'HANDS_FREE'
              ? 'Hands-Free Active — Say "Hey REVA" to talk'
              : voiceMode === 'OFF'
              ? 'Voice Off — Select Manual or Hands-Free to talk'
              : 'Press Space or click mic to talk'}
          </p>
        </div>

        {/* Bottom-Right: Mood Indicator Card */}
        <div className="flex-1 flex justify-end">
          <MoodIndicator
            personality={diagnostics.personality}
            onClick={() => setIsSettingsOpen(true)}
          />
        </div>
      </footer>

      {/* Settings Modal Overlay */}
      <RevaSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        diagnostics={diagnostics}
        voiceMode={voiceMode}
        machineState={machineState}
        wakeWordStatus={wakeWordStatus}
        isWakeWordSupported={isWakeWordSupported}
        onSelectMode={setVoiceMode}
        proactiveSettings={diagnostics.proactive?.settings}
        systemStatus={systemStatus}
        onUpdateProactiveSettings={sendProactiveSettingsUpdate}
        onUpdateContextSettings={sendContextSettingsUpdate}
        onTestGreeting={testGreeting}
      />

      {/* Memory Modal Overlay */}
      <RevaMemoryModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memories={memories}
        userProfile={userProfile}
        onDeleteMemory={deleteMemory}
        onClearAll={clearAllMemories}
        onRefreshMemories={refreshMemories}
      />
    </div>
  );
};
