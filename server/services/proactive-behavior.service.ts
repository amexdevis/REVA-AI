/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProactiveEvent,
  ProactiveEventType,
  ProactiveDecision,
  ProactiveSettings,
  ProactiveDiagnosticsData,
  ProactiveConversationType,
  VoiceSessionState,
} from '../types/voice.types.js';
import { MemoryService } from './memory.service.js';
import { GeminiService } from './gemini.service.js';
import { ContextAwarenessService } from './context-awareness.service.js';
import { TimeService } from './time.service.js';

export class ProactiveBehaviorService {
  private static instance: ProactiveBehaviorService | null = null;

  private settings: ProactiveSettings = {
    proactiveMode: true,
    quietMode: false,
    activityAwareness: true,
    applicationAwareness: true,
    longSessionAwareness: true,
    idleThresholdSeconds: 300, // 5 minutes default
    longSessionThresholdMinutes: 120, // 2 hours default
    minimumProactiveIntervalSeconds: 600, // 10 minutes default cooldown
    importanceThreshold: 0.5,
  };

  private eventQueue: ProactiveEvent[] = [];
  private maxQueueSize = 50;
  private decisionHistory: ProactiveDecision[] = [];
  private maxHistorySize = 30;

  private lastProactiveSpeechTimestamp = 0;
  private lastUserSpeechTimestamp = 0;
  private lastRevaSpeechTimestamp = 0;
  private lastEventDeduplicationKey = '';
  private lastEventDeduplicationTimestamp = 0;

  private currentWorkspaceApp = 'VS Code';
  private sessionActiveMinutes = 0;
  private idleSeconds = 0;
  private sessionStartTime = Date.now();

  private memoryService: MemoryService;

  private constructor() {
    this.memoryService = MemoryService.getInstance();
    this.initDatabaseSettings();
  }

  public static getInstance(): ProactiveBehaviorService {
    if (!ProactiveBehaviorService.instance) {
      ProactiveBehaviorService.instance = new ProactiveBehaviorService();
    }
    return ProactiveBehaviorService.instance;
  }

