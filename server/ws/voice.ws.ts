/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { GeminiLiveService } from '../services/gemini-live.service.js';
import { ProactiveBehaviorService } from '../services/proactive-behavior.service.js';
import { ToolExecutionService } from '../services/tool-execution.service.js';
import { ClientVoiceMessage, ServerVoiceMessage } from '../types/voice.types.js';

export function setupVoiceWebSocket(wss: WebSocketServer) {
  const proactiveService = ProactiveBehaviorService.getInstance();
  const toolService = ToolExecutionService.getInstance();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('[REVA][WS] Client connected to Voice WebSocket endpoint');

    let geminiLive: GeminiLiveService | null = null;
    let isTerminated = false;

    const sendMessage = (msg: ServerVoiceMessage) => {
      if (ws.readyState === WebSocket.OPEN && !isTerminated) {
        ws.send(JSON.stringify(msg));
      }
    };

    // Wire up tool service events for this client connection
    const unsubscribeToolExecuted = toolService.onToolExecuted((result) => {
      sendMessage({
        type: 'TOOL_EXECUTED',
        toolResult: result,
      });
    });

    const unsubscribeTimer = toolService.onTimerTriggered((timer) => {
      sendMessage({
        type: 'TIMER_RING',
        timer,
      });
    });

    const unsubscribeUrl = toolService.onUrlOpen((url) => {
      sendMessage({
        type: 'OPEN_URL',
        url,
      });
    });

    const unsubscribeClipboard = toolService.onClipboardUpdate((text) => {
      sendMessage({
        type: 'CLIPBOARD_SYNC',
        text,
      });
    });

    const cleanup = async () => {
      if (isTerminated) return;
      isTerminated = true;

      unsubscribeToolExecuted();
      unsubscribeTimer();
      unsubscribeUrl();
      unsubscribeClipboard();

      console.log('[REVA][WS] Cleaning up client voice session');
      if (geminiLive) {
        await geminiLive.close();
        geminiLive = null;
      }
    };

    // Initialize Gemini Live service for this client connection
    const initializeGeminiLive = async () => {
      if (geminiLive) {
        await geminiLive.close();
        geminiLive = null;
      }

      geminiLive = new GeminiLiveService({
        onAudioData: (base64Audio: string) => {
          sendMessage({
            type: 'AUDIO_OUTPUT',
            audio: base64Audio,
          });
        },
        onInterrupted: () => {
          sendMessage({
            type: 'INTERRUPTED',
          });
        },
        onTurnComplete: () => {
          sendMessage({
            type: 'TURN_COMPLETE',
          });
        },
        onTranscript: (role, text) => {
          sendMessage({
            type: 'TRANSCRIPT',
            role,
            text,
          });
        },
        onEmotionUpdate: (personality) => {
          sendMessage({
            type: 'EMOTION_UPDATE',
            personality,
          });
        },
        onMemoryUpdate: () => {
          sendMessage({
            type: 'MEMORY_UPDATE',
            event: 'MEMORY_DATABASE_CHANGED',
          });
        },
        onMemoryRetrieval: (retrievalDiagnostics) => {
          sendMessage({
            type: 'MEMORY_UPDATE',
            event: 'MEMORY_RETRIEVED',
            memoryRetrieval: retrievalDiagnostics,
          });
        },
        onProactiveUpdate: () => {
          sendMessage({
            type: 'PROACTIVE_UPDATE',
            proactive: proactiveService.getDiagnostics(),
          });
        },
        onToolExecuted: (result) => {
          sendMessage({
            type: 'TOOL_EXECUTED',
            toolResult: result,
          });
        },
        onStateChange: (state, details) => {
          sendMessage({
            type: 'SESSION_STATE',
            state: state as any,
            details,
          });
        },
        onError: (err: any) => {
          const message = err instanceof Error ? err.message : String(err);
          sendMessage({
            type: 'ERROR',
            error: message,
          });
        },
        onClose: (code: number, reason: string) => {
          sendMessage({
            type: 'SESSION_STATE',
            state: 'OFFLINE',
            code,
            reason,
          });
        },
      });

      try {
        await geminiLive.connect();
      } catch (err: any) {
        sendMessage({
          type: 'ERROR',
          error: err?.message || 'Failed to initialize Gemini Live connection',
        });
      }
    };

    // Auto-connect Gemini Live on WebSocket client connection
    initializeGeminiLive();

    ws.on('message', async (data: Buffer | string) => {
      try {
        const payload: ClientVoiceMessage = JSON.parse(data.toString());

        switch (payload.type) {
          case 'CONNECT':
            await initializeGeminiLive();
            break;

          case 'AUDIO_INPUT':
            if (payload.audio && geminiLive) {
              geminiLive.sendAudioChunk(payload.audio);
            }
            break;

          case 'EXECUTE_TOOL':
            if (payload.toolName) {
              const execRes = await toolService.executeTool(payload.toolName, payload.toolArgs || {});
              sendMessage({
                type: 'TOOL_EXECUTED',
                toolResult: execRes,
              });
            }
            break;

          case 'CLIPBOARD_PASTE':
            if (typeof payload.clipboardText === 'string') {
              await toolService.executeTool('write_clipboard', { text: payload.clipboardText });
            }
            break;

          case 'PROACTIVE_EVENT':
            if (payload.event?.type) {
              const decision = await proactiveService.evaluateEvent(
                payload.event.type,
                payload.event.context || {},
                geminiLive ? 'READY' : 'OFFLINE'
              );

              sendMessage({
                type: 'PROACTIVE_UPDATE',
                proactive: proactiveService.getDiagnostics(),
              });

              if (decision.decision === 'SPEAK' && decision.speechText && geminiLive) {
                console.log(`[REVA][WS] Proactive spoken trigger dispatched: "${decision.speechText}"`);
                sendMessage({
                  type: 'PROACTIVE_SPEECH',
                  text: decision.speechText,
                });
                geminiLive.sendTextMessage(
                  `[Proactive Observation] Please speak this natural conversational observation immediately without any meta-commentary: "${decision.speechText}"`
                );
              }
            }
            break;

          case 'UPDATE_PROACTIVE_SETTINGS':
            if (payload.settings) {
              proactiveService.updateSettings(payload.settings);
              sendMessage({
                type: 'PROACTIVE_UPDATE',
                proactive: proactiveService.getDiagnostics(),
              });
            }
            break;

          case 'TEST_GREETING':
            if (geminiLive) {
              console.log('[REVA][WS] Sending diagnostic audio test request');
              geminiLive.sendTextMessage(
                payload.text || 'Hello REVA, please respond with a short spoken greeting to test real-time voice synthesis.'
              );
            }
            break;

          case 'INTERRUPT':
            if (geminiLive) {
              console.log('[REVA][WS] User requested explicit interruption');
            }
            break;

          case 'DISCONNECT':
            await cleanup();
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[REVA][WS] Error handling client WebSocket message:', err);
      }
    });

    ws.on('close', async (code, reason) => {
      console.log(`[REVA][WS] Client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
      await cleanup();
    });

    ws.on('error', async (err) => {
      console.error('[REVA][WS] WebSocket client connection error:', err);
      await cleanup();
    });
  });
}
