/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkingMemoryState } from '../types/voice.types.js';

export interface WorkingMemoryStateExtended extends WorkingMemoryState {
  ongoingSituation?: string;
  communicationStyle?: 'CONCISE' | 'BALANCED' | 'DETAILED';
  suppressedTopics?: string[];
}

/**
 * WorkingMemoryService maintains active short-term conversational context.
 * Working memory naturally expires over time and does not persist forever.
 */
export class WorkingMemoryService {
  private static instance: WorkingMemoryService | null = null;
  private state: WorkingMemoryState;
  private ongoingSituation: string | null = null;
  private communicationStyle: 'CONCISE' | 'BALANCED' | 'DETAILED' = 'BALANCED';
  private suppressedTopics: Set<string> = new Set();
  private ttlMs = 15 * 60 * 1000; // 15 minutes TTL

  private constructor() {
    this.state = {
      currentTopic: 'General Conversation',
      currentTask: 'Idle / Attentive',
      recentContext: [],
      recentPreferences: [],
      conversationState: 'ACTIVE',
      lastUpdated: Date.now(),
    };
  }

  public static getInstance(): WorkingMemoryService {
    if (!WorkingMemoryService.instance) {
      WorkingMemoryService.instance = new WorkingMemoryService();
    }
    return WorkingMemoryService.instance;
  }

  public getState(): WorkingMemoryState {
    this.cleanExpired();
    return { ...this.state };
  }

  public getOngoingSituation(): string | null {
    this.cleanExpired();
    return this.ongoingSituation;
  }

  public setOngoingSituation(situation: string | null): void {
    this.ongoingSituation = situation ? situation.trim() : null;
    this.state.lastUpdated = Date.now();
  }

  public getCommunicationStyle(): 'CONCISE' | 'BALANCED' | 'DETAILED' {
    return this.communicationStyle;
  }

  public setCommunicationStyle(style: 'CONCISE' | 'BALANCED' | 'DETAILED'): void {
    this.communicationStyle = style;
    this.state.lastUpdated = Date.now();
  }

  public suppressTopic(topic: string): void {
    if (!topic || !topic.trim()) return;
    const clean = topic.trim().toLowerCase();
    this.suppressedTopics.add(clean);
    if (this.state.currentTopic.toLowerCase().includes(clean)) {
      this.state.currentTopic = 'Fresh Topic';
      this.ongoingSituation = null;
    }
    this.state.lastUpdated = Date.now();
  }

  public isTopicSuppressed(topic: string): boolean {
    if (!topic) return false;
    const lower = topic.toLowerCase();
    for (const suppressed of this.suppressedTopics) {
      if (lower.includes(suppressed) || suppressed.includes(lower)) {
        return true;
      }
    }
    return false;
  }

  public addTurn(role: 'user' | 'reva', text: string): void {
    if (!text || !text.trim()) return;
    this.cleanExpired();
    this.state.recentContext.push({
      role,
      text: text.trim(),
      timestamp: Date.now(),
    });

    // Keep max 10 recent context turns in working memory
    if (this.state.recentContext.length > 10) {
      this.state.recentContext.shift();
    }

    this.state.lastUpdated = Date.now();
    if (role === 'user') {
      this.inferTopicAndTask(text);
      this.inferCommunicationPreference(text);
    }
  }

  public setTopic(topic: string): void {
    if (!topic || !topic.trim()) return;
    this.state.currentTopic = topic.trim();
    this.state.lastUpdated = Date.now();
  }

  public setTask(task: string): void {
    if (!task || !task.trim()) return;
    this.state.currentTask = task.trim();
    this.state.lastUpdated = Date.now();
  }

  public addRecentPreference(pref: string): void {
    if (!pref || !pref.trim()) return;
    const trimmed = pref.trim();
    if (!this.state.recentPreferences.includes(trimmed)) {
      this.state.recentPreferences.push(trimmed);
      if (this.state.recentPreferences.length > 5) {
        this.state.recentPreferences.shift();
      }
    }
    this.state.lastUpdated = Date.now();
  }

