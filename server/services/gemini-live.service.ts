/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { GeminiService } from './gemini.service.js';
import { RevaPersonalityService, PersonalityDiagnosticsData } from './reva-personality.service.js';
import { MemoryService } from './memory.service.js';
import { MemoryCategory } from '../types/voice.types.js';
import { WorkingMemoryService } from './working-memory.service.js';
import { MemoryConsolidationService } from './memory-consolidation.service.js';
import { ProactiveBehaviorService } from './proactive-behavior.service.js';
import { ToolExecutionService } from './tool-execution.service.js';

export interface GeminiLiveCallbacks {
  onAudioData: (base64Audio: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onTranscript?: (role: 'user' | 'reva', text: string) => void;
  onEmotionUpdate?: (data: PersonalityDiagnosticsData) => void;
  onMemoryUpdate?: () => void;
  onMemoryRetrieval?: (diagnostics: any) => void;
  onProactiveUpdate?: () => void;
  onToolExecuted?: (result: any) => void;
  onStateChange: (state: string, details?: Record<string, unknown>) => void;
  onError: (err: Error | unknown) => void;
  onClose: (code: number, reason: string) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private session: any = null;
  private isConnected = false;
  private currentModel = 'gemini-3.1-flash-live-preview';
  private callbacks: GeminiLiveCallbacks;
  private personality: RevaPersonalityService;
  private memoryService: MemoryService;
  private proactiveService: ProactiveBehaviorService;
  private toolService: ToolExecutionService;

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks;
    this.personality = new RevaPersonalityService();
    this.memoryService = MemoryService.getInstance();
    this.proactiveService = ProactiveBehaviorService.getInstance();
    this.toolService = ToolExecutionService.getInstance();
  }

  public getModelName(): string {
    return this.currentModel;
  }

  public getPersonalityDiagnostics(): PersonalityDiagnosticsData {
    return this.personality.getDiagnostics();
  }

