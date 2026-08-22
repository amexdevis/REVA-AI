/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  PendingAction,
  PendingActionType,
  ToolExecutionResult,
} from '../types/tools.types.js';

export class ConfirmationService {
  private static instance: ConfirmationService | null = null;

  // Active pending confirmation queue (keyed by confirmation ID)
  private pendingActions: Map<string, PendingAction> = new Map();

  // Most recent pending action ID for rapid conversational confirmation ("Yes", "Sure", "Replace it")
  private latestPendingId: string | null = null;

  // Timeout in milliseconds (60 seconds)
  private readonly CONFIRMATION_TIMEOUT_MS = 60000;

  private constructor() {}

  public static getInstance(): ConfirmationService {
    if (!ConfirmationService.instance) {
      ConfirmationService.instance = new ConfirmationService();
    }
    return ConfirmationService.instance;
  }

  /**
   * Register a sensitive or overwrite action requiring explicit user confirmation.
   */
  public createPendingConfirmation(params: {
    type: PendingActionType;
    summary: string;
    promptQuestion: string;
    details: Record<string, any>;
    executor: () => Promise<ToolExecutionResult>;
  }): { confirmationId: string; promptQuestion: string; summary: string } {
    const id = `conf_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();

    const pendingAction: PendingAction = {
      id,
      type: params.type,
      summary: params.summary,
      promptQuestion: params.promptQuestion,
      details: params.details,
      createdAt: now,
      expiresAt: now + this.CONFIRMATION_TIMEOUT_MS,
      executor: params.executor,
    };

    this.pendingActions.set(id, pendingAction);
    this.latestPendingId = id;

    // Auto-cleanup on timeout
    setTimeout(() => {
      if (this.pendingActions.has(id)) {
        this.pendingActions.delete(id);
        if (this.latestPendingId === id) {
          this.latestPendingId = null;
        }
      }
    }, this.CONFIRMATION_TIMEOUT_MS);

    return {
      confirmationId: id,
      promptQuestion: params.promptQuestion,
      summary: params.summary,
    };
  }

  /**
   * Check if there is currently a pending confirmation waiting for user response.
   */
  public hasPendingAction(): boolean {
    this.purgeExpired();
    return this.pendingActions.size > 0 && this.latestPendingId !== null;
  }

  /**
   * Get the current pending action.
   */
  public getLatestPendingAction(): PendingAction | null {
    this.purgeExpired();
    if (!this.latestPendingId) return null;
    return this.pendingActions.get(this.latestPendingId) || null;
  }

  /**
   * Handle user confirmation response (e.g. "yes", "replace it", "sure", "proceed", "no", "cancel").
   */
  public async handleConfirmationResponse(
    responsePhrase: string,
    specificId?: string
  ): Promise<{
    handled: boolean;
    confirmed: boolean;
    result?: ToolExecutionResult;
    message: string;
  }> {
    this.purgeExpired();

    const targetId = specificId || this.latestPendingId;
    if (!targetId || !this.pendingActions.has(targetId)) {
      return {
        handled: false,
        confirmed: false,
        message: 'There are no pending actions waiting for confirmation.',
      };
    }

    const pending = this.pendingActions.get(targetId)!;
    const clean = (responsePhrase || '').toLowerCase().trim();

    // Check affirmative phrases
    const isAffirmative =
      /\b(yes|yeah|yep|yup|sure|proceed|replace|replace it|do it|confirm|overwrite|haan|kar do|theek hai|go ahead|ok|okay)\b/i.test(
        clean
      );

    // Check negative phrases
    const isNegative =
      /\b(no|nope|cancel|stop|don't|dont|nah|nevermind|nahi|mat karo|leave it|abort)\b/i.test(
        clean
      );

    if (isAffirmative) {
      this.pendingActions.delete(targetId);
      if (this.latestPendingId === targetId) {
        this.latestPendingId = null;
      }

      try {
        const executionResult = await pending.executor();
        return {
          handled: true,
          confirmed: true,
          result: executionResult,
          message: `Confirmed and executed: ${pending.summary}.`,
        };
      } catch (err: any) {
        return {
          handled: true,
          confirmed: true,
          result: {
            success: false,
            tool: pending.type,
            error: err.message || 'Execution failed after confirmation.',
            executionTimeMs: 0,
            timestamp: new Date().toISOString(),
            permissionLevel: 'REVERSIBLE',
          },
          message: `Action failed after confirmation: ${err.message}`,
        };
      }
    } else if (isNegative) {
      this.pendingActions.delete(targetId);
      if (this.latestPendingId === targetId) {
        this.latestPendingId = null;
      }

      return {
        handled: true,
        confirmed: false,
        message: `Cancelled action: ${pending.summary}.`,
      };
    }

    return {
      handled: false,
      confirmed: false,
      message: `Pending confirmation for: "${pending.promptQuestion}". Please say "yes" to proceed or "cancel" to abort.`,
    };
  }

  /**
   * Cancel all or specific pending actions.
   */
  public cancelPending(id?: string): void {
    if (id) {
      this.pendingActions.delete(id);
      if (this.latestPendingId === id) {
        this.latestPendingId = null;
      }
    } else {
      this.pendingActions.clear();
      this.latestPendingId = null;
    }
  }

  /**
   * Purge expired actions.
   */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, item] of this.pendingActions.entries()) {
      if (now > item.expiresAt) {
        this.pendingActions.delete(id);
        if (this.latestPendingId === id) {
          this.latestPendingId = null;
        }
      }
    }
  }
}
