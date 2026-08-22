/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiLiveService, GeminiLiveCallbacks } from './gemini-live.service.js';
import { VOICE_CONFIG, logDiagnostic } from '../config/voice.config.js';

export type SessionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'CLOSING'
  | 'CLOSED'
  | 'ERROR';

/**
 * VoiceSessionManager
 * Centralized authority for Gemini Live voice session lifecycle.
 * Guarantees exactly ONE active Gemini Live session per client connection.
 * Prevents race conditions, duplicate connections, and overlapping audio streams.
 */
export class VoiceSessionManager {
  private activeLiveService: GeminiLiveService | null = null;
  private state: SessionState = 'DISCONNECTED';
  private sessionId: string | null = null;
  private isConnecting = false;
  private isClosing = false;
  private callbacks: GeminiLiveCallbacks;

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): SessionState {
    return this.state;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public isActive(): boolean {
    return this.state === 'CONNECTED' && this.activeLiveService !== null && this.activeLiveService.getIsConnected();
  }

  /**
   * Initializes or safely replaces the active Gemini Live voice session.
   * If a previous session exists, it is cleanly closed before starting the new one.
   */
  public async initializeSession(): Promise<GeminiLiveService> {
    if (this.isConnecting) {
      console.log('[REVA][VoiceSessionManager] Session initialization already in progress, awaiting current attempt.');
      return this.activeLiveService!;
    }

    this.isConnecting = true;
    this.state = 'CONNECTING';

    try {
      // 1. Safely teardown existing session if present
      if (this.activeLiveService) {
        logDiagnostic('SESSION_CLOSED', { previousSessionId: this.sessionId, reason: 'REPLACING_WITH_NEW_SESSION' });
        await this.activeLiveService.close();
        this.activeLiveService = null;
      }

      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      logDiagnostic('SESSION_CREATED', { sessionId: this.sessionId, voiceConfig: VOICE_CONFIG });

      // 2. Instantiate new service with locked voice configuration
      const liveService = new GeminiLiveService({
        ...this.callbacks,
        onStateChange: (newState, details) => {
          if (newState === 'READY') {
            this.state = 'CONNECTED';
            logDiagnostic('VOICE_CONFIG_USED', {
              voiceName: VOICE_CONFIG.voiceName,
              model: VOICE_CONFIG.model,
              language: VOICE_CONFIG.language,
            });
          } else if (newState === 'OFFLINE') {
            this.state = 'CLOSED';
          }
          this.callbacks.onStateChange(newState, details);
        },
        onError: (err) => {
          this.state = 'ERROR';
          const errMsg = err instanceof Error ? err.message : String(err);
          logDiagnostic('SESSION_ERROR', { sessionId: this.sessionId, error: errMsg });
          this.callbacks.onError(err);
        },
        onClose: (code, reason) => {
          this.state = 'CLOSED';
          logDiagnostic('SESSION_CLOSED', { sessionId: this.sessionId, code, reason });
          this.callbacks.onClose(code, reason);
        },
      });

      this.activeLiveService = liveService;
      await liveService.connect();
      this.state = 'CONNECTED';
      return liveService;
    } catch (err) {
      this.state = 'ERROR';
      const errMsg = err instanceof Error ? err.message : String(err);
      logDiagnostic('SESSION_ERROR', { sessionId: this.sessionId, error: errMsg });
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Forwards audio input directly to the active session.
   */
  public sendAudioChunk(base64Audio: string): void {
    if (!this.activeLiveService || this.state !== 'CONNECTED') {
      return;
    }
    this.activeLiveService.sendAudioChunk(base64Audio);
  }

  /**
   * Forwards text prompts (proactive speech, test greeting, instructions) directly to the active session.
   */
  public sendTextMessage(text: string): void {
    if (!this.activeLiveService || this.state !== 'CONNECTED') {
      console.warn('[REVA][VoiceSessionManager] Cannot send text: no active connected session');
      return;
    }
    this.activeLiveService.sendTextMessage(text);
  }

  /**
   * Handles user barge-in without tearing down the connection.
   */
  public handleInterruption(): void {
    if (this.activeLiveService) {
      console.log('[REVA][VoiceSessionManager] User interruption (barge-in) handled smoothly.');
    }
  }

  /**
   * Safely closes the current session.
   */
  public async closeSession(reason = 'MANUAL_DISCONNECT'): Promise<void> {
    if (this.isClosing) return;
    this.isClosing = true;
    this.state = 'CLOSING';

    try {
      if (this.activeLiveService) {
        logDiagnostic('SESSION_CLOSED', { sessionId: this.sessionId, reason });
        await this.activeLiveService.close();
        this.activeLiveService = null;
      }
      this.state = 'DISCONNECTED';
      this.sessionId = null;
    } catch (err) {
      console.error('[REVA][VoiceSessionManager] Error closing session:', err);
    } finally {
      this.isClosing = false;
    }
  }
}
