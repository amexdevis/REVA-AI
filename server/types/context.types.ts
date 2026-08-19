/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface TimeContextInfo {
  localTimeFormatted: string;
  localDateFormatted: string;
  periodOfDay: DayPeriod;
  isLateNight: boolean;
  hour: number;
  weekday: string;
  timezoneOffset: string;
}

export interface AmbiguityResolution {
  isAmbiguous: boolean;
  rawReference: string;
  resolvedEntity?: string;
  confidence: number;
  possibleOptions: string[];
  clarificationNeeded: boolean;
  clarificationQuestion?: string;
}

export interface ContextEventRecord {
  id: string;
  type: string;
  summary: string;
  payload: Record<string, any>;
  timestamp: number;
}

export interface ContextSnapshot {
  currentTopic: string;
  currentTask: string;
  currentUserRequest: string | null;
  currentRevaState: string;
  recentImportantStatements: string[];
  activeApplication: string | null;
  userState: UserConversationalState;
  timeContext: TimeContextInfo;
  relevantMemoryIds: string[];
  relevantMemoryCount: number;
  lastContextEvent: ContextEventRecord | null;
  ambiguityCandidate: AmbiguityResolution | null;
  contextAwarenessEnabled: boolean;
  timestamp: number;
}

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

export interface ContextSettings {
  contextAwarenessEnabled: boolean;
  timeAwarenessEnabled: boolean;
  applicationContextEnabled: boolean;
  autoTopicTracking: boolean;
}
