/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkingMemoryState } from '../types/voice.types.js';

/**
 * WorkingMemoryService maintains active short-term conversational context.
 * Working memory naturally expires over time and does not persist forever.
 */
export class WorkingMemoryService {
  private static instance: WorkingMemoryService | null = null;
  private state: WorkingMemoryState;
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
    this.inferTopicAndTask(text);
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
  }

  private cleanExpired(): void {
    const now = Date.now();
    // If no interaction for TTL duration, reset context
    if (now - this.state.lastUpdated > this.ttlMs) {
      this.state.recentContext = [];
      this.state.recentPreferences = [];
      this.state.currentTopic = 'Fresh Session';
      this.state.currentTask = 'Idle / Attentive';
      this.state.lastUpdated = now;
    }
  }

  private inferTopicAndTask(text: string): void {
    const lower = text.toLowerCase();
    if (lower.includes('project') || lower.includes('build') || lower.includes('code') || lower.includes('reva')) {
      if (lower.includes('reva')) this.state.currentTopic = 'REVA Development';
      else if (lower.includes('code') || lower.includes('debug')) this.state.currentTopic = 'Software Engineering';
    } else if (lower.includes('ui') || lower.includes('theme') || lower.includes('color') || lower.includes('design')) {
      this.state.currentTopic = 'UI & Interface Design';
    } else if (lower.includes('voice') || lower.includes('audio') || lower.includes('speak')) {
      this.state.currentTopic = 'Voice & Audio System';
    }
  }

  public getSummaryForPrompt(): string {
    this.cleanExpired();
    if (this.state.recentContext.length === 0 && this.state.recentPreferences.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push(`- Current Topic: ${this.state.currentTopic}`);
    if (this.state.currentTask && this.state.currentTask !== 'Idle / Attentive') {
      lines.push(`- Current Task: ${this.state.currentTask}`);
    }
    if (this.state.recentPreferences.length > 0) {
      lines.push(`- Active Preferences in Session: ${this.state.recentPreferences.join(', ')}`);
    }

    return `\nWORKING MEMORY (Current Live Session):\n${lines.join('\n')}\n`;
  }
}
