/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserConversationalState,
  DayPeriod,
  TimeContextInfo,
  AmbiguityResolution,
  ContextEventRecord,
  ContextSnapshot,
  ContextDiagnostics,
  ContextSettings,
} from '../types/context.types.js';
import { WorkingMemoryService } from './working-memory.service.js';
import { MemoryService } from './memory.service.js';
import { ToolExecutionService } from './tool-execution.service.js';
import { TimeService } from './time.service.js';

/**
 * ContextAwarenessService
 * Combines conversation turns, working memory, persistent memory, system context,
 * local time context, and recent user activity into a unified, privacy-safe context.
 */
export class ContextAwarenessService {
  private static instance: ContextAwarenessService | null = null;

  private workingMemory: WorkingMemoryService;
  private memoryService: MemoryService;
  private toolService: ToolExecutionService;

  private settings: ContextSettings = {
    contextAwarenessEnabled: true,
    timeAwarenessEnabled: true,
    applicationContextEnabled: true,
    autoTopicTracking: true,
  };

  // Lightweight temporary context cache (automatically expires)
  private currentTopic = 'General Conversation';
  private currentTask = 'Idle / Attentive';
  private currentUserRequest: string | null = null;
  private currentRevaState = 'READY';
  private activeApplication: string | null = 'VS Code';
  private userState: UserConversationalState = 'CALM';
  private recentImportantStatements: string[] = [];
  private recentEvents: ContextEventRecord[] = [];
  private lastContextEvent: ContextEventRecord | null = null;
  private lastUpdated: number = Date.now();

  // Cache decay durations (TTL)
  private readonly TASK_TTL_MS = 25 * 60 * 1000; // 25 mins
  private readonly EVENT_TTL_MS = 10 * 60 * 1000; // 10 mins

  private constructor() {
    this.workingMemory = WorkingMemoryService.getInstance();
    this.memoryService = MemoryService.getInstance();
    this.toolService = ToolExecutionService.getInstance();
    this.initDatabaseSettings();
  }

  public static getInstance(): ContextAwarenessService {
    if (!ContextAwarenessService.instance) {
      ContextAwarenessService.instance = new ContextAwarenessService();
    }
    return ContextAwarenessService.instance;
  }

  private initDatabaseSettings(): void {
    try {
      const db = this.memoryService.getDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS context_settings (
          id TEXT PRIMARY KEY,
          settings_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const row = db.prepare('SELECT settings_json FROM context_settings WHERE id = ?').get('global') as any;
      if (row && row.settings_json) {
        const loaded = JSON.parse(row.settings_json);
        this.settings = { ...this.settings, ...loaded };
        console.log('[REVA][CONTEXT] Loaded context awareness settings from SQLite');
      }
    } catch (err) {
      console.warn('[REVA][CONTEXT] Could not load context settings from SQLite, using defaults:', err);
    }
  }

  private saveSettingsToDb(): void {
    try {
      const db = this.memoryService.getDb();
      const stmt = db.prepare(`
        INSERT INTO context_settings (id, settings_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_at = excluded.updated_at;
      `);
      stmt.run('global', JSON.stringify(this.settings), new Date().toISOString());
    } catch (err) {
      console.error('[REVA][CONTEXT] Error saving context settings to SQLite:', err);
    }
  }

  public getSettings(): ContextSettings {
    return { ...this.settings };
  }

  public isContextAwarenessEnabled(): boolean {
    return this.settings.contextAwarenessEnabled;
  }

  public setContextAwarenessEnabled(enabled: boolean): ContextSettings {
    this.settings.contextAwarenessEnabled = enabled;
    this.saveSettingsToDb();
    return this.getSettings();
  }

  public updateSettings(partial: Partial<ContextSettings>): ContextSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveSettingsToDb();
    return this.getSettings();
  }

