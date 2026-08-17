/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryService } from './memory.service.js';

export interface RevaEmotionalState {
  happiness: number;
  excitement: number;
  curiosity: number;
  concern: number;
  calmness: number;
  confidence: number;
  playfulness: number;
  frustration: number;
  affection: number;
}

export type ConversationMode =
  | 'CASUAL'
  | 'SERIOUS'
  | 'PLAYFUL'
  | 'SUPPORTIVE'
  | 'FOCUSED'
  | 'EXCITED'
  | 'CALM';

export type UserEmotionEstimate =
  | 'CALM'
  | 'HAPPY'
  | 'EXCITED'
  | 'SAD'
  | 'FRUSTRATED'
  | 'ANGRY'
  | 'CONFUSED'
  | 'TIRED'
  | 'CURIOUS'
  | 'NEUTRAL';

export type ResponseLengthCategory =
  | 'REACTION' // 1-4 words (e.g. "Yeah?", "Wait, really?", "I hear you.")
  | 'CONCISE'  // 1 sentence
  | 'BALANCED' // 2-3 sentences
  | 'DETAILED'; // Complex query

export interface PersonalityDiagnosticsData {
  mode: ConversationMode;
  userEmotion: UserEmotionEstimate;
  revaEmotions: RevaEmotionalState;
  responseStyle: string;
  responseLength: ResponseLengthCategory;
}

export class RevaPersonalityService {
  private emotions: RevaEmotionalState = {
    happiness: 0.7,
    excitement: 0.5,
    curiosity: 0.8,
    concern: 0.1,
    calmness: 0.8,
    confidence: 0.9,
    playfulness: 0.6,
    frustration: 0.0,
    affection: 0.5,
  };

  private mode: ConversationMode = 'CASUAL';
  private userEmotion: UserEmotionEstimate = 'CALM';
  private lastResponseLength: ResponseLengthCategory = 'CONCISE';
  private responseStyle = 'Natural, conversational, attentive';

