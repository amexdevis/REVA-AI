/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VoiceSessionState,
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
import { AudioPlayer } from '../lib/audio/audio-player.js';

export function useRevaVoice(options?: {
  onMemoryUpdated?: () => void;
  onProactiveUpdated?: (diag: ProactiveDiagnosticsData) => void;
  onToolExecuted?: (result: ToolExecutionResult) => void;
  onTimerRing?: (timer: TimerItem) => void;
  onOpenUrl?: (url: string) => void;
  onClipboardSync?: (text: string) => void;
}) {
  // Session & Voice state
  const [sessionState, setSessionState] = useState<VoiceSessionState>('OFFLINE');
  const [micState, setMicState] = useState<MicrophonePermissionState>('UNINITIALIZED');
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [revaAudioLevel, setRevaAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptItem[]>([]);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>({
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
  const playerRef = useRef<AudioPlayer | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyDisconnectedRef = useRef(false);
  const isComponentMountedRef = useRef(true);

  // Sync state to diagnostics
  const updateDiagnostics = useCallback((partial: Partial<VoiceDiagnostics>) => {
    setDiagnostics((prev) => ({ ...prev, ...partial }));
  }, []);

  const setInternalSessionState = useCallback((state: VoiceSessionState) => {
    setSessionState(state);
    updateDiagnostics({ revaVoiceState: state });
  }, [updateDiagnostics]);

  // Append transcript
  const addTranscript = useCallback((role: 'user' | 'reva', text: string) => {
    setTranscripts((prev) => {
      // If the last item is from the same role within recent seconds, append or create new
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

  // Initialize Player
  const getOrCreatePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new AudioPlayer({
        sampleRate: 24000,
        onPlaybackStateChange: (isPlaying) => {
          if (isPlaying) {
            setInternalSessionState('REVA_SPEAKING');
            updateDiagnostics({ audioOutState: 'ACTIVE', lastEvent: 'REVA_SPEAKING' });
          } else {
            setInternalSessionState('LISTENING');
            updateDiagnostics({ audioOutState: 'IDLE', lastEvent: 'REVA_FINISHED_SPEAKING' });
          }
        },
        onAudioLevel: (level) => {
          setRevaAudioLevel(level);
        },
      });
    }
    return playerRef.current;
  }, [setInternalSessionState, updateDiagnostics]);

  // Interruption handler (Barge-in)
  const handleInterrupt = useCallback(() => {
    console.log('[REVA] Handling interruption (barge-in)');
    if (playerRef.current) {
      playerRef.current.interrupt();
    }
    setRevaAudioLevel(0);
    setInternalSessionState('INTERRUPTED');
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
  }, [setInternalSessionState, updateDiagnostics]);

  // Connect WebSocket to backend voice bridge
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isManuallyDisconnectedRef.current = false;
    setInternalSessionState('CONNECTING');
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
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'SESSION_STATE':
            if (msg.state === 'READY') {
              setInternalSessionState('READY');
              updateDiagnostics({
                geminiLiveState: 'CONNECTED',
                lastEvent: 'SESSION_READY',
                currentModel: (msg.details?.model as string) || 'gemini-3.1-flash-live-preview',
              });
            } else if (msg.state === 'OFFLINE') {
              setInternalSessionState('OFFLINE');
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
      updateDiagnostics({
        geminiLiveState: 'DISCONNECTED',
        closeCode: event.code,
        closeReason: event.reason || 'Normal connection closure',
        lastEvent: 'WS_CLOSED',
      });

      // Controlled exponential backoff reconnection if not manual disconnect
      if (!isManuallyDisconnectedRef.current && isComponentMountedRef.current) {
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
  }, [setInternalSessionState, updateDiagnostics, getOrCreatePlayer, handleInterrupt, addTranscript]);

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
        if (level > 0.15) {
          // If REVA was speaking and user speaks, trigger immediate barge-in
          if (playerRef.current?.getIsPlaying()) {
            handleInterrupt();
          }
          setSessionState((prev) => (prev !== 'USER_SPEAKING' && prev !== 'REVA_SPEAKING' ? 'USER_SPEAKING' : prev));
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
      updateDiagnostics({
        micState: 'ACTIVE',
        audioInState: 'ACTIVE',
        lastEvent: 'MIC_STREAM_ACTIVE',
      });
    } catch (err: any) {
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setMicState(isDenied ? 'DENIED' : 'ERROR');
      setUserAudioLevel(0);
      updateDiagnostics({
        micState: isDenied ? 'DENIED' : 'ERROR',
        audioInState: 'ERROR',
        lastError: isDenied ? 'Microphone access denied by user or browser' : err.message,
        lastEvent: 'MIC_PERMISSION_FAILED',
      });
    }
  }, [setInternalSessionState, updateDiagnostics, handleInterrupt]);

  // Pause / Resume microphone (Mute toggle)
  const toggleMute = useCallback(() => {
    if (!recorderRef.current) return;

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
  }, [updateDiagnostics]);

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

  // Disconnect voice session cleanly
  const disconnectVoice = useCallback(() => {
    isManuallyDisconnectedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
    updateDiagnostics({
      geminiLiveState: 'DISCONNECTED',
      micState: 'UNINITIALIZED',
      audioInState: 'IDLE',
      audioOutState: 'IDLE',
      lastEvent: 'MANUALLY_DISCONNECTED',
    });
  }, [setInternalSessionState, updateDiagnostics]);

  // Start full voice session (Connects WS + Starts Mic)
  const startVoiceSession = useCallback(async () => {
    // 1. Connect WebSocket
    connectWebSocket();
    // 2. Start Microphone
    await startMicrophone();
  }, [connectWebSocket, startMicrophone]);

  // Component lifecycle cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;

    return () => {
      isComponentMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
  }, []);

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
    sessionState,
    micState,
    userAudioLevel,
    revaAudioLevel,
    diagnostics,
    transcripts,
    startVoiceSession,
    startMicrophone,
    connectWebSocket,
    disconnectVoice,
    toggleMute,
    handleInterrupt,
    testGreeting,
    sendProactiveEvent,
    sendProactiveSettingsUpdate,
    executeToolViaWs,
    sendClipboardPaste,
  };
}