  public setConversationState(convState: string): void {
    this.state.conversationState = convState;
    this.state.lastUpdated = Date.now();
  }

  public clear(): void {
    this.state = {
      currentTopic: 'General Conversation',
      currentTask: 'Idle / Attentive',
      recentContext: [],
      recentPreferences: [],
      conversationState: 'IDLE',
      lastUpdated: Date.now(),
    };
    this.ongoingSituation = null;
    this.suppressedTopics.clear();
  }

  private cleanExpired(): void {
    const now = Date.now();
    // If no interaction for TTL duration, reset context
    if (now - this.state.lastUpdated > this.ttlMs) {
      this.state.recentContext = [];
      this.state.recentPreferences = [];
      this.state.currentTopic = 'Fresh Session';
      this.state.currentTask = 'Idle / Attentive';
      this.ongoingSituation = null;
      this.state.lastUpdated = now;
    }
  }

  private inferCommunicationPreference(text: string): void {
    const lower = text.toLowerCase();
    if (/\b(keep it brief|be concise|short answers|briefly|quick summary|tldr)\b/.test(lower)) {
      this.communicationStyle = 'CONCISE';
    } else if (/\b(explain in detail|detailed explanation|elaborate|deep dive|step by step)\b/.test(lower)) {
      this.communicationStyle = 'DETAILED';
    }
  }

  private inferTopicAndTask(text: string): void {
    const lower = text.toLowerCase();
    if (lower.includes('project') || lower.includes('build') || lower.includes('code') || lower.includes('reva')) {
      if (lower.includes('reva')) {
        this.state.currentTopic = 'REVA Development';
        this.ongoingSituation = 'User is working on REVA companion application';
      } else if (lower.includes('code') || lower.includes('debug')) {
        this.state.currentTopic = 'Software Engineering';
        this.ongoingSituation = 'User is writing or debugging software';
      }
    } else if (lower.includes('ui') || lower.includes('theme') || lower.includes('color') || lower.includes('design') || lower.includes('interface')) {
      this.state.currentTopic = 'UI & Interface Design';
      this.ongoingSituation = 'User is designing and refining the user interface';
    } else if (lower.includes('voice') || lower.includes('audio') || lower.includes('speak') || lower.includes('microphone')) {
      this.state.currentTopic = 'Voice & Audio System';
      this.ongoingSituation = 'User is working on voice and audio functionality';
    } else if (lower.includes('stuck') || lower.includes('error') || lower.includes('issue') || lower.includes('bug')) {
      if (this.state.currentTopic && this.state.currentTopic !== 'General Conversation') {
        this.ongoingSituation = `User is stuck / troubleshooting in ${this.state.currentTopic}`;
      }
    }
  }

  public getSummaryForPrompt(): string {
    this.cleanExpired();
    if (this.state.recentContext.length === 0 && this.state.recentPreferences.length === 0 && !this.ongoingSituation) {
      return '';
    }

    const lines: string[] = [];
    lines.push(`- Current Topic: ${this.state.currentTopic}`);
    if (this.ongoingSituation) {
      lines.push(`- Ongoing Situation: ${this.ongoingSituation}`);
    }
    if (this.communicationStyle) {
      lines.push(`- Communication Style: ${this.communicationStyle} (match user brevity naturally)`);
    }
    if (this.state.currentTask && this.state.currentTask !== 'Idle / Attentive') {
      lines.push(`- Current Task: ${this.state.currentTask}`);
    }
    if (this.state.recentPreferences.length > 0) {
      lines.push(`- Active Preferences in Session: ${this.state.recentPreferences.join(', ')}`);
    }
    if (this.suppressedTopics.size > 0) {
      lines.push(`- Forbidden/Suppressed Topics (do not bring up): ${Array.from(this.suppressedTopics).join(', ')}`);
    }

    return `\nWORKING MEMORY & CONVERSATION CONTINUITY:\n${lines.join('\n')}\n`;
  }
}