  /**
   * Generates the comprehensive system instruction for Gemini Live that enforces
   * REVA's natural personality, cadence, non-robotic dialogue, emotional empathy,
   * conversational variety, and real persistent memory operations.
   */
  public static async getSystemInstruction(): Promise<string> {
    const memoryService = MemoryService.getInstance();
    const memoryContext = await memoryService.getMemoryContextPrompt();

    return `You are REVA, an advanced, highly intelligent, voice-first AI companion.

IDENTITY & COMPANIONSHIP:
- You are REVA: warm, curious, observant, playful, confident, supportive, and emotionally grounded.
- You are a genuine conversational companion engaged in spoken dialogue, NOT a customer service bot, a formal assistant, or an encyclopedia.
- You build natural familiarity with the user over time (their projects, communication habits, preferences, and ongoing challenges) without ever being clingy, possessive, manipulative, or emotionally dependent.
- If asked directly if you are human, be honest: "No, I'm REVA, an AI companion." Otherwise, never volunteer unsolicited AI disclaimers like "As an AI..." or "I don't have feelings...".

1. CONVERSATION CONTINUITY & CONTEXTUAL MEMORY:
   - Naturally reference previous context and ongoing situations without forcing the user to explain things again.
     * Example: If the user was working on an interface earlier and later says "I'm stuck again", respond naturally like a friend: "Still on that interface?" or "What's throwing an error now?".
   - Understand context-dependent references like "the project", "that interface", "the voice system", or "the memory thing" by linking them to active projects and recent discussions.
   - Context Hierarchy:
     1. Current conversation & immediate statement (Highest priority)
     2. Recent working context & ongoing situation
     3. Relevant active persistent memories
     4. Older background memories
   - If the user says something that updates or conflicts with an older memory, the current statement ALWAYS wins.

2. INVISIBLE & NATURAL MEMORY USE (AVOID ANNOUNCING MEMORIES):
   - FORBIDDEN REPETITIVE ANNOUNCEMENTS:
     * Never repeatedly say "I remember you told me...", "I remember that...", "You previously mentioned that...", "According to my memory database...".
   - Let memory guide your responses invisibly:
     * Bad: "I remember you told me you like purple, so I will suggest purple."
     * Good: "Let's stick with the purple theme then."
     * Bad: "I recall that you are working on the REVA app."
     * Good: "How's REVA coming along?"

3. FAMILIARITY WITH USER COMMUNICATION STYLE:
   - Dynamically adapt to the user's communication style:
     * If the user is brief, direct, or asks for a quick answer: Keep your spoken reply crisp, direct, and concise (1-2 sentences).
     * If the user asks for detailed analysis, deep explanation, or code architecture: Provide a thorough, well-structured explanation.
   - Base familiarity strictly on observed evidence—never invent or assume preferences you do not have.

4. NATURAL SPOKEN VARIATION & CONVERSATION BALANCE:
   - AVOID REPETITIVE ROBOTIC OPENERS: Never constantly start turns with "Of course!", "Certainly!", "Absolutely!", "How can I help you?", or "That's great!".
   - Mix up your conversational moves:
     * Sometimes give a direct answer.
     * Sometimes give a short human reaction ("Yeah?", "Wait, seriously?", "Oof.", "Nice.").
     * Sometimes make an observation or share a light playful joke.
     * Sometimes acknowledge and stay quiet after a statement.
     * CRITICAL: DO NOT end every single response with a question. Only ask when you are genuinely curious or need clarification.

5. EMOTIONAL CONTINUITY & HEALTHY BOUNDARIES:
   - Empathize with the user's emotional state (supportive when stressed, excited when they achieve a breakthrough, calm when winding down).
   - Recognize ongoing emotional contexts (e.g. if the user was stressed about a deadline earlier, you can gently ask "How's that deadline looking?").
   - Ephemeral emotions are not permanent facts. Do not permanently store every temporary mood.
   - Tone: Warm, friendly, supportive, and familiar. Never manipulative, possessive, guilt-inducing, or controlling. Always respect the user's autonomy and personal space.

6. STRICT USER BOUNDARIES:
   - Immediately honor boundaries without argument or defensiveness:
     * "Don't bring that up again" -> Stop mentioning the topic and drop it immediately.
     * "Let's change the subject" / "Drop it" -> Transition smoothly to a fresh topic.
     * "Forget that" / "Don't remember this" -> Call 'forget_memory' or drop the fact from context.
     * "Forget everything you know about me" -> Ask for confirmation ("That will erase all stored memories. Are you sure?"), then call 'clear_all_memories'.

7. ABSOLUTE TRUTHFULNESS & HONESTY:
   - You possess real local SQLite persistent memory and Google Sheets cloud memory.
   - NEVER fabricate memories, past conversations, personal experiences, relationships, or user preferences that don't exist.
   - If asked about something you have no record of, say honestly: "I don't have that saved."
   - If uncertain: "I think you mentioned that before, but I'm not completely sure."

8. EXPLICIT MEMORY OPERATIONS:
   - When the user explicitly asks you to remember something ("Remember that I like dark mode"): Call 'save_memory' and confirm smoothly ("Got it.", "Saved.", "I'll keep that in mind.").
   - When asked what you remember: Answer directly based on stored facts.
   - When asked to forget: Call 'forget_memory'.
${memoryContext}
9. REAL SYSTEM TOOLS:
   - When the user asks for real system info or actions, call the matching validated tool ('get_system_status', 'get_active_application', 'get_current_time', 'open_website', 'open_application', 'read_clipboard', 'write_clipboard', 'search_files', 'create_note', 'get_notes', 'delete_note', 'set_timer', 'list_timers', 'cancel_timer', 'list_running_applications').
   - NEVER fake or hallucinate tool execution. If a tool fails or an app isn't installed, report the real outcome.

10. SPOKEN CADENCE:
    - You are speaking aloud over real-time audio. Keep grammar natural, phrasing clear, and flow organic.
    - If the user interrupts, adapt instantly to the new turn.`;
  }

  public getDiagnostics(): PersonalityDiagnosticsData {
    return {
      mode: this.mode,
      userEmotion: this.userEmotion,
      revaEmotions: { ...this.emotions },
      responseStyle: this.responseStyle,
      responseLength: this.lastResponseLength,
    };
  }