  public async connect(): Promise<void> {
    if (!GeminiService.isConfigured()) {
      const err = new Error('Gemini API key is not configured in server environment.');
      this.callbacks.onError(err);
      throw err;
    }

    try {
      this.ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      console.log(`[REVA][GEMINI] Initiating Live session with model: ${this.currentModel}`);
      this.callbacks.onStateChange('CONNECTING', { model: this.currentModel });

      const systemInstruction = await RevaPersonalityService.getSystemInstruction();

      this.session = await this.ai.live.connect({
        model: this.currentModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'save_memory',
                  description:
                    'Save or update an important user fact, preference, project, interest, or goal in the permanent local SQLite memory database. Call this whenever the user asks you to remember something or voluntarily shares an important preference/project.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: 'Category: USER_PROFILE, PREFERENCE, PROJECT, GOAL, INTEREST, HABIT, ROUTINE, IMPORTANT_FACT, OTHER',
                      },
                      content: {
                        type: Type.STRING,
                        description: 'The factual memory content (e.g. "The user prefers dark interfaces" or "The user is working on REVA project")',
                      },
                      importance: {
                        type: Type.NUMBER,
                        description: 'Importance score from 0.0 to 1.0 (default 0.9 for explicit remember requests)',
                      },
                    },
                    required: ['content'],
                  },
                },
                {
                  name: 'recall_memories',
                  description:
                    'Retrieve relevant persistent user memories from the local database for a specific topic or keyword query.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: 'Keywords or question topic to query from the memory database',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'forget_memory',
                  description:
                    'Delete or forget a specific user memory from the local database. Call this when the user asks you to forget a preference or fact.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: 'The memory content, topic, or fact to forget',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'clear_all_memories',
                  description:
                    'Permanently delete all stored user memories. Only call this when the user has explicitly confirmed they want to wipe all memory.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      confirmed: {
                        type: Type.BOOLEAN,
                        description: 'Explicit confirmation flag. Must be true.',
                      },
                    },
                    required: ['confirmed'],
                  },
                },
                {
                  name: 'get_system_status',
                  description: 'Retrieve real operating system information, CPU load, and memory usage metrics.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'get_active_application',
                  description: 'Detect the currently focused active window, application, or workspace context.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'get_current_time',
                  description: 'Get the exact current date, time, day of the week, and timezone.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'open_website',
                  description: 'Open a verified web URL in the browser (e.g. YouTube, GitHub, Google, docs).',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: 'The website URL to open (e.g. "https://youtube.com" or "github.com")',
                      },
                    },
                    required: ['url'],
                  },
                },
                {
                  name: 'open_application',
                  description: 'Open a standard local application on the host system (Chrome, VS Code, Terminal, Calculator, etc.).',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      appName: {
                        type: Type.STRING,
                        description: 'Name of application to open: chrome, vs code, terminal, calculator, notepad, spotify, vlc',
                      },
                    },
                    required: ['appName'],
                  },
                },
                {
                  name: 'read_clipboard',
                  description: 'Read the current text content from the user clipboard buffer.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'write_clipboard',
                  description: 'Copy text to the user clipboard buffer.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      text: {
                        type: Type.STRING,
                        description: 'The text to copy to the clipboard',
                      },
                    },
                    required: ['text'],
                  },
                },
                {
                  name: 'search_files',
                  description: 'Search for files by name or extension in the local workspace directory.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: 'File name keyword or search phrase',
                      },
                      directory: {
                        type: Type.STRING,
                        description: 'Optional subfolder to search within',
                      },
                      extension: {
                        type: Type.STRING,
                        description: 'Optional file extension filter (e.g. "ts", "json", "md")',
                      },
                    },
                    required: ['query'],
                  },
                },
                {
                  name: 'create_note',
                  description: 'Create and save a local note with title and content for future reference.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      title: {
                        type: Type.STRING,
                        description: 'A short descriptive title for the note',
                      },
                      content: {
                        type: Type.STRING,
                        description: 'The note text or information to save',
                      },
                      tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'Optional tag keywords',
                      },
                    },
                    required: ['content'],
                  },
                },
                {
                  name: 'get_notes',
                  description: 'Retrieve saved local notes, optionally filtering by search query.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      query: {
                        type: Type.STRING,
                        description: 'Optional keyword to search notes by',
                      },
                    },
                  },
                },
                {
                  name: 'delete_note',
                  description: 'Delete a previously saved note by ID or title.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      idOrTitle: {
                        type: Type.STRING,
                        description: 'Note ID or exact note title to remove',
                      },
                    },
                    required: ['idOrTitle'],
                  },
                },
                {
                  name: 'set_timer',
                  description: 'Set a countdown timer in seconds or minutes with an optional label.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      durationSeconds: {
                        type: Type.NUMBER,
                        description: 'Timer duration in seconds (e.g. 60 for 1 minute, 1200 for 20 minutes)',
                      },
                      minutes: {
                        type: Type.NUMBER,
                        description: 'Alternative duration specified in minutes',
                      },
                      label: {
                        type: Type.STRING,
                        description: 'Optional label or purpose of the timer (e.g. "tea", "code review")',
                      },
                    },
                  },
                },
                {
                  name: 'list_timers',
                  description: 'List all active or recently completed countdown timers.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                  },
                },
                {
                  name: 'cancel_timer',
                  description: 'Cancel an active timer by ID or label.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      idOrLabel: {
                        type: Type.STRING,
                        description: 'Timer ID or label to cancel',
                      },
                    },
                    required: ['idOrLabel'],
                  },
                },
                {
                  name: 'list_running_applications',
                  description: 'List currently running system processes and application instances.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      limit: {
                        type: Type.NUMBER,
                        description: 'Maximum processes to return (default 15)',
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message);
          },
          onclose: (event: any) => {
            const code = event?.code ?? 1000;
            const reason = event?.reason ?? 'Normal closure';
            console.log(`[REVA][GEMINI] Live session closed. code: ${code}, reason: ${reason}`);
            this.isConnected = false;
            this.callbacks.onClose(code, reason);
          },
          onerror: (err: any) => {
            console.error('[REVA][GEMINI] Live session encountered error:', err);
            this.callbacks.onError(err);
          },
        },
      });

      this.isConnected = true;
      console.log('[REVA][GEMINI] Live session connected and ready');
      this.callbacks.onStateChange('READY', { model: this.currentModel });

      if (this.callbacks.onEmotionUpdate) {
        this.callbacks.onEmotionUpdate(this.personality.getDiagnostics());
      }
    } catch (err: unknown) {
      this.isConnected = false;
      console.error('[REVA][GEMINI] Failed to establish Live session:', err);
      this.callbacks.onError(err);
      throw err;
    }
  }

  private async handleServerMessage(message: LiveServerMessage): Promise<void> {
    // 1. Check for tool calls from Gemini Live
    if ((message as any)?.toolCall?.functionCalls) {
      const calls = (message as any).toolCall.functionCalls;
      const functionResponses = [];

      for (const call of calls) {
        const { name, args, id } = call;
        console.log(`[REVA][GEMINI] Tool call invoked: ${name}`, args);
        let result: any = { status: 'ok' };

        try {
          if (name === 'save_memory') {
            const saved = await this.memoryService.saveMemory({
              category: (args?.category as MemoryCategory) || 'PREFERENCE',
              content: args?.content || '',
              importance: typeof args?.importance === 'number' ? args.importance : 0.9,
              source: 'voice_session',
            });
            result = { status: 'success', id: saved.id, content: saved.content };
            this.callbacks.onMemoryUpdate?.();
          } else if (name === 'recall_memories') {
            const memories = await this.memoryService.searchMemories(args?.query || '', { limit: 5 });
            result = {
              status: 'success',
              count: memories.length,
              memories: memories.map((m) => ({ category: m.category, content: m.content })),
            };
          } else if (name === 'forget_memory') {
            const res = await this.memoryService.handleVoiceMemoryCommand(`forget that ${args?.query || ''}`);
            result = { status: res.handled ? 'success' : 'not_found', handled: res.handled };
            this.callbacks.onMemoryUpdate?.();
          } else if (name === 'clear_all_memories') {
            if (args?.confirmed) {
              const count = this.memoryService.clearAllMemories();
              result = { status: 'success', clearedCount: count };
              this.callbacks.onMemoryUpdate?.();
            } else {
              result = { status: 'aborted', message: 'User confirmation was not provided.' };
            }
          } else {
            // General System & Jarvis Tool Execution
            const toolExec = await this.toolService.executeTool(name, args || {});
            if (toolExec.success) {
              result = toolExec.result || { success: true, message: 'Completed' };
            } else {
              result = { success: false, error: toolExec.error || 'Operation failed' };
            }
            if (this.callbacks.onToolExecuted) {
              this.callbacks.onToolExecuted(toolExec);
            }
          }
        } catch (memErr: any) {
          console.error(`[REVA][TOOLS] Error executing tool ${name}:`, memErr);
          result = { status: 'error', message: memErr?.message || 'Failed to execute requested tool operation' };
        }

        functionResponses.push({
          name,
          id,
          response: { output: result },
        });
      }

      if (this.session && functionResponses.length > 0) {
        try {
          this.session.sendToolResponse({
            functionResponses,
          });
        } catch (toolSendErr) {
          console.error('[REVA][GEMINI] Error sending toolResponse:', toolSendErr);
        }
      }
    }

    // 2. Check for audio output in model turn
    const parts = message.serverContent?.modelTurn?.parts;
    if (parts && parts.length > 0) {
      this.proactiveService.markRevaSpeaking();
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.callbacks.onAudioData(part.inlineData.data);
        }
        if (part.text) {
          if (this.callbacks.onTranscript) {
            this.callbacks.onTranscript('reva', part.text);
          }
          WorkingMemoryService.getInstance().addTurn('reva', part.text);
          const updatedDiag = this.personality.analyzeTranscript('reva', part.text);
          if (this.callbacks.onEmotionUpdate) {
            this.callbacks.onEmotionUpdate(updatedDiag);
          }
        }
      }
    }

    // 3. User input transcription if available
    const userTurnParts = (message as any)?.serverContent?.userTurn?.parts;
    if (userTurnParts && userTurnParts.length > 0) {
      this.proactiveService.markUserSpeaking();
      for (const part of userTurnParts) {
        if (part.text) {
          const userText = part.text;
          if (this.callbacks.onTranscript) {
            this.callbacks.onTranscript('user', userText);
          }
          WorkingMemoryService.getInstance().addTurn('user', userText);

          // Deterministic memory extraction fallback to guarantee database synchronization
          this.extractExplicitVoiceMemory(userText);

          // Smart Memory Retrieval: Search relevant memories for current user utterance in background
          this.memoryService.searchMemories(userText, { limit: 6 }).then((results) => {
            if (this.callbacks.onMemoryRetrieval) {
              this.callbacks.onMemoryRetrieval(this.memoryService.getRetrievalDiagnostics());
            }
          }).catch(() => {});

          // Check for natural voice commands for proactive / quiet modes
          const voiceCmd = this.proactiveService.handleNaturalVoiceCommand(userText);
          if (voiceCmd.handled) {
            console.log(`[REVA][PROACTIVE] Natural voice command executed: ${voiceCmd.message}`);
            this.callbacks.onProactiveUpdate?.();
          }

          const updatedDiag = this.personality.analyzeTranscript('user', userText);
          if (this.callbacks.onEmotionUpdate) {
            this.callbacks.onEmotionUpdate(updatedDiag);
          }
        }
      }
    }

    // 4. Interruption detection
    if (message.serverContent?.interrupted) {
      console.log('[REVA][GEMINI] Model turn interrupted by user barge-in');
      this.callbacks.onInterrupted();
    }

    // 5. Turn completion
    if (message.serverContent?.turnComplete) {
      this.callbacks.onTurnComplete();
      // Asynchronous non-blocking background consolidation (does not impact voice latency)
      setTimeout(async () => {
        try {
          await MemoryConsolidationService.getInstance().consolidateMemories();
        } catch (_) {}
      }, 500);
    }
  }

  /**
   * Deterministic extraction of explicit voice memory commands:
   * e.g. "remember that I prefer dark interfaces" or "forget that I prefer dark interfaces"
   */
  private async extractExplicitVoiceMemory(text: string): Promise<void> {
    try {
      const lower = text.toLowerCase().trim();

      // Check "remember that..." or "remember my..." or "remember I..."
      const rememberMatch = lower.match(/\b(?:remember\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?)(.+)/i);
      if (rememberMatch && rememberMatch[1]) {
        let content = rememberMatch[1].trim();
        // Remove trailing punctuation
        content = content.replace(/[.?!\s]+$/, '');
        if (content.length > 3) {
          // Normalize 1st person pronouns if helpful, or store formatted statement
          let formattedContent = content;
          if (formattedContent.startsWith('i ')) {
            formattedContent = `The user ${formattedContent.substring(2)}`;
          } else if (formattedContent.startsWith('my ')) {
            formattedContent = `The user's ${formattedContent.substring(3)}`;
          }

          let category: MemoryCategory = 'PREFERENCE';
          if (/project|app|code|build|reva/i.test(formattedContent)) {
            category = 'PROJECT';
          } else if (/goal|plan|target|future/i.test(formattedContent)) {
            category = 'GOAL';
          } else if (/name|called|live|from|job/i.test(formattedContent)) {
            category = 'USER_PROFILE';
          }

          await this.memoryService.saveMemory({
            category,
            content: formattedContent,
            importance: 1.0,
            confidence: 0.98,
            source: 'voice_command',
          });
          await this.memoryService.syncUserProfile();
          this.callbacks.onMemoryUpdate?.();
        }
      }

      // Check "forget that..." or "forget about..."
      const forgetMatch = lower.match(/\b(?:forget\s+(?:that\s+|about\s+)?)(.+)/i);
      if (forgetMatch && forgetMatch[1]) {
        const query = forgetMatch[1].trim().replace(/[.?!\s]+$/, '');
        if (query.length > 2 && !query.includes('everything')) {
          await this.memoryService.handleVoiceMemoryCommand(`forget that ${query}`);
          this.callbacks.onMemoryUpdate?.();
        }
      }
    } catch (err) {
      console.error('[REVA][MEMORY] Voice memory extraction error:', err);
    }
  }

  public sendAudioChunk(base64Audio: string): void {
    if (!this.session || !this.isConnected) {
      return;
    }

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err) {
      console.error('[REVA][GEMINI] Error sending audio chunk to Gemini Live:', err);
      this.callbacks.onError(err);
    }
  }

  public sendTextMessage(text: string): void {
    if (!this.session || !this.isConnected) {
      return;
    }

    try {
      this.session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      });
    } catch (err) {
      console.error('[REVA][GEMINI] Error sending text prompt to Gemini Live:', err);
      this.callbacks.onError(err);
    }
  }

  public async close(): Promise<void> {
    this.isConnected = false;
    if (this.session) {
      try {
        console.log('[REVA][GEMINI] Closing Live session');
        await this.session.close();
      } catch (err) {
        console.error('[REVA][GEMINI] Error during session close:', err);
      } finally {
        this.session = null;
      }
    }
  }
}
