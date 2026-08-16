/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VoiceSessionState =
  | 'OFFLINE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'READY'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'REVA_SPEAKING'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'ERROR';

export interface RevaEmotionalState {
  happiness: number;
  excitement: number;
  curiosity: number;
  concern: number;
  calmness: number;
  confidence: number;
  playfulness: number;
  frustration: number;
  affection: number;
}

export type ConversationMode =
  | 'CASUAL'
  | 'SERIOUS'
  | 'PLAYFUL'
  | 'SUPPORTIVE'
  | 'FOCUSED'
  | 'EXCITED'
  | 'CALM';

export type UserEmotionEstimate =
  | 'CALM'
  | 'HAPPY'
  | 'EXCITED'
  | 'SAD'
  | 'FRUSTRATED'
  | 'ANGRY'
  | 'CONFUSED'
  | 'TIRED'
  | 'CURIOUS'
  | 'NEUTRAL';

export type ResponseLengthCategory = 'REACTION' | 'CONCISE' | 'BALANCED' | 'DETAILED';

export type MemoryCategory =
  | 'USER_PROFILE'
  | 'PREFERENCE'
  | 'PROJECT'
  | 'GOAL'
  | 'INTEREST'
  | 'HABIT'
  | 'ROUTINE'
  | 'IMPORTANT_FACT'
  | 'CONVERSATION_CONTEXT'
  | 'OTHER';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  confidence: number;
  source: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  access_count?: number;
  superseded_by?: string | null;
  project_id?: string | null;
  similarity?: number;
  score?: number;
}

export interface EpisodicMemoryRecord {
  id: string;
  summary: string;
  topic: string;
  date: string;
  importance: number;
  confidence: number;
  related_project?: string | null;
  created_at: string;
}

export interface ProjectMemoryRecord {
  id: string;
  name: string;
  description: string;
  goals: string[];
  decisions: string[];
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  name?: string;
  preferences: string[];
  interests: string[];
  projects: string[];
  goals: string[];
  communication_preferences: string[];
  ui_preferences: string[];
  updated_at: string;
}

export interface WorkingMemoryState {
  currentTopic: string;
  currentTask: string;
  recentContext: Array<{ role: 'user' | 'reva'; text: string; timestamp: number }>;
  recentPreferences: string[];
  conversationState: string;
  lastUpdated: number;
}

export interface ConsolidationReport {
  mergedCount: number;
  supersededCount: number;
  reinforcedCount: number;
  episodicCreatedCount: number;
  timestamp: string;
}

export interface PersonalityDiagnosticsData {
  mode: ConversationMode;
  userEmotion: UserEmotionEstimate;
  revaEmotions: RevaEmotionalState;
  responseStyle: string;
  responseLength: ResponseLengthCategory;
}

export type ProactiveEventType =
  | 'USER_IDLE'
  | 'USER_RETURNED'
  | 'LONG_WORK_SESSION'
  | 'APPLICATION_CHANGED'
  | 'TAB_CONTEXT_CHANGED'
  | 'TASK_COMPLETED'
  | 'TIMER_COMPLETED'
  | 'SYSTEM_EVENT'
  | 'TIME_CONTEXT'
  | 'CONVERSATION_PAUSED';

export type ProactiveConversationType =
  | 'CHECK_IN'
  | 'OBSERVATION'
  | 'ENCOURAGEMENT'
  | 'REMINDER'
  | 'CELEBRATION'
  | 'CURIOSITY'
  | 'CONTEXTUAL_COMMENT';

export interface ProactiveEvent {
  id: string;
  type: ProactiveEventType;
  importance: number;
  timestamp: string;
  context: Record<string, any>;
  processed: boolean;
}

export interface ProactiveDecision {
  id: string;
  decision: 'SPEAK' | 'REMAIN_SILENT';
  reason: string;
  importanceScore: number;
  cooldownRemainingMs: number;
  timestamp: string;
  conversationType?: ProactiveConversationType;
  event?: ProactiveEvent;
  speechText?: string;
}

export interface ProactiveSettings {
  proactiveMode: boolean;
  quietMode: boolean;
  activityAwareness: boolean;
  applicationAwareness: boolean;
  longSessionAwareness: boolean;
  idleThresholdSeconds: number;
  longSessionThresholdMinutes: number;
  minimumProactiveIntervalSeconds: number;
  importanceThreshold: number;
}

export interface ProactiveDiagnosticsData {
  settings: ProactiveSettings;
  lastEvent: ProactiveEvent | null;
  lastDecision: ProactiveDecision | null;
  decisionHistory: ProactiveDecision[];
  recentEvents: ProactiveEvent[];
  cooldownRemainingSeconds: number;
  currentWorkspaceApp: string;
  sessionActiveMinutes: number;
  idleSeconds: number;
}

export interface ClientVoiceMessage {
  type:
    | 'CONNECT'
    | 'AUDIO_INPUT'
    | 'USER_SPEAKING'
    | 'USER_STOPPED'
    | 'INTERRUPT'
    | 'TEST_GREETING'
    | 'PROACTIVE_EVENT'
    | 'UPDATE_PROACTIVE_SETTINGS'
    | 'DISCONNECT';
  audio?: string; // Base64 PCM 16kHz mono
  text?: string;
  event?: Partial<ProactiveEvent>;
  settings?: Partial<ProactiveSettings>;
}

export interface ServerVoiceMessage {
  type:
    | 'SESSION_STATE'
    | 'AUDIO_OUTPUT'
    | 'INTERRUPTED'
    | 'TURN_COMPLETE'
    | 'TRANSCRIPT'
    | 'EMOTION_UPDATE'
    | 'MEMORY_UPDATE'
    | 'PROACTIVE_UPDATE'
    | 'PROACTIVE_SPEECH'
    | 'DIAGNOSTIC'
    | 'ERROR';
  state?: VoiceSessionState;
  audio?: string; // Base64 PCM 24kHz mono
  role?: 'user' | 'reva';
  text?: string;
  error?: string;
  code?: number;
  reason?: string;
  event?: string;
  personality?: PersonalityDiagnosticsData;
  memories?: MemoryRecord[];
  proactive?: ProactiveDiagnosticsData;
  details?: Record<string, unknown>;
}
