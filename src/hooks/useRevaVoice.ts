/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VoiceSessionState,
  VoiceMode,
  VoiceMachineState,
  WakeWordStatus,
  MicrophonePermissionState,
  VoiceTranscriptItem,
  VoiceDiagnostics,
  ProactiveEventType,
  ProactiveSettings,
  ProactiveDiagnosticsData,
  ToolExecutionResult,
  TimerItem,
} from '../types/voice.types.js';
import { AudioRecorder } from '../lib/audio/audio-recorder.js';
import { AudioPlaybackManager } from '../lib/audio/audio-playback-manager.js';
import { WakeWordDetector } from '../lib/audio/wake-word-detector.js';

export function useRevaVoice(options?: {
  onMemoryUpdated?: () => void;
  onProactiveUpdated?: (diag: ProactiveDiagnosticsData) => void;
  onToolExecuted?: (result: ToolExecutionResult) => void;
  onTimerRing?: (timer: TimerItem) => void;
  onOpenUrl?: (url: string) => void;
  onClipboardSync?: (text: string) => void;
}) {
  // 1. Voice Mode and Machine State
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>('MANUAL');
  const [machineState, setMachineState] = useState<VoiceMachineState>('MANUAL_IDLE');
  const [wakeWordStatus, setWakeWordStatus] = useState<WakeWordStatus>(
    WakeWordDetector.isSupported() ? 'IDLE' : 'NOT_SUPPORTED'
  );
  const isWakeWordSupported = WakeWordDetector.isSupported();

  // 2. Session & Audio level states
  const [sessionState, setSessionState] = useState<VoiceSessionState>('OFFLINE');
  const [micState, setMicState] = useState<MicrophonePermissionState>('UNINITIALIZED');
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [revaAudioLevel, setRevaAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptItem[]>([]);

  // 3. Diagnostics
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>({
    voiceMode: 'MANUAL',
    machineState: 'MANUAL_IDLE',
    wakeWordStatus: WakeWordDetector.isSupported() ? 'IDLE' : 'NOT_SUPPORTED',
    revaVoiceState: 'OFFLINE',
    geminiLiveState: 'DISCONNECTED',
    micState: 'UNINITIALIZED',
    audioInState: 'IDLE',
    audioOutState: 'IDLE',
    currentModel: 'gemini-3.1-flash-live-preview',
    lastEvent: 'NONE',
    lastError: null,
    closeCode: null,
    closeReason: null,
    reconnectAttempts: 0,
    personality: {
      mode: 'CASUAL',
      userEmotion: 'CALM',
      revaEmotions: {
        happiness: 0.7,
        excitement: 0.5,
        curiosity: 0.8,
        concern: 0.1,
        calmness: 0.8,
        confidence: 0.9,
        playfulness: 0.6,
        frustration: 0.0,
        affection: 0.5,
      },
      responseStyle: 'Natural, conversational, attentive',
      responseLength: 'CONCISE',
    },
  });

  // Active instances refs
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlaybackManager | null>(null);
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyDisconnectedRef = useRef(false);
  const isComponentMountedRef = useRef(true);

  // References for state synchronization in callbacks
  const voiceModeRef = useRef<VoiceMode>('MANUAL');
  const machineStateRef = useRef<VoiceMachineState>('MANUAL_IDLE');
  const handsFreeSilenceTimerRef = useRef<number | null>(null);
  const lastUserSpeechTimeRef = useRef<number>(Date.now());

  // Sync refs with state
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  useEffect(() => {
    machineStateRef.current = machineState;
  }, [machineState]);

  // Sync state to diagnostics
  const updateDiagnostics = useCallback((partial: Partial<VoiceDiagnostics>) => {
    setDiagnostics((prev) => ({ ...prev, ...partial }));
  }, []);

  const setInternalMachineState = useCallback(
    (newState: VoiceMachineState) => {
      machineStateRef.current = newState;
      setMachineState(newState);
      updateDiagnostics({ machineState: newState });
    },
    [updateDiagnostics]
  );

  const setInternalSessionState = useCallback(
    (state: VoiceSessionState) => {
      setSessionState(state);
      updateDiagnostics({ revaVoiceState: state });
    },
    [updateDiagnostics]
  );

  // Clear Hands-Free silence timer
  const clearHandsFreeTimer = useCallback(() => {
    if (handsFreeSilenceTimerRef.current) {
      clearTimeout(handsFreeSilenceTimerRef.current);
      handsFreeSilenceTimerRef.current = null;
    }
  }, []);

  // Append transcript
  const addTranscript = useCallback((role: 'user' | 'reva', text: string) => {
    setTranscripts((prev) => {
      const now = new Date().toLocaleTimeString();
      const last = prev[prev.length - 1];
      if (last && last.role === role && text.startsWith(last.text)) {
        return [...prev.slice(0, -1), { ...last, text, timestamp: now }];
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role,
          text,
          timestamp: now,
        },
      ];
    });
  }, []);

  // Initialize AudioPlaybackManager
  const getOrCreatePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = AudioPlaybackManager.getInstance({
        sampleRate: 24000,
        onPlaybackStateChange: (isPlaying) => {
          if (isPlaying) {
            setInternalSessionState('REVA_SPEAKING');
            setInternalMachineState('SPEAKING');
            updateDiagnostics({ audioOutState: 'ACTIVE', lastEvent: 'REVA_SPEAKING' });
            clearHandsFreeTimer();
          } else {
            setInternalSessionState('LISTENING');
            setInternalMachineState('LISTENING');
            updateDiagnostics({ audioOutState: 'IDLE', lastEvent: 'REVA_FINISHED_SPEAKING' });

            // In Hands-Free mode, start inactivity timeout to return to WAKE_LISTENING
            if (voiceModeRef.current === 'HANDS_FREE') {
              clearHandsFreeTimer();
              handsFreeSilenceTimerRef.current = window.setTimeout(() => {
                console.log('[REVA][HANDS-FREE] Conversation idle timeout reached. Returning to wake listening.');
                returnToWakeListening();
              }, 9000); // 9 seconds of post-speech silence window
            }
          }
        },
        onAudioLevel: (level) => {
          setRevaAudioLevel(level);
        },
      });
    }
    return playerRef.current;
  }, [setInternalSessionState, setInternalMachineState, updateDiagnostics, clearHandsFreeTimer]);

  // Interruption handler (Barge-in)
  const handleInterrupt = useCallback(() => {
    console.log('[REVA] Handling interruption (barge-in)');
    clearHandsFreeTimer();

    if (playerRef.current) {
      playerRef.current.interrupt();
    }
    setRevaAudioLevel(0);
    setInternalSessionState('INTERRUPTED');
    setInternalMachineState('LISTENING');
    updateDiagnostics({
      lastEvent: 'BARGE_IN_INTERRUPT',
      audioOutState: 'IDLE',
    });

    // Notify backend if WebSocket open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'INTERRUPT' }));
    }

    // Return to listening
    setTimeout(() => {
      if (isComponentMountedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        setInternalSessionState('LISTENING');
      }
    }, 200);
  }, [setInternalSessionState, setInternalMachineState, updateDiagnostics, clearHandsFreeTimer]);

  // Return from active hands-free conversation back to local Wake Word Listening
  const returnToWakeListening = useCallback(() => {
    clearHandsFreeTimer();

    // 1. Stop recording streaming to server
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setMicState('PAUSED');
    setUserAudioLevel(0);

    // 2. Set states
    setInternalSessionState('READY');
    setInternalMachineState('WAKE_LISTENING');
    updateDiagnostics({
      audioInState: 'IDLE',
      lastEvent: 'RETURNED_TO_WAKE_LISTENING',
    });

    // 3. Resume / Start Wake Word Detector locally
    if (detectorRef.current && voiceModeRef.current === 'HANDS_FREE') {
      detectorRef.current.start();
    }
  }, [clearHandsFreeTimer, setInternalSessionState, setInternalMachineState, updateDiagnostics]);

  // Connect WebSocket to backend voice bridge
  const connectWebSocket = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    isManuallyDisconnectedRef.current = false;
    setInternalSessionState('CONNECTING');
    setInternalMachineState('CONNECTING');
    updateDiagnostics({
      geminiLiveState: 'CONNECTING',
      lastEvent: 'WS_CONNECTING',
      lastError: null,
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/voice`;

    console.log(`[REVA] Connecting voice WebSocket to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[REVA] Voice WebSocket opened');
      reconnectAttemptsRef.current = 0;
      updateDiagnostics({
        reconnectAttempts: 0,
        lastEvent: 'WS_OPENED',
      });

      // Synchronize client browser timezone
      try {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offsetMins = new Date().getTimezoneOffset();
        ws.send(
          JSON.stringify({
            type: 'CLIENT_TIMEZONE',
            timezone: detectedTz,
            offsetMinutes: offsetMins,
          })
        );
      } catch (tzErr) {
        console.warn('[REVA] Could not send client timezone:', tzErr);
      }
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'SESSION_STATE':
            if (msg.state === 'READY') {
              setInternalSessionState('READY');
              if (machineStateRef.current === 'CONNECTING') {
                setInternalMachineState(
                  voiceModeRef.current === 'HANDS_FREE' ? 'LISTENING' : 'MANUAL_LISTENING'
                );
              }
              updateDiagnostics({
                geminiLiveState: 'CONNECTED',
                lastEvent: 'SESSION_READY',
                currentModel: (msg.details?.model as string) || 'gemini-3.1-flash-live-preview',
              });
            } else if (msg.state === 'OFFLINE') {
              setInternalSessionState('OFFLINE');
              if (voiceModeRef.current === 'OFF') {
                setInternalMachineState('OFF');
              } else if (voiceModeRef.current === 'MANUAL') {
                setInternalMachineState('MANUAL_IDLE');
              }
              updateDiagnostics({
                geminiLiveState: 'DISCONNECTED',
                lastEvent: 'SESSION_OFFLINE',
                closeCode: msg.code || null,
                closeReason: msg.reason || null,
              });
            }
            break;

          case 'AUDIO_OUTPUT':
            if (msg.audio) {
              const player = getOrCreatePlayer();
              await player.queueAudioChunk(msg.audio);
              updateDiagnostics({ lastEvent: 'AUDIO_CHUNK_RECEIVED' });
            }
            break;

          case 'INTERRUPTED':
            handleInterrupt();
            break;

          case 'TURN_COMPLETE':
            updateDiagnostics({ lastEvent: 'TURN_COMPLETE' });
            // In Hands-Free mode, start silence timer if playback has completed
            if (voiceModeRef.current === 'HANDS_FREE' && !playerRef.current?.getIsPlaying()) {
              clearHandsFreeTimer();
              handsFreeSilenceTimerRef.current = window.setTimeout(() => {
                console.log('[REVA][HANDS-FREE] Turn complete idle timeout. Returning to wake listening.');
                returnToWakeListening();
              }, 9000);
            }
            break;

          case 'TRANSCRIPT':
            if (msg.role && msg.text) {
              addTranscript(msg.role, msg.text);
              updateDiagnostics({ lastEvent: `TRANSCRIPT_${msg.role.toUpperCase()}` });
            }
            break;

          case 'EMOTION_UPDATE':
            if (msg.personality) {
              updateDiagnostics({
                personality: msg.personality,
                lastEvent: `EMOTION_${msg.personality.mode}`,
              });
            }
            break;

          case 'MEMORY_UPDATE':
            if (msg.memoryRetrieval) {
              updateDiagnostics({
                memoryRetrieval: msg.memoryRetrieval,
                lastEvent: 'MEMORY_RETRIEVED',
              });
            } else {
              updateDiagnostics({
                lastEvent: 'MEMORY_DATABASE_CHANGED',
              });
            }
            if (options?.onMemoryUpdated) {
              options.onMemoryUpdated();
            }
            break;

          case 'PROACTIVE_UPDATE':
            if (msg.proactive) {
              updateDiagnostics({
                proactive: msg.proactive,
                lastEvent: 'PROACTIVE_DIAGNOSTICS_UPDATED',
              });
              if (options?.onProactiveUpdated) {
                options.onProactiveUpdated(msg.proactive);
              }
            }
            break;

          case 'PROACTIVE_SPEECH':
            if (msg.text) {
              addTranscript('reva', msg.text);
              updateDiagnostics({ lastEvent: 'PROACTIVE_SPEECH_TRIGGERED' });
            }
            break;

          case 'CONTEXT_UPDATE':
            if (msg.context) {
              updateDiagnostics({
                context: msg.context,
                lastEvent: 'CONTEXT_DIAGNOSTICS_UPDATED',
              });
            }
            break;

          case 'TOOL_EXECUTED':
            if (msg.toolResult) {
              updateDiagnostics({ lastEvent: `TOOL_EXECUTED_${msg.toolResult.tool}` });
              if (options?.onToolExecuted) {
                options.onToolExecuted(msg.toolResult);
              }
            }
            break;

          case 'TIMER_RING':
            if (msg.timer) {
              updateDiagnostics({ lastEvent: `TIMER_RING_${msg.timer.label}` });
              if (options?.onTimerRing) {
                options.onTimerRing(msg.timer);
              }
            }
            break;

          case 'OPEN_URL':
            if (msg.url) {
              updateDiagnostics({ lastEvent: `OPEN_URL_${msg.url}` });
              if (options?.onOpenUrl) {
                options.onOpenUrl(msg.url);
              }
            }
            break;

          case 'CLIPBOARD_SYNC':
            if (typeof msg.text === 'string') {
              updateDiagnostics({ lastEvent: 'CLIPBOARD_SYNC' });
              if (options?.onClipboardSync) {
                options.onClipboardSync(msg.text);
              }
            }
            break;

          case 'ERROR':
            console.error('[REVA] Received server error:', msg.error);
            updateDiagnostics({
              lastError: msg.error || 'Server error',
              lastEvent: 'ERROR_RECEIVED',
            });
            if (msg.error?.includes('API key') || msg.error?.includes('not configured')) {
              setInternalSessionState('ERROR');
              setInternalMachineState('ERROR');
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[REVA] Error parsing server message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[REVA] Voice WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
      setInternalSessionState('OFFLINE');
      if (voiceModeRef.current === 'OFF') {
        setInternalMachineState('OFF');
      } else if (voiceModeRef.current === 'MANUAL') {
        setInternalMachineState('MANUAL_IDLE');
      }
      updateDiagnostics({
        geminiLiveState: 'DISCONNECTED',
        closeCode: event.code,
        closeReason: event.reason || 'Normal connection closure',
        lastEvent: 'WS_CLOSED',
      });

      // Controlled exponential backoff reconnection if not manual disconnect
      if (
        !isManuallyDisconnectedRef.current &&
        isComponentMountedRef.current &&
        voiceModeRef.current !== 'OFF'
      ) {
        const attempts = reconnectAttemptsRef.current;
        if (attempts < 5) {
          const delay = Math.min(30000, Math.pow(2, attempts) * 1000);
          console.log(`[REVA] Reconnecting in ${delay}ms (Attempt ${attempts + 1})...`);
          setInternalSessionState('RECONNECTING');
          updateDiagnostics({
            reconnectAttempts: attempts + 1,
            lastEvent: `RECONNECTING_IN_${delay}ms`,
          });
          reconnectAttemptsRef.current += 1;

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (isComponentMountedRef.current && !isManuallyDisconnectedRef.current) {
              connectWebSocket();
            }
          }, delay);
        } else {
          setInternalSessionState('ERROR');
          setInternalMachineState('ERROR');
          updateDiagnostics({
            lastError: 'Maximum reconnection attempts exceeded',
            lastEvent: 'MAX_RECONNECT_REACHED',
          });
        }
      }
    };

    ws.onerror = (err) => {
      console.error('[REVA] Voice WebSocket error:', err);
      updateDiagnostics({
        lastError: 'WebSocket transport error',
        lastEvent: 'WS_ERROR',
      });
    };
  }, [
    setInternalSessionState,
    setInternalMachineState,
    updateDiagnostics,
    getOrCreatePlayer,
    handleInterrupt,
    addTranscript,
    clearHandsFreeTimer,
    returnToWakeListening,
  ]);

  // Start real-time microphone capture
  const startMicrophone = useCallback(async () => {
    if (recorderRef.current?.getIsRecording()) {
      return;
    }

    setMicState('REQUESTING');
    updateDiagnostics({ micState: 'REQUESTING', lastEvent: 'MIC_REQUEST' });

    const recorder = new AudioRecorder({
      targetSampleRate: 16000,
      onAudioData: (base64Pcm, level) => {
        setUserAudioLevel(level);

        // Speech activity threshold detection
        if (level > 0.12) {
          lastUserSpeechTimeRef.current = Date.now();
          clearHandsFreeTimer();

          // If REVA was speaking and user speaks, trigger immediate barge-in (using higher threshold to avoid speaker bleed)
          if (playerRef.current?.getIsPlaying() && level > 0.26) {
            handleInterrupt();
          }

          setSessionState((prev) =>
            prev !== 'USER_SPEAKING' && prev !== 'REVA_SPEAKING' ? 'USER_SPEAKING' : prev
          );
          setInternalMachineState('LISTENING');
          updateDiagnostics({ audioInState: 'ACTIVE' });
        } else if (level < 0.05) {
          setSessionState((prev) => (prev === 'USER_SPEAKING' ? 'LISTENING' : prev));
        }

        // Stream audio chunk to backend Gemini Live
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'AUDIO_INPUT',
              audio: base64Pcm,
            })
          );
        }
      },
      onError: (err) => {
        console.error('[REVA] Microphone capture error:', err);
        setMicState('ERROR');
        setUserAudioLevel(0);
        setInternalMachineState('ERROR');
        updateDiagnostics({
          micState: 'ERROR',
          audioInState: 'ERROR',
          lastError: err.message,
          lastEvent: 'MIC_ERROR',
        });
      },
    });

    try {
      await recorder.start();
      recorderRef.current = recorder;
      setMicState('ACTIVE');
      setInternalSessionState('LISTENING');
      setInternalMachineState(voiceModeRef.current === 'HANDS_FREE' ? 'LISTENING' : 'MANUAL_LISTENING');
      updateDiagnostics({
        micState: 'ACTIVE',
        audioInState: 'ACTIVE',
        lastEvent: 'MIC_STREAM_ACTIVE',
      });
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicState(isDenied ? 'DENIED' : 'ERROR');
      setUserAudioLevel(0);
      setInternalMachineState('ERROR');
      updateDiagnostics({
        micState: isDenied ? 'DENIED' : 'ERROR',
        audioInState: 'ERROR',
        lastError: isDenied ? 'Microphone permission denied by user or browser' : err.message,
        lastEvent: 'MIC_PERMISSION_FAILED',
      });
    }
  }, [
    setInternalSessionState,
    setInternalMachineState,
    updateDiagnostics,
    handleInterrupt,
    clearHandsFreeTimer,
  ]);

  // Start full voice session (Connects WS + Starts Mic)
  const startVoiceSession = useCallback(async () => {
    if (voiceModeRef.current === 'OFF') {
      console.log('[REVA] Voice is in OFF mode. Switching to MANUAL to start voice session.');
      setVoiceModeState('MANUAL');
      voiceModeRef.current = 'MANUAL';
      updateDiagnostics({ voiceMode: 'MANUAL' });
    }

    // If detector was active, pause it so mic is exclusive
    if (detectorRef.current) {
      detectorRef.current.pause();
    }

    // 1. Connect WebSocket
    connectWebSocket();
    // 2. Start Microphone
    await startMicrophone();
  }, [connectWebSocket, startMicrophone, updateDiagnostics]);

  // Wake-word detection trigger handler (Step 9 Hands-Free Flow)
  const handleWakeWordDetected = useCallback(
    async (phrase: string, confidence: number) => {
      console.log(`[REVA][HANDS-FREE] Wake Word Activated: "${phrase}" (${confidence.toFixed(2)})`);

      // 1. Pause local wake-word detector to give exclusive mic control to Gemini Live
      if (detectorRef.current) {
        detectorRef.current.pause();
      }

      setWakeWordStatus('DETECTED');
      updateDiagnostics({
        wakeWordStatus: 'DETECTED',
        lastEvent: `WAKE_WORD_DETECTED: "${phrase}"`,
      });

      // 2. Activate Gemini Live voice session
      await startVoiceSession();
    },
    [startVoiceSession, updateDiagnostics]
  );

  // Centralized Voice Mode Switcher (Step 9 Mode Management)
  const setVoiceMode = useCallback(
    (newMode: VoiceMode) => {
      if (newMode === voiceModeRef.current) {
        return;
      }

      console.log(`[REVA][MODE] Switching Voice Mode from ${voiceModeRef.current} to ${newMode}`);
      clearHandsFreeTimer();

      // 1. Cleanly stop previous mode owners
      if (detectorRef.current) {
        detectorRef.current.stop();
      }

      // 2. Stop audio recording stream
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      setMicState('UNINITIALIZED');
      setUserAudioLevel(0);

      // 3. Stop player if active
      if (playerRef.current?.getIsPlaying()) {
        playerRef.current.interrupt();
      }
      setRevaAudioLevel(0);

      // 4. Update mode state
      setVoiceModeState(newMode);
      voiceModeRef.current = newMode;
      updateDiagnostics({ voiceMode: newMode });

      // 5. Apply new mode behavior
      if (newMode === 'OFF') {
        // Complete microphone and connection release
        if (wsRef.current) {
          isManuallyDisconnectedRef.current = true;
          wsRef.current.close();
          wsRef.current = null;
        }
        setInternalSessionState('OFFLINE');
        setInternalMachineState('OFF');
        setWakeWordStatus('IDLE');
        updateDiagnostics({
          geminiLiveState: 'DISCONNECTED',
          micState: 'UNINITIALIZED',
          audioInState: 'IDLE',
          audioOutState: 'IDLE',
          machineState: 'OFF',
          wakeWordStatus: 'IDLE',
          lastEvent: 'VOICE_MODE_OFF',
        });
      } else if (newMode === 'MANUAL') {
        // Manual mode: Default, idle until user clicks mic / presses Space
        setInternalSessionState('OFFLINE');
        setInternalMachineState('MANUAL_IDLE');
        setWakeWordStatus('IDLE');
        updateDiagnostics({
          machineState: 'MANUAL_IDLE',
          wakeWordStatus: 'IDLE',
          lastEvent: 'VOICE_MODE_MANUAL',
        });
      } else if (newMode === 'HANDS_FREE') {
        // Hands-Free mode: Start local wake-word detection for "Hey REVA"
        if (!WakeWordDetector.isSupported()) {
          console.warn('[REVA] Hands-Free wake-word is unavailable in this environment.');
          setWakeWordStatus('NOT_SUPPORTED');
          setInternalMachineState('MANUAL_IDLE');
          setVoiceModeState('MANUAL');
          voiceModeRef.current = 'MANUAL';
          updateDiagnostics({
            voiceMode: 'MANUAL',
            wakeWordStatus: 'NOT_SUPPORTED',
            machineState: 'MANUAL_IDLE',
            lastError: 'Hands-Free wake-word detection is not supported in this browser.',
            lastEvent: 'HANDS_FREE_UNAVAILABLE',
          });
          return;
        }

        // Initialize and start WakeWordDetector locally
        if (!detectorRef.current) {
          detectorRef.current = new WakeWordDetector({
            onWakeWordDetected: (phrase, conf) => handleWakeWordDetected(phrase, conf),
            onStatusChange: (status) => {
              setWakeWordStatus(status);
              updateDiagnostics({ wakeWordStatus: status });
            },
            onError: (err) => {
              console.warn('[REVA][WAKE] Detector error:', err);
              updateDiagnostics({
                lastError: err.message,
                lastEvent: 'WAKE_DETECTOR_ERROR',
              });
            },
          });
        }

        const started = detectorRef.current.start();
        if (started) {
          setInternalSessionState('READY');
          setInternalMachineState('WAKE_LISTENING');
          setWakeWordStatus('LISTENING');
          updateDiagnostics({
            machineState: 'WAKE_LISTENING',
            wakeWordStatus: 'LISTENING',
            lastEvent: 'VOICE_MODE_HANDS_FREE_ACTIVE',
          });
        } else {
          setInternalMachineState('MANUAL_IDLE');
          setVoiceModeState('MANUAL');
          voiceModeRef.current = 'MANUAL';
          updateDiagnostics({
            voiceMode: 'MANUAL',
            machineState: 'MANUAL_IDLE',
            lastEvent: 'HANDS_FREE_START_FAILED',
          });
        }
      }
    },
    [
      clearHandsFreeTimer,
      handleWakeWordDetected,
      setInternalSessionState,
      setInternalMachineState,
      updateDiagnostics,
    ]
  );

  // Pause / Resume microphone (Mute toggle)
  const toggleMute = useCallback(() => {
    if (!recorderRef.current) {
      if (sessionState === 'OFFLINE' || machineState === 'MANUAL_IDLE') {
        startVoiceSession();
      }
      return;
    }

    if (recorderRef.current.getIsPaused()) {
      recorderRef.current.resume();
      setMicState('ACTIVE');
      updateDiagnostics({ micState: 'ACTIVE', lastEvent: 'MIC_UNMUTED' });
    } else {
      recorderRef.current.pause();
      setMicState('PAUSED');
      setUserAudioLevel(0);
      updateDiagnostics({ micState: 'PAUSED', lastEvent: 'MIC_MUTED' });
    }
  }, [sessionState, machineState, startVoiceSession, updateDiagnostics]);

  // Send diagnostic test greeting
  const testGreeting = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      updateDiagnostics({ lastEvent: 'TEST_GREETING_SENT' });
      wsRef.current.send(
        JSON.stringify({
          type: 'TEST_GREETING',
          text: 'Hello REVA, please respond with a short spoken greeting to test real-time voice playback.',
        })
      );
    }
  }, [updateDiagnostics]);

  // Send proactive event over WebSocket
  const sendProactiveEvent = useCallback(
    (type: ProactiveEventType, context: Record<string, any> = {}) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'PROACTIVE_EVENT',
            event: { type, context },
          })
        );
      }
    },
    []
  );

  // Send proactive settings update over WebSocket
  const sendProactiveSettingsUpdate = useCallback((settings: Partial<ProactiveSettings>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'UPDATE_PROACTIVE_SETTINGS',
          settings,
        })
      );
    }
  }, []);

  // Send context awareness settings update over WebSocket
  const sendContextSettingsUpdate = useCallback(
    (
      contextSettings: Partial<{
        contextAwarenessEnabled: boolean;
        timeAwarenessEnabled: boolean;
        applicationContextEnabled: boolean;
        autoTopicTracking: boolean;
      }>
    ) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'UPDATE_CONTEXT_SETTINGS',
            contextSettings,
          })
        );
      }
      // Also update via REST API for persistence
      fetch('/api/context/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextSettings),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.diagnostics) {
            updateDiagnostics({ context: data.diagnostics });
          }
        })
        .catch(() => {});
    },
    [updateDiagnostics]
  );

  // Disconnect voice session cleanly
  const disconnectVoice = useCallback(() => {
    isManuallyDisconnectedRef.current = true;
    clearHandsFreeTimer();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }

    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setMicState('UNINITIALIZED');
    setUserAudioLevel(0);

    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
    }
    setRevaAudioLevel(0);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setInternalSessionState('OFFLINE');
    setInternalMachineState(voiceModeRef.current === 'OFF' ? 'OFF' : 'MANUAL_IDLE');
    setWakeWordStatus('IDLE');
    updateDiagnostics({
      geminiLiveState: 'DISCONNECTED',
      micState: 'UNINITIALIZED',
      audioInState: 'IDLE',
      audioOutState: 'IDLE',
      machineState: voiceModeRef.current === 'OFF' ? 'OFF' : 'MANUAL_IDLE',
      wakeWordStatus: 'IDLE',
      lastEvent: 'MANUALLY_DISCONNECTED',
    });
  }, [clearHandsFreeTimer, setInternalSessionState, setInternalMachineState, updateDiagnostics]);

  // Component lifecycle cleanup & initial browser timezone sync
  useEffect(() => {
    isComponentMountedRef.current = true;

    // Send initial HTTP timezone sync
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = new Date().getTimezoneOffset();
      fetch('/api/time/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz, offsetMinutes: offset }),
      }).catch((e) => console.warn('[REVA] Initial timezone sync warning:', e));
    } catch (_) {}

    return () => {
      isComponentMountedRef.current = false;
      clearHandsFreeTimer();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
      }
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (playerRef.current) {
        playerRef.current.close();
        playerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearHandsFreeTimer]);

  // Execute tool through WebSocket
  const executeToolViaWs = useCallback((toolName: string, toolArgs?: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'EXECUTE_TOOL',
          toolName,
          toolArgs: toolArgs || {},
        })
      );
    }
  }, []);

  // Send clipboard paste to server
  const sendClipboardPaste = useCallback((clipboardText: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CLIPBOARD_PASTE',
          clipboardText,
        })
      );
    }
  }, []);

  return {
    voiceMode,
    machineState,
    wakeWordStatus,
    isWakeWordSupported,
    sessionState,
    micState,
    userAudioLevel,
    revaAudioLevel,
    diagnostics,
    transcripts,
    setVoiceMode,
    startVoiceSession,
    startMicrophone,
    connectWebSocket,
    disconnectVoice,
    toggleMute,
    handleInterrupt,
    testGreeting,
    sendProactiveEvent,
    sendProactiveSettingsUpdate,
    sendContextSettingsUpdate,
    executeToolViaWs,
    sendClipboardPaste,
  };
}
