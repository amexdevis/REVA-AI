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

export type MicrophonePermissionState =
  | 'UNINITIALIZED'
  | 'REQUESTING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'DENIED'
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

export interface VoiceTranscriptItem {
  id: string;
  role: 'user' | 'reva';
  text: string;
  timestamp: string;
}

export interface MemoryRetrievalDiagnostics {
  lastSearchStatus: 'FOUND' | 'NOT_FOUND' | 'IDLE';
  memoriesRetrieved: number;
  topMemoryCategories: string[];
  lastSearchTopic?: string;
  timestamp?: string;
}

export interface VoiceDiagnostics {
  revaVoiceState: VoiceSessionState;
  geminiLiveState: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  micState: MicrophonePermissionState;
  audioInState: 'ACTIVE' | 'IDLE' | 'ERROR';
  audioOutState: 'ACTIVE' | 'IDLE' | 'ERROR';
  currentModel: string;
  lastEvent: string;
  lastError: string | null;
  closeCode: number | null;
  closeReason: string | null;
  reconnectAttempts: number;
  personality: PersonalityDiagnosticsData;
  memoryCount?: number;
  memoryRetrieval?: MemoryRetrievalDiagnostics;
  proactive?: ProactiveDiagnosticsData;
  context?: ContextDiagnostics;
}

export type ToolPermissionLevel = 'READ_ONLY' | 'REVERSIBLE' | 'SENSITIVE' | 'DESTRUCTIVE';

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermissionLevel;
  parameters: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface ToolExecutionResult {
  tool: string;
  executionId: string;
  success: boolean;
  result?: any;
  error?: string;
  permission: ToolPermissionLevel;
  executionTimeMs: number;
  timestamp: string;
}

export interface SystemStatusData {
  platform: string;
  hostname: string;
  architecture: string;
  cpuCount: number;
  loadAverage: number[];
  totalMemoryMb: number;
  freeMemoryMb: number;
  usedMemoryMb: number;
  memoryUsagePercentage: number;
  uptimeSeconds: number;
  uptimeFormatted: string;
  activeWindow: string;
  currentTime: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface TimerItem {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  endsAt: string;
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
    | 'CONTEXT_UPDATE'
    | 'TOOL_EXECUTED'
    | 'TIMER_RING'
    | 'CLIPBOARD_SYNC'
    | 'OPEN_URL'
    | 'ERROR';
  state?: VoiceSessionState;
  audio?: string;
  role?: 'user' | 'reva';
  text?: string;
  personality?: PersonalityDiagnosticsData;
  proactive?: ProactiveDiagnosticsData;
  context?: ContextDiagnostics;
  toolResult?: ToolExecutionResult;
  timer?: TimerItem;
  url?: string;
  event?: string;
  error?: string;
  code?: number;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface ClientVoiceMessage {
  type:
    | 'CONNECT'
    | 'DISCONNECT'
    | 'AUDIO_INPUT'
    | 'INTERRUPT'
    | 'TEST_GREETING'
    | 'PROACTIVE_EVENT'
    | 'UPDATE_PROACTIVE_SETTINGS'
    | 'UPDATE_CONTEXT_SETTINGS'
    | 'EXECUTE_TOOL'
    | 'CLIPBOARD_PASTE';
  audio?: string;
  text?: string;
  event?: {
    type: ProactiveEventType;
    context?: Record<string, any>;
  };
  settings?: Partial<ProactiveSettings>;
  contextSettings?: Partial<{
    contextAwarenessEnabled: boolean;
    timeAwarenessEnabled: boolean;
    applicationContextEnabled: boolean;
    autoTopicTracking: boolean;
  }>;
  toolName?: string;
  toolArgs?: Record<string, any>;
  clipboardText?: string;
}

export type UserConversationalState =
  | 'CALM'
  | 'BUSY'
  | 'FOCUSED'
  | 'EXCITED'
  | 'FRUSTRATED'
  | 'CONFUSED'
  | 'TIRED'
  | 'CURIOUS'
  | 'NEUTRAL';

export type DayPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface ContextDiagnostics {
  currentTopic: string;
  currentTask: string;
  activeApplication: string | null;
  userState: UserConversationalState;
  relevantMemoryCount: number;
  lastContextEvent: string | null;
  contextAwarenessEnabled: boolean;
  timeOfDay: string;
  periodOfDay: DayPeriod;
  lastUpdated: string;
}

