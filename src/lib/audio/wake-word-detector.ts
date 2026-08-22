/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WakeWordStatus } from '../../types/voice.types.js';

export interface WakeWordDetectorOptions {
  onWakeWordDetected: (phrase: string, confidence: number) => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: WakeWordStatus) => void;
}

// Type definitions for Web Speech API
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export class WakeWordDetector {
  private recognition: any = null;
  private isListening = false;
  private isExplicitlyStopped = true;
  private options: WakeWordDetectorOptions;
  private lastTriggerTime = 0;
  private consecutiveErrors = 0;

  constructor(options: WakeWordDetectorOptions) {
    this.options = options;
  }

  /**
   * Checks whether the current browser/environment supports local Speech Recognition.
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Starts local wake-word listening for "Hey REVA".
   * Note: Completely local processing; no audio is recorded, stored, or sent to Gemini.
   */
  public start(): boolean {
    if (!WakeWordDetector.isSupported()) {
      console.warn('[REVA][WAKE] Local Web Speech Recognition is not supported in this environment.');
      this.options.onStatusChange?.('NOT_SUPPORTED');
      return false;
    }

    if (this.isListening && this.recognition) {
      return true;
    }

    this.isExplicitlyStopped = false;
    this.consecutiveErrors = 0;

    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.consecutiveErrors = 0;
        this.options.onStatusChange?.('LISTENING');
        console.log('[REVA][WAKE] Local wake-word listener active (Listening for "Hey REVA")');
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (this.isExplicitlyStopped) return;

        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i];
          for (let j = 0; j < result.length; j++) {
            const transcript = result[j].transcript;
            const confidence = result[j].confidence || 0.85;

            if (this.evaluateWakeWord(transcript, confidence)) {
              const now = Date.now();
              // Debounce 2 seconds between triggers
              if (now - this.lastTriggerTime > 2000) {
                this.lastTriggerTime = now;
                console.log(`[REVA][WAKE] Wake word detected: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
                this.options.onStatusChange?.('DETECTED');
                this.options.onWakeWordDetected(transcript, confidence);
                return;
              }
            }
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error || 'speech_recognition_error';
        // 'no-speech' or 'aborted' are normal lifecycle events
        if (error === 'no-speech' || error === 'aborted') {
          return;
        }

        console.warn('[REVA][WAKE] Speech recognition notice:', error);
        this.consecutiveErrors += 1;

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          this.isExplicitlyStopped = true;
          this.options.onStatusChange?.('ERROR');
          this.options.onError?.(new Error('Microphone permission denied for wake-word detection'));
          this.stop();
        } else if (this.consecutiveErrors > 5) {
          this.options.onStatusChange?.('ERROR');
          this.options.onError?.(new Error(`Wake-word listener error: ${error}`));
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Automatically restart unless explicitly stopped or too many errors
        if (!this.isExplicitlyStopped && this.consecutiveErrors < 5) {
          setTimeout(() => {
            if (!this.isExplicitlyStopped && !this.isListening) {
              try {
                this.recognition?.start();
              } catch {
                // Ignore start collisions
              }
            }
          }, 300);
        } else if (this.isExplicitlyStopped) {
          this.options.onStatusChange?.('IDLE');
        }
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      console.warn('[REVA][WAKE] Could not start speech recognition:', err);
      this.isListening = false;
      this.options.onStatusChange?.('ERROR');
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * Evaluates if speech transcript matches "Hey REVA" with conservative confidence.
   */
  private evaluateWakeWord(rawText: string, confidence: number): boolean {
    if (!rawText) return false;
    const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

    // Conservative patterns:
    // 1. "hey reva", "hi reva", "hello reva", "ok reva", "okay reva"
    // 2. Phonetic variations: "hey river", "hey raver", "hey riva", "hey eva"
    // 3. Direct distinct address: standalone "reva"
    const explicitWakePattern = /\b(hey|hi|hello|ok|okay)\s+(reva|river|raver|riva|eva)\b/i;
    const directAddressPattern = /\b(reva)\b/i;

    if (explicitWakePattern.test(clean)) {
      return true;
    }

    if (directAddressPattern.test(clean) && (confidence >= 0.75 || clean.split(/\s+/).length <= 3)) {
      return true;
    }

    return false;
  }

  /**
   * Pauses wake-word listening without resetting state (e.g. while Gemini Live is actively talking).
   */
  public pause(): void {
    this.isExplicitlyStopped = true;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.isListening = false;
      this.options.onStatusChange?.('PAUSED');
    }
  }

  /**
   * Resumes wake-word listening.
   */
  public resume(): void {
    if (!this.isExplicitlyStopped) return;
    this.start();
  }

  /**
   * Completely stops and disposes of the recognition instance.
   */
  public stop(): void {
    this.isExplicitlyStopped = true;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
    this.isListening = false;
    this.options.onStatusChange?.('IDLE');
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