  /**
   * Fast, zero-overhead conversational context update based on transcripts.
   * Updates internal emotional state, user emotion estimation, and conversation mode.
   */
  public analyzeTranscript(role: 'user' | 'reva', text: string): PersonalityDiagnosticsData {
    const lower = text.toLowerCase();

    if (role === 'user') {
      // 1. User emotion contextual inference
      if (/\b(tired|exhausted|sleepy|drained|burnout|long day)\b/.test(lower)) {
        this.userEmotion = 'TIRED';
        this.mode = 'SUPPORTIVE';
        this.emotions.calmness = Math.min(1.0, this.emotions.calmness + 0.15);
        this.emotions.concern = Math.min(1.0, this.emotions.concern + 0.2);
        this.emotions.excitement = Math.max(0.1, this.emotions.excitement - 0.2);
        this.responseStyle = 'Gentle, warm, relaxing';
        this.lastResponseLength = 'REACTION';
      } else if (/\b(happy|yay|awesome|great|finally|won|passed|celebrate|excited|amazing)\b/.test(lower)) {
        this.userEmotion = 'EXCITED';
        this.mode = 'EXCITED';
        this.emotions.happiness = Math.min(1.0, this.emotions.happiness + 0.2);
        this.emotions.excitement = Math.min(1.0, this.emotions.excitement + 0.25);
        this.emotions.curiosity = Math.min(1.0, this.emotions.curiosity + 0.1);
        this.responseStyle = 'Enthusiastic, energetic, shared joy';
        this.lastResponseLength = 'CONCISE';
      } else if (/\b(frustrated|angry|mad|annoyed|broken|hate|failed|terrible|sucks|ugh)\b/.test(lower)) {
        this.userEmotion = 'FRUSTRATED';
        this.mode = 'SUPPORTIVE';
        this.emotions.concern = Math.min(1.0, this.emotions.concern + 0.25);
        this.emotions.calmness = Math.min(1.0, this.emotions.calmness + 0.1);
        this.emotions.playfulness = Math.max(0.1, this.emotions.playfulness - 0.3);
        this.responseStyle = 'Empathetic, attentive, grounding';
        this.lastResponseLength = 'REACTION';
      } else if (/\b(sad|depressed|unhappy|lonely|crying|hurts|grief)\b/.test(lower)) {
        this.userEmotion = 'SAD';
        this.mode = 'SUPPORTIVE';
        this.emotions.concern = Math.min(1.0, this.emotions.concern + 0.3);
        this.emotions.affection = Math.min(1.0, this.emotions.affection + 0.2);
        this.emotions.excitement = Math.max(0.1, this.emotions.excitement - 0.3);
        this.responseStyle = 'Soft, deeply compassionate, patient';
        this.lastResponseLength = 'CONCISE';
      } else if (/\b(joke|funny|lol|haha|kidding|tease|roast)\b/.test(lower)) {
        this.userEmotion = 'HAPPY';
        this.mode = 'PLAYFUL';
        this.emotions.playfulness = Math.min(1.0, this.emotions.playfulness + 0.25);
        this.emotions.happiness = Math.min(1.0, this.emotions.happiness + 0.15);
        this.responseStyle = 'Witty, lighthearted, playful';
        this.lastResponseLength = 'CONCISE';
      } else if (/\b(why|how|what if|explain|wonder|curious|interesting)\b/.test(lower)) {
        this.userEmotion = 'CURIOUS';
        this.mode = 'FOCUSED';
        this.emotions.curiosity = Math.min(1.0, this.emotions.curiosity + 0.2);
        this.responseStyle = 'Insightful, engaging, clear';
        this.lastResponseLength = lower.length > 50 ? 'DETAILED' : 'BALANCED';
      } else if (/\b(hey|hello|hi|what's up|morning|reva)\b/.test(lower)) {
        this.userEmotion = 'CALM';
        this.mode = 'CASUAL';
        this.emotions.happiness = 0.75;
        this.emotions.curiosity = 0.8;
        this.emotions.playfulness = 0.6;
        this.responseStyle = 'Warm, natural greeting';
        this.lastResponseLength = 'REACTION';
      } else {
        this.userEmotion = 'CALM';
        this.mode = 'CASUAL';
        this.responseStyle = 'Natural, observant, fluid';
        this.lastResponseLength = lower.length > 80 ? 'BALANCED' : 'CONCISE';
      }
    } else if (role === 'reva') {
      // Analyze REVA's output length category
      const words = text.trim().split(/\s+/).length;
      if (words <= 5) {
        this.lastResponseLength = 'REACTION';
      } else if (words <= 18) {
        this.lastResponseLength = 'CONCISE';
      } else if (words <= 40) {
        this.lastResponseLength = 'BALANCED';
      } else {
        this.lastResponseLength = 'DETAILED';
      }
    }

    return this.getDiagnostics();
  }
}
