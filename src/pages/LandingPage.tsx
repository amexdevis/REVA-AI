/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useSystemStatus } from '../hooks/useSystemStatus.js';
import { useRevaVoice } from '../hooks/useRevaVoice.js';
import { useRevaMemory } from '../hooks/useRevaMemory.js';
import { StatusIndicator } from '../components/StatusIndicator.js';
import { TechnicalDetails } from '../components/TechnicalDetails.js';
import { VoiceStatusView } from '../components/VoiceStatusView.js';
import { VoiceDiagnosticsPanel } from '../components/VoiceDiagnosticsPanel.js';
import { MemoryManagerPanel } from '../components/MemoryManagerPanel.js';
import { ProactiveStatusPanel } from '../components/ProactiveStatusPanel.js';
import { Activity, Radio, Database, Sparkles } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { status, refreshStatus } = useSystemStatus();
  const {
    memories,
    episodicMemories,
    projects,
    userProfile,
    workingMemory,
    searchResults,
    consolidationReport,
    isLoading: isMemLoading,
    error: memError,
    refreshMemories,
    searchMemories,
    createMemory,
    updateMemory,
    deleteMemory,
    clearAllMemories,
    consolidateMemories,
    executeVoiceCommand,
    createEpisodicMemory,
    deleteEpisodicMemory,
    saveProject,
    deleteProject,
  } = useRevaMemory();

  const {
    sessionState,
    micState,
    userAudioLevel,
    revaAudioLevel,
    diagnostics,
    transcripts,
    startVoiceSession,
    connectWebSocket,
    disconnectVoice,
    toggleMute,
    handleInterrupt,
    testGreeting,
    sendProactiveEvent,
  } = useRevaVoice({
    onMemoryUpdated: () => {
      refreshMemories();
    },
  });

  const [activeTab, setActiveTab] = useState<'voice' | 'proactive' | 'memory' | 'diagnostics'>('voice');

  return (
    <div
      id="reva-landing-root"
      className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-start py-10 px-4 sm:px-6 selection:bg-zinc-800"
    >
      <main className="w-full max-w-3xl flex flex-col items-center text-center space-y-6">
        {/* Header section */}
        <div className="space-y-2">
          <h1
            id="reva-title"
            className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-100 font-sans"
          >
            REVA
          </h1>
          <p
            id="reva-subtitle"
            className="text-sm sm:text-base text-zinc-400 font-mono tracking-wide"
          >
            Voice-First AI Companion
          </p>
        </div>

        {/* Dynamic status banner */}
        <div>
          <StatusIndicator
            serverStatus={status.serverStatus}
            geminiStatus={status.geminiStatus}
            isLoading={status.isLoading}
          />
        </div>

        {/* View Switcher Tabs */}
        <div className="inline-flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono">
          <button
            id="tab-btn-voice"
            onClick={() => setActiveTab('voice')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Voice Core</span>
          </button>

          <button
            id="tab-btn-proactive"
            onClick={() => setActiveTab('proactive')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'proactive'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40 font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proactive Engine</span>
          </button>

          <button
            id="tab-btn-memory"
            onClick={() => setActiveTab('memory')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'memory'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Memory ({memories.length})</span>
          </button>

          <button
            id="tab-btn-diagnostics"
            onClick={() => setActiveTab('diagnostics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Content based on Active Tab */}
        {activeTab === 'voice' ? (
          <VoiceStatusView
            sessionState={sessionState}
            micState={micState}
            userAudioLevel={userAudioLevel}
            revaAudioLevel={revaAudioLevel}
            transcripts={transcripts}
            personality={diagnostics.personality}
            onStartVoice={startVoiceSession}
            onDisconnectVoice={disconnectVoice}
            onToggleMute={toggleMute}
            onInterrupt={handleInterrupt}
          />
        ) : activeTab === 'proactive' ? (
          <div className="w-full text-left">
            <ProactiveStatusPanel onSpeakProactive={(type, ctx) => sendProactiveEvent(type, ctx)} />
          </div>
        ) : activeTab === 'memory' ? (
          <MemoryManagerPanel
            memories={memories}
            episodicMemories={episodicMemories}
            projects={projects}
            userProfile={userProfile}
            workingMemory={workingMemory}
            searchResults={searchResults}
            consolidationReport={consolidationReport}
            isLoading={isMemLoading}
            error={memError}
            onRefresh={refreshMemories}
            onSearch={searchMemories}
            onCreateMemory={createMemory}
            onUpdateMemory={updateMemory}
            onDeleteMemory={deleteMemory}
            onClearAllMemories={clearAllMemories}
            onConsolidate={consolidateMemories}
            onExecuteCommand={executeVoiceCommand}
            onCreateEpisodic={createEpisodicMemory}
            onDeleteEpisodic={deleteEpisodicMemory}
            onSaveProject={saveProject}
            onDeleteProject={deleteProject}
          />
        ) : (
          <div className="w-full space-y-6 flex flex-col items-center">
            <VoiceDiagnosticsPanel
              diagnostics={{ ...diagnostics, memoryCount: memories.length }}
              onTestConnection={connectWebSocket}
              onTestAudioOutput={testGreeting}
            />

            <TechnicalDetails
              status={status}
              onRefresh={refreshStatus}
            />
          </div>
        )}

        {/* Footer info */}
        <div className="text-zinc-600 text-xs font-mono pt-4 border-t border-zinc-900 w-full">
          REVA Proactive Companion & Voice Core • Step 5
        </div>
      </main>
    </div>
  );
};