  private initDatabaseSettings(): void {
    try {
      const db = this.memoryService.getDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS proactive_settings (
          id TEXT PRIMARY KEY,
          settings_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const row = db.prepare('SELECT settings_json FROM proactive_settings WHERE id = ?').get('global') as any;
      if (row && row.settings_json) {
        const loaded = JSON.parse(row.settings_json);
        this.settings = { ...this.settings, ...loaded };
        console.log('[REVA][PROACTIVE] Loaded persistent proactive settings from SQLite');
      }
    } catch (err) {
      console.warn('[REVA][PROACTIVE] Could not load stored proactive settings, using defaults:', err);
    }
  }

  public saveSettingsToDb(): void {
    try {
      const db = this.memoryService.getDb();
      const stmt = db.prepare(`
        INSERT INTO proactive_settings (id, settings_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_at = excluded.updated_at;
      `);
      stmt.run('global', JSON.stringify(this.settings), new Date().toISOString());
    } catch (err) {
      console.error('[REVA][PROACTIVE] Error saving proactive settings to SQLite:', err);
    }
  }

  public getSettings(): ProactiveSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ProactiveSettings>): ProactiveSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveSettingsToDb();
    return this.getSettings();
  }

  public markUserSpeaking(): void {
    this.lastUserSpeechTimestamp = Date.now();
  }

  public markRevaSpeaking(): void {
    this.lastRevaSpeechTimestamp = Date.now();
  }

  public updateActivityMetrics(metrics: {
    idleSeconds?: number;
    sessionActiveMinutes?: number;
    currentWorkspaceApp?: string;
  }): void {
    if (typeof metrics.idleSeconds === 'number') {
      this.idleSeconds = metrics.idleSeconds;
    }
    if (typeof metrics.sessionActiveMinutes === 'number') {
      this.sessionActiveMinutes = metrics.sessionActiveMinutes;
    }
    if (metrics.currentWorkspaceApp) {
      this.currentWorkspaceApp = metrics.currentWorkspaceApp;
    }
  }

  public getCurrentWorkspaceApp(): string {
    return this.currentWorkspaceApp;
  }

  public getDiagnostics(): ProactiveDiagnosticsData {
    const cooldownRemainingMs = Math.max(
      0,
      this.lastProactiveSpeechTimestamp + this.settings.minimumProactiveIntervalSeconds * 1000 - Date.now()
    );

    return {
      settings: this.getSettings(),
      lastEvent: this.eventQueue[this.eventQueue.length - 1] || null,
      lastDecision: this.decisionHistory[this.decisionHistory.length - 1] || null,
      decisionHistory: [...this.decisionHistory].reverse().slice(0, 10),
      recentEvents: [...this.eventQueue].reverse().slice(0, 10),
      cooldownRemainingSeconds: Math.ceil(cooldownRemainingMs / 1000),
      currentWorkspaceApp: this.currentWorkspaceApp,
      sessionActiveMinutes: Math.round((Date.now() - this.sessionStartTime) / 60000),
      idleSeconds: this.idleSeconds,
    };
  }

  /**
   * Evaluates an incoming event and returns a proactive decision.
   */
  public async evaluateEvent(
    eventType: ProactiveEventType,
    context: Record<string, any> = {},
    currentVoiceState: VoiceSessionState = 'READY'
  ): Promise<ProactiveDecision> {
    const now = Date.now();

    // 1. Deduplication check (same event + context within 8 seconds)
    const dedupKey = `${eventType}:${JSON.stringify(context)}`;
    if (this.lastEventDeduplicationKey === dedupKey && now - this.lastEventDeduplicationTimestamp < 8000) {
      const decision: ProactiveDecision = {
        id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        decision: 'REMAIN_SILENT',
        reason: 'Duplicate event received within deduplication window',
        importanceScore: 0,
        cooldownRemainingMs: 0,
        timestamp: new Date().toISOString(),
      };
      this.recordDecision(decision);
      return decision;
    }
    this.lastEventDeduplicationKey = dedupKey;
    this.lastEventDeduplicationTimestamp = now;

    // 2. Score event importance
    const importance = this.calculateImportance(eventType, context);

    const eventRecord: ProactiveEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: eventType,
      importance,
      timestamp: new Date().toISOString(),
      context,
      processed: true,
    };
    this.pushEvent(eventRecord);

    // Register event in ContextAwarenessService for unified state tracking
    ContextAwarenessService.getInstance().recordContextEvent(eventType, `Proactive event received: ${eventType}`, context);

    // 3. Check Master Proactive Mode
    if (!this.settings.proactiveMode) {
      return this.silentDecision('Proactive Mode is disabled in settings', importance, eventRecord);
    }

    // 3.1 Check Context Awareness Global Privacy Toggle
    if (!ContextAwarenessService.getInstance().isContextAwarenessEnabled()) {
      return this.silentDecision('Context Awareness is disabled (Privacy Mode)', importance, eventRecord);
    }

    // 4. Check Quiet Mode
    if (this.settings.quietMode) {
      return this.silentDecision('Quiet Mode is active — REVA remains silent', importance, eventRecord);
    }

    // 5. Check Feature-Specific Awareness Toggles
    if (
      (eventType === 'USER_IDLE' || eventType === 'USER_RETURNED') &&
      !this.settings.activityAwareness
    ) {
      return this.silentDecision('Activity awareness is disabled in settings', importance, eventRecord);
    }

    if (eventType === 'LONG_WORK_SESSION' && !this.settings.longSessionAwareness) {
      return this.silentDecision('Long session awareness is disabled in settings', importance, eventRecord);
    }

    if (
      (eventType === 'APPLICATION_CHANGED' || eventType === 'TAB_CONTEXT_CHANGED') &&
      !this.settings.applicationAwareness
    ) {
      return this.silentDecision('Application awareness is disabled in settings', importance, eventRecord);
    }

    // 6. Check Active Conversation State
    if (currentVoiceState === 'USER_SPEAKING' || now - this.lastUserSpeechTimestamp < 4000) {
      return this.silentDecision('User is actively speaking or recently spoke', importance, eventRecord);
    }

    if (currentVoiceState === 'REVA_SPEAKING') {
      return this.silentDecision('REVA is already speaking', importance, eventRecord);
    }

    if (now - this.lastRevaSpeechTimestamp < 12000) {
      return this.silentDecision('Recent voice exchange in progress', importance, eventRecord);
    }

    // 7. Check Cooldown
    const cooldownMs = this.settings.minimumProactiveIntervalSeconds * 1000;
    const timeSinceLastProactive = now - this.lastProactiveSpeechTimestamp;
    const cooldownRemainingMs = Math.max(0, cooldownMs - timeSinceLastProactive);

    if (cooldownRemainingMs > 0 && importance < 0.95) {
      const minsLeft = Math.ceil(cooldownRemainingMs / 60000);
      return this.silentDecision(`Proactive cooldown active (~${minsLeft}m remaining)`, importance, eventRecord, cooldownRemainingMs);
    }

    // 8. Check Importance Threshold
    if (importance < this.settings.importanceThreshold) {
      return this.silentDecision(
        `Importance (${importance.toFixed(2)}) is below threshold (${this.settings.importanceThreshold.toFixed(2)})`,
        importance,
        eventRecord,
        cooldownRemainingMs
      );
    }

    // 9. All conditions met: Generate natural conversational speech!
    const conversationType = this.determineConversationType(eventType, context);
    const speechText = await this.generateProactiveSpeech(eventType, context, conversationType);

    this.lastProactiveSpeechTimestamp = Date.now();

    const decision: ProactiveDecision = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      decision: 'SPEAK',
      reason: `Eligible event: ${eventType} (importance ${importance.toFixed(2)})`,
      importanceScore: importance,
      cooldownRemainingMs: 0,
      timestamp: new Date().toISOString(),
      conversationType,
      event: eventRecord,
      speechText,
    };

    this.recordDecision(decision);
    console.log(`[REVA][PROACTIVE] Decision to SPEAK: "${speechText}" (Type: ${conversationType})`);
    return decision;
  }

  private calculateImportance(type: ProactiveEventType, context: Record<string, any>): number {
    switch (type) {
      case 'TASK_COMPLETED':
        return 0.85;
      case 'TIMER_COMPLETED':
        return 0.80;
      case 'LONG_WORK_SESSION':
        return 0.75;
      case 'USER_RETURNED':
        return context.awayMinutes && context.awayMinutes > 15 ? 0.70 : 0.60;
      case 'APPLICATION_CHANGED': {
        const app = (context.current || context.application || '').toLowerCase();
        // Check if application matches user's active memories/projects
        const memories = this.memoryService.getAllMemories(true).filter((m) => m.content.toLowerCase().includes(app));
        if (memories.length > 0) {
          return 0.68;
        }
        return 0.45;
      }
      case 'TIME_CONTEXT':
        return 0.55;
      case 'SYSTEM_EVENT':
        return 0.50;
      case 'USER_IDLE':
        return 0.35;
      case 'TAB_CONTEXT_CHANGED':
        return 0.35;
      case 'CONVERSATION_PAUSED':
        return 0.30;
      default:
        return 0.40;
    }
  }

  private determineConversationType(
    type: ProactiveEventType,
    context: Record<string, any>
  ): ProactiveConversationType {
    switch (type) {
      case 'TASK_COMPLETED':
        return 'CELEBRATION';
      case 'LONG_WORK_SESSION':
        return 'CHECK_IN';
      case 'USER_RETURNED':
        return 'OBSERVATION';
      case 'APPLICATION_CHANGED':
        return 'CONTEXTUAL_COMMENT';
      case 'TIMER_COMPLETED':
        return 'REMINDER';
      case 'TIME_CONTEXT':
        return 'OBSERVATION';
      default:
        return 'CHECK_IN';
    }
  }

  /**
   * Generates a spontaneous, short, natural proactive utterance.
   * Leverages REVA's persistent memory and actual local context.
   */
  private async generateProactiveSpeech(
    type: ProactiveEventType,
    context: Record<string, any>,
    convoType: ProactiveConversationType
  ): Promise<string> {
    const currentApp = context.current || context.application || this.currentWorkspaceApp;
    const relevantMemories = await this.memoryService.getRelevantMemories(`${type} ${currentApp}`, 2);
    const memoryContext = relevantMemories.map((m) => m.content).join('; ');

    // Dynamic period of day derived strictly from user's detected timezone
    const timeService = TimeService.getInstance();
    const period = timeService.getPeriodOfDay();
    const timeOfDay = period === 'MORNING' ? 'morning' : period === 'AFTERNOON' ? 'afternoon' : period === 'EVENING' ? 'evening' : 'night';

    switch (type) {
      case 'USER_RETURNED':
        if (timeOfDay === 'night') return "Welcome back. Still going strong tonight?";
        return "Hey, you're back.";

      case 'APPLICATION_CHANGED': {
        if (currentApp.toLowerCase().includes('vs code') || currentApp.toLowerCase().includes('code')) {
          if (memoryContext.toLowerCase().includes('reva')) {
            return "Back to coding REVA?";
          }
          return "Back in VS Code?";
        }
        if (currentApp.toLowerCase().includes('figma')) {
          return "Working on designs?";
        }
        if (currentApp.toLowerCase().includes('terminal')) {
          return "Running some commands?";
        }
        return `Switched to ${currentApp}?`;
      }

      case 'LONG_WORK_SESSION': {
        const hours = context.hours || 2;
        if (hours >= 2) return "You've been at that for a while.";
        return "Deep in focus mode today.";
      }

      case 'TASK_COMPLETED':
        return "Nice. You got that finished.";

      case 'TIMER_COMPLETED':
        return "Time's up for that session.";

      case 'TIME_CONTEXT':
        if (timeOfDay === 'night') return "Burning the midnight oil?";
        if (timeOfDay === 'morning') return "Morning. Ready to dive in?";
        return "Good afternoon.";

      default:
        return "Hey there.";
    }
  }

  /**
   * Parses natural spoken requests to toggle proactive or quiet modes.
   */
  public handleNaturalVoiceCommand(text: string): { handled: boolean; message?: string } {
    const lower = text.toLowerCase().trim();

    // Quiet mode commands
    if (
      lower.includes('be quiet') ||
      lower.includes('quiet mode') ||
      lower.includes("don't interrupt") ||
      lower.includes("dont interrupt") ||
      lower.includes("don't talk unless i talk") ||
      lower.includes("need some silence") ||
      lower.includes("shh")
    ) {
      this.updateSettings({ quietMode: true });
      return { handled: true, message: 'Quiet mode enabled. REVA will not initiate proactive conversations.' };
    }

    if (
      lower.includes('disable quiet mode') ||
      lower.includes('turn off quiet mode') ||
      lower.includes('exit quiet mode')
    ) {
      this.updateSettings({ quietMode: false });
      return { handled: true, message: 'Quiet mode disabled.' };
    }

    // Proactive mode commands
    if (
      lower.includes('turn off proactive') ||
      lower.includes('disable proactive') ||
      lower.includes('stop proactive')
    ) {
      this.updateSettings({ proactiveMode: false });
      return { handled: true, message: 'Proactive mode turned off.' };
    }

    if (
      lower.includes('turn on proactive') ||
      lower.includes('enable proactive') ||
      lower.includes('start proactive')
    ) {
      this.updateSettings({ proactiveMode: true });
      return { handled: true, message: 'Proactive mode turned on.' };
    }

    return { handled: false };
  }

  private silentDecision(
    reason: string,
    importance: number,
    event?: ProactiveEvent,
    cooldownRemainingMs = 0
  ): ProactiveDecision {
    const decision: ProactiveDecision = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      decision: 'REMAIN_SILENT',
      reason,
      importanceScore: importance,
      cooldownRemainingMs,
      timestamp: new Date().toISOString(),
      event,
    };
    this.recordDecision(decision);
    return decision;
  }

  private pushEvent(event: ProactiveEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }
  }

  private recordDecision(decision: ProactiveDecision): void {
    this.decisionHistory.push(decision);
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.shift();
    }
  }
}