  /**
   * Cleans stale cache items based on TTL
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    if (now - this.lastUpdated > this.TASK_TTL_MS) {
      this.currentTask = 'Idle / Attentive';
      this.currentUserRequest = null;
      this.recentImportantStatements = [];
    }

    // Filter old events
    this.recentEvents = this.recentEvents.filter((ev) => now - ev.timestamp < this.EVENT_TTL_MS);
    if (this.lastContextEvent && now - this.lastContextEvent.timestamp > this.EVENT_TTL_MS) {
      this.lastContextEvent = null;
    }
  }

  /**
   * Computes accurate local system time & period of day using centralized TimeService
   */
  public getTimeContext(): TimeContextInfo {
    const timeService = TimeService.getInstance();
    const userTime = timeService.getTimeContext();

    return {
      localTimeFormatted: userTime.localTimeFormatted,
      localDateFormatted: userTime.localDateFormatted,
      periodOfDay: userTime.periodOfDay,
      isLateNight: userTime.isLateNight,
      hour: userTime.hour,
      weekday: userTime.weekday,
      timezoneOffset: userTime.timezoneOffset,
    };
  }

  /**
   * Records a user turn and performs deterministic context extraction
   */
  public processUserTurn(text: string): {
    ambiguity: AmbiguityResolution;
    userState: UserConversationalState;
  } {
    if (!text || !text.trim()) {
      return {
        ambiguity: { isAmbiguous: false, rawReference: '', confidence: 1.0, possibleOptions: [], clarificationNeeded: false },
        userState: this.userState,
      };
    }

    this.cleanExpiredCache();
    const cleanText = text.trim();
    this.currentUserRequest = cleanText;
    this.lastUpdated = Date.now();

    // 1. Update Working Memory
    this.workingMemory.addTurn('user', cleanText);

    // 2. Infer User State
    this.userState = this.estimateUserState(cleanText);

    // 3. Extract Important Statements
    if (this.isImportantStatement(cleanText)) {
      this.recentImportantStatements.push(cleanText);
      if (this.recentImportantStatements.length > 5) {
        this.recentImportantStatements.shift();
      }
    }

    // 4. Update Topic & Task
    this.extractTopicAndTask(cleanText);

    // 5. Ambiguity check & resolution
    const ambiguity = this.resolveAmbiguity(cleanText);

    return {
      ambiguity,
      userState: this.userState,
    };
  }

  public processRevaTurn(text: string): void {
    if (!text || !text.trim()) return;
    this.cleanExpiredCache();
    this.workingMemory.addTurn('reva', text.trim());
    this.lastUpdated = Date.now();
  }

  public recordContextEvent(type: string, summary: string, payload: Record<string, any> = {}): void {
    if (!this.settings.contextAwarenessEnabled) return;

    this.cleanExpiredCache();
    const eventRecord: ContextEventRecord = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      summary,
      payload,
      timestamp: Date.now(),
    };

    this.recentEvents.push(eventRecord);
    if (this.recentEvents.length > 20) {
      this.recentEvents.shift();
    }
    this.lastContextEvent = eventRecord;
    this.lastUpdated = Date.now();

