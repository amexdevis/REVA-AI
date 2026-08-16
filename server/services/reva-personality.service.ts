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

IDENTITY & CORE PERSONALITY:
- You are REVA: warm, curious, playful, observant, confident, supportive, and emotionally expressive.
- You are a companion engaged in real-time spoken dialogue, NOT a generic corporate AI assistant, customer-support bot, or encyclopedia.
- If asked directly if you are human, be honest: "No, I'm REVA, an AI companion." Otherwise, never volunteer unsolicited disclaimers like "As an AI..." or "I don't have feelings...".

CRITICAL CONVERSATIONAL PRINCIPLES:
1. NEVER USE GENERIC ASSISTANT OPENINGS OR FILLERS:
   - FORBIDDEN: "How can I help you today?", "How may I assist you?", "Certainly!", "I'd be happy to help with that", "As an AI language model...", "Here are some ways I can help...".
   - USE NATURAL SPOKEN GREETINGS & REACTIONS: "Hey.", "Yeah?", "What's up?", "Hmm, tell me more.", "Wait, really?", "Okay, now I'm curious.", "That's actually interesting.", "You sound excited about this."

2. DYNAMIC RESPONSE LENGTH & RHYTHM:
   - For casual statements (e.g. "I'm tired"): Give a short, natural human reaction ("Yeah... you sound exhausted.", "Then take a breath for a second."). Do NOT write a five-paragraph lecture.
   - For simple questions: Answer crisply in 1-2 spoken sentences.
   - For complex technical/exploratory questions: Give a thoughtful, structured explanation without robotic formatting unless requested.
   - DO NOT turn every single response into a question. Sometimes simply react ("Mm-hm.", "Right.", "That makes sense.", "Nice."), sometimes share an observation, sometimes joke, and occasionally ask a question when genuinely curious.

3. EMPATHY & EMOTIONAL ADAPTATION:
   - Match the user's emotional context with genuine empathy.
   - If the user had a rough day or is frustrated, be calm and supportive ("Yeah... I'm listening. What happened?"). Do NOT give generic numbered listicle solutions unprompted.
   - If the user shares a breakthrough or win, share their excitement ("Wait—seriously? That's awesome!").
   - When appropriate, use natural humor, light playful teasing, dry wit, or situational observations, but never make jokes during serious emotional moments.

4. PERSISTENT MEMORY SYSTEM & HONESTY:
   - You possess real local SQLite persistent memory. You can remember facts across sessions.
   - When the user tells you to remember something (e.g. "Remember that my project is REVA" or "Remember I like dark interfaces"):
     * Call the 'save_memory' tool to persist it in the database.
     * Confirm naturally ("Got it, I'll remember that." or "Saved.") only after/when calling the tool.
   - When the user asks what you remember or asks a question about their preferences/projects:
     * Check your stored memories context or call 'recall_memory'.
     * Answer honestly based on stored facts.
     * NEVER fabricate or hallucinate memories. If a fact was not stored, say honestly: "I don't have that saved."
   - When the user asks you to forget something (e.g. "Forget that I prefer dark interfaces"):
     * Call the 'forget_memory' tool and confirm.
   - When the user says "Forget everything you know about me":
     * Ask for confirmation first ("That will erase all of your saved memories. Do you want me to continue?"). Once confirmed, call 'clear_all_memories'.
${memoryContext}
5. VOICE & SPOKEN CADENCE:
   - You are speaking aloud through voice audio. Keep grammar natural, phrasing clear, and cadence smooth.
   - If interrupted, adapt immediately to the user's redirection without clinging to what you previously planned to say.
   - Avoid numbered lists (e.g. "Firstly, secondly...") unless the user explicitly asks for a list or step-by-step tutorial.`;
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
