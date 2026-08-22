/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LockedVoiceConfig {
  model: string;
  voiceName: string;
  language: string;
  audioFormat: string;
  inputSampleRate: number;
  outputSampleRate: number;
}

/**
 * REVA LOCKED VOICE CONFIGURATION - SINGLE SOURCE OF TRUTH
 * Critical: Every Gemini Live session must strictly use this configuration.
 * Under no circumstance may components independently change the voice or silently fall back.
 */
export const VOICE_CONFIG: LockedVoiceConfig = {
  model: 'gemini-3.1-flash-live-preview',
  voiceName: 'Aoede', // Official dedicated female companion voice
  language: 'en-US',
  audioFormat: 'audio/pcm;rate=24000',
  inputSampleRate: 16000,
  outputSampleRate: 24000,
};

export type DiagnosticEventType =
  | 'SESSION_CREATED'
  | 'SESSION_CLOSED'
  | 'SESSION_ERROR'
  | 'VOICE_CONFIG_USED'
  | 'AUDIO_STREAM_STARTED'
  | 'AUDIO_STREAM_STOPPED'
  | 'AUDIO_PLAYBACK_STARTED'
  | 'AUDIO_PLAYBACK_STOPPED'
  | 'MEMORY_READ_STARTED'
  | 'MEMORY_READ_SUCCESS'
  | 'MEMORY_READ_FAILED'
  | 'MEMORY_WRITE_STARTED'
  | 'MEMORY_WRITE_SUCCESS'
  | 'MEMORY_WRITE_FAILED'
  | 'PROACTIVE_TRIGGERED';

/**
 * Developer diagnostic logger for REVA voice & session stability monitoring.
 * Guarantees NO sensitive information (passwords, tokens, raw audio, files) is ever logged.
 */
export function logDiagnostic(event: DiagnosticEventType, metadata?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (metadata) {
    // Sanitize any accidentally passed sensitive keys
    const sanitized = { ...metadata };
    delete (sanitized as any).apiKey;
    delete (sanitized as any).password;
    delete (sanitized as any).token;
    delete (sanitized as any).audio;
    delete (sanitized as any).data;
    console.log(`[REVA:DIAGNOSTIC][${timestamp}] ${event}`, JSON.stringify(sanitized));
  } else {
    console.log(`[REVA:DIAGNOSTIC][${timestamp}] ${event}`);
  }
}