    if (payload.appName) {
      this.activeApplication = payload.appName;
    }
  }

  public setActiveApplication(appName: string | null): void {
    this.activeApplication = appName ? appName.trim() : null;
    this.lastUpdated = Date.now();
  }

  public setRevaState(state: string): void {
    this.currentRevaState = state;
    this.lastUpdated = Date.now();
  }

  /**
   * Lightweight conversational user state estimation (no permanent storage)
   */
  private estimateUserState(text: string): UserConversationalState {
    const lower = text.toLowerCase();

    if (/\b(tired|exhausted|sleepy|drained|burnout|long night|long day|yawning)\b/.test(lower)) {
      return 'TIRED';
    }
    if (/\b(frustrated|angry|annoyed|broken|hate|failed|stuck again|why is this not working|ugh|dammit)\b/.test(lower)) {
      return 'FRUSTRATED';
    }
    if (/\b(confused|dont understand|don't get it|what does this mean|lost|how does this even)\b/.test(lower)) {
      return 'CONFUSED';
    }
    if (/\b(excited|yay|awesome|let's go|finally|passed|won|breakthrough|amazing)\b/.test(lower)) {
      return 'EXCITED';
    }
    if (/\b(busy|quick question|hurry|rushing|in a meeting|crunch time)\b/.test(lower)) {
      return 'BUSY';
    }
    if (/\b(deep in|focus|debugging|refactoring|writing tests|architecting|coding)\b/.test(lower)) {
      return 'FOCUSED';
    }
    if (/\b(curious|why|what if|how come|explore|wondering|tell me about)\b/.test(lower)) {
      return 'CURIOUS';
    }
    if (/\b(ok|sure|sounds good|alright|thanks|got it)\b/.test(lower)) {
      return 'CALM';
    }

    return 'NEUTRAL';
  }

  private isImportantStatement(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('my name is') ||
      lower.includes('i prefer') ||
      lower.includes('i am working on') ||
      lower.includes('i want to build') ||
      lower.includes('remember that') ||
      lower.includes('the goal is') ||
      lower.includes("don't forget") ||
      lower.includes('my project')
    );
  }

  private extractTopicAndTask(text: string): void {
    const lower = text.toLowerCase();
    const workingState = this.workingMemory.getState();

    // Check project/development cues
    if (lower.includes('reva') || lower.includes('companion') || lower.includes('voice assistant')) {
      this.currentTopic = 'REVA Development';
      this.workingMemory.setTopic('REVA Development');
      if (lower.includes('interface') || lower.includes('ui') || lower.includes('design')) {
        this.currentTask = 'Refining REVA Interface';
      } else if (lower.includes('memory') || lower.includes('sheets') || lower.includes('sqlite')) {
        this.currentTask = 'Optimizing REVA Memory Systems';
      } else if (lower.includes('voice') || lower.includes('audio') || lower.includes('gemini live')) {
        this.currentTask = 'Tuning Voice & Audio Latency';
      } else {
        this.currentTask = 'Building REVA AI Companion';
      }
    } else if (lower.includes('interface') || lower.includes('theme') || lower.includes('layout') || lower.includes('frontend')) {
      this.currentTopic = 'UI & Frontend Design';
      this.currentTask = 'User Interface Styling';
    } else if (lower.includes('bug') || lower.includes('error') || lower.includes('fix') || lower.includes('broken')) {
      this.currentTask = `Troubleshooting ${this.currentTopic}`;
    } else if (lower.includes('open') && (lower.includes('app') || lower.includes('chrome') || lower.includes('editor'))) {
      this.currentTask = 'System Tool Invocation';
    } else {
      // Inherit from working memory if already set
      if (workingState.currentTopic && workingState.currentTopic !== 'General Conversation') {
        this.currentTopic = workingState.currentTopic;
      }
    }
  }

  /**
   * Resolves ambiguous references such as "that", "this", "the project", "the interface", "the problem", "continue it"
   * using conversation context + memory.
   * If multiple conflicting meanings exist, asks a short clarification question.
   */
  public resolveAmbiguity(text: string): AmbiguityResolution {
    const lower = text.toLowerCase().trim();
    const ambiguousPatterns = [
      /\b(?:open|continue|work on|look at|fix|inspect)\s+(?:the\s+)?project\b/i,
      /\b(?:continue|fix|work on)\s+(?:this|that|it)\b/i,
      /\b(?:the\s+interface|the\s+ui)\b/i,
      /\b(?:the\s+memory(?:\s+system)?)\b/i,
      /\b(?:the\s+problem|the\s+issue|the\s+error)\b/i,
    ];

    const isMatch = ambiguousPatterns.some((pattern) => pattern.test(lower));
    if (!isMatch) {
      return {
        isAmbiguous: false,
        rawReference: '',
        confidence: 1.0,
        possibleOptions: [],
        clarificationNeeded: false,
      };
    }

    const workingState = this.workingMemory.getState();
    const persistentMemories = this.memoryService.getAllMemories(true).slice(0, 30);
    const projectMemories = persistentMemories.filter(
      (m) => m.category === 'PROJECT' || m.content.toLowerCase().includes('project') || m.content.toLowerCase().includes('building')
    );

    // Case 1: "open the project" / "the project"
    if (lower.includes('the project') || lower.includes('open the project') || lower.includes('continue the project')) {
      // Find candidate projects
      const options = projectMemories.map((m) => m.content.replace(/^user is building /i, '').replace(/ project$/i, ''));
      if (options.length === 0) {
        if (this.currentTopic.includes('REVA') || this.currentTask.includes('REVA')) {
          return {
            isAmbiguous: false,
            rawReference: 'the project',
            resolvedEntity: 'REVA Companion Project',
            confidence: 0.95,
            possibleOptions: ['REVA Companion Project'],
            clarificationNeeded: false,
          };
        }
      } else if (options.length === 1) {
        return {
          isAmbiguous: false,
          rawReference: 'the project',
          resolvedEntity: options[0],
          confidence: 0.9,
          possibleOptions: options,
          clarificationNeeded: false,
        };
      } else {
        // Multiple projects exist without clear recent context
        const distinct: string[] = Array.from(new Set<string>(options)).slice(0, 2);
        return {
          isAmbiguous: true,
          rawReference: 'the project',
          confidence: 0.5,
          possibleOptions: distinct,
          clarificationNeeded: true,
          clarificationQuestion: `Do you mean the ${distinct[0]} or the ${distinct[1]}?`,
        };
      }
    }

    // Case 2: "the interface" vs "the memory system"
    if (lower.includes('the interface') && lower.includes('memory')) {
      return {
        isAmbiguous: true,
        rawReference: 'interface / memory',
        confidence: 0.5,
        possibleOptions: ['REVA visual interface', 'Google Sheets memory system'],
        clarificationNeeded: true,
        clarificationQuestion: 'You mean the REVA interface or the memory system?',
      };
    }

    // Case 3: "continue it" / "continue where we stopped" / "continue this"
    if (/\b(?:continue\s+(?:it|this|where we stopped)|let's\s+continue)\b/i.test(lower)) {
      if (this.currentTask && this.currentTask !== 'Idle / Attentive') {
        return {
          isAmbiguous: false,
          rawReference: 'continue it',
          resolvedEntity: this.currentTask,
          confidence: 0.92,
          possibleOptions: [this.currentTask],
          clarificationNeeded: false,
        };
      } else if (this.currentTopic && this.currentTopic !== 'General Conversation') {
        return {
          isAmbiguous: false,
          rawReference: 'continue it',
          resolvedEntity: this.currentTopic,
          confidence: 0.88,
          possibleOptions: [this.currentTopic],
          clarificationNeeded: false,
        };
      }
    }

    return {
      isAmbiguous: false,
      rawReference: lower,
      resolvedEntity: this.currentTopic,
      confidence: 0.8,
      possibleOptions: [this.currentTopic],
      clarificationNeeded: false,
    };
  }

  /**
   * Returns a complete snapshot of current context
   */
  public getSnapshot(): ContextSnapshot {
    this.cleanExpiredCache();
    const timeContext = this.getTimeContext();
    const relevantMemories = this.memoryService.getAllMemories(true).slice(0, 10);
    const lastTurn = this.currentUserRequest || '';
    const ambiguity = this.resolveAmbiguity(lastTurn);

    return {
      currentTopic: this.currentTopic,
      currentTask: this.currentTask,
      currentUserRequest: this.currentUserRequest,
      currentRevaState: this.currentRevaState,
      recentImportantStatements: [...this.recentImportantStatements],
      activeApplication: this.activeApplication,
      userState: this.userState,
      timeContext,
      relevantMemoryIds: relevantMemories.map((m) => m.id),
      relevantMemoryCount: relevantMemories.length,
      lastContextEvent: this.lastContextEvent,
      ambiguityCandidate: ambiguity.clarificationNeeded ? ambiguity : null,
      contextAwarenessEnabled: this.settings.contextAwarenessEnabled,
      timestamp: Date.now(),
    };
  }

  /**
   * Returns developer diagnostics data
   */
  public getDiagnostics(): ContextDiagnostics {
    this.cleanExpiredCache();
    const timeContext = this.getTimeContext();
    const memories = this.memoryService.getAllMemories(true).slice(0, 20);

    return {
      currentTopic: this.currentTopic,
      currentTask: this.currentTask,
      activeApplication: this.activeApplication,
      userState: this.userState,
      relevantMemoryCount: memories.length,
      lastContextEvent: this.lastContextEvent ? `${this.lastContextEvent.type}: ${this.lastContextEvent.summary}` : null,
      contextAwarenessEnabled: this.settings.contextAwarenessEnabled,
      timeOfDay: timeContext.localTimeFormatted,
      periodOfDay: timeContext.periodOfDay,
      lastUpdated: new Date(this.lastUpdated).toLocaleTimeString(),
    };
  }

  /**
   * Generates the dynamic unified context prompt for Gemini Live.
   * Enforces:
   * - Time awareness (morning, evening, late night) without quoting the clock unnecessarily.
   * - Working memory & project continuity.
   * - Ambiguity handling (ask clarification when multiple options exist).
   * - Contextual tool guidance.
   * - Strict priority hierarchy.
   */
  public getUnifiedContextPrompt(): string {
    if (!this.settings.contextAwarenessEnabled) {
      return `\nCONTEXT AWARENESS: PRIVACY MODE (OFF)
- Additional system context and activity monitoring are disabled.
- Rely purely on explicit conversation turns and user memory requests.\n`;
    }

    this.cleanExpiredCache();
    const time = this.getTimeContext();
    const workingState = this.workingMemory.getState();
    const situation = this.workingMemory.getOngoingSituation();
    const commStyle = this.workingMemory.getCommunicationStyle();

    const lines: string[] = [];
    lines.push('SMART CONTEXT AWARENESS (ACTIVE):');

    // 1. Time Context
    lines.push(
      `- Time Context: ${time.localTimeFormatted} (${time.periodOfDay.toLowerCase()}, ${time.weekday}). ${
        time.isLateNight ? 'Note: Late night session. Keep responses calming and supportive.' : ''
      } (Rule: Do NOT quote or mention the clock time unnecessarily).`
    );

    // 2. Current Conversation & Task Context
    lines.push(`- Current Topic: ${this.currentTopic}`);
    if (this.currentTask && this.currentTask !== 'Idle / Attentive') {
      lines.push(`- Active Task / Goal: ${this.currentTask}`);
    }
    if (situation) {
      lines.push(`- Ongoing Situation: ${situation}`);
    }
    if (commStyle) {
      lines.push(`- User Brevity Preference: ${commStyle}`);
    }

    // 3. System & Application Context
    if (this.activeApplication) {
      lines.push(
        `- Active Workspace Application: ${this.activeApplication} (User references like "the editor" or "the project" likely refer to this workspace).`
      );
    }

    // 4. Conversational User State
    lines.push(
      `- Estimated User State: ${this.userState} (Use this to naturally shape response tone and empathy; never assert or lecture the user about their emotions).`
    );

    // 5. Recent Activity / Context Events
    if (this.lastContextEvent) {
      lines.push(`- Recent System Event: ${this.lastContextEvent.summary}`);
    }

    // 6. Context Priority Hierarchy & Ambiguity Resolution Directives
    lines.push(`- CONTEXT PRIORITY RULES:
   1. Current user message (Highest)
   2. Current conversation turns
   3. Current active task (${this.currentTask})
   4. Recent context events
   5. Relevant persistent memory records
   6. Older background memories
   * Rule: Immediate statement ALWAYS overrides outdated or historical memories.`);

    lines.push(`- AMBIGUITY RESOLUTION DIRECTIVE:
   * When the user uses pronouns or references like "that", "this", "the project", "the interface", "the problem", or "continue it", resolve them using the active topic (${this.currentTopic}) and task (${this.currentTask}).
   * If there are multiple genuinely conflicting or equally probable meanings, do NOT guess. Ask a polite, crisp clarification question (e.g. "You mean the REVA interface or the memory system?").`);

    lines.push(`- CONTEXTUAL TOOL SELECTION:
   * "Open Chrome/VS Code/Terminal" -> call 'open_application' with exact appName.
   * "What's using my RAM?" / "CPU usage" -> call 'get_system_status'.
   * "Search my Documents for REVA" -> call 'search_files'.
   * "Set a timer for 20 minutes" -> call 'set_timer'.
   * "Save note" / "Create note" -> call 'create_note'.`);

    return `\n${lines.join('\n')}\n`;
  }
}
