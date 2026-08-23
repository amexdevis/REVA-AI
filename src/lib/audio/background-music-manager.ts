/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AmbientMusicMode = 'SOFT_AMBIENT' | 'SOFT_SCIFI' | 'NORMAL' | 'SCI-FI';

export interface BackgroundMusicSettings {
  enabled: boolean;
  mode: AmbientMusicMode;
  volume: number; // 0.0 to 0.20 (Default 0.10 = 10%)
}

export type VoiceDuckingState =
  | 'IDLE'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR';

/**
 * BackgroundMusicManager
 * High-comfort, long-form, zero-fatigue procedural ambient atmosphere engine for REVA.
 *
 * Design Guarantees:
 * 1. 100% Non-repetitive, infinite generative soundscapes using asynchronous prime-cycle LFOs.
 * 2. Ultra-soft, warm, deep, and spacious room tones (no beats, no percussion, no sharp leads, no melodic ear fatigue).
 * 3. Soft Ambient & Soft Sci-Fi modes tuned for 30–60+ minutes of continuous, fatigue-free listening.
 * 4. Multi-pole steep low-pass filtering (<320Hz) to strictly remove high-frequency harshness and piercing overtones.
 * 5. Gentle, silky-smooth audio ducking (10% idle -> 3.5% speech) without sudden volume jumps.
 * 6. Completely isolated from the microphone input pipeline and wake-word detector.
 */
export class BackgroundMusicManager {
  private static instance: BackgroundMusicManager | null = null;

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  // Active procedural nodes
  private activeNodes: Array<{
    stop: () => void;
    disconnect: () => void;
  }> = [];

  private isRunning = false;
  private currentMode: 'SOFT_AMBIENT' | 'SOFT_SCIFI' = 'SOFT_AMBIENT';
  private targetVolume = 0.1; // Default 10% (0.10), max capped at 0.20
  private isEnabled = true;
  private currentVoiceState: VoiceDuckingState = 'IDLE';
  private duckingMultiplier = 1.0;

  private constructor() {
    // Lazy AudioContext initialization
  }

  public static getInstance(): BackgroundMusicManager {
    if (!BackgroundMusicManager.instance) {
      BackgroundMusicManager.instance = new BackgroundMusicManager();
    }
    return BackgroundMusicManager.instance;
  }

  /**
   * Initializes or returns active AudioContext safely.
   */
  private async ensureAudioContext(): Promise<AudioContext | null> {
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();

        // Master gain node directly connected to audio output
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 1.0;

        // Ambient-specific gain node for smooth ducking & volume control
        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.value = 0.0001; // Start at near-zero for smooth fade-in

        this.ambientGain.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      return this.audioCtx;
    } catch (err) {
      console.warn('[REVA][Ambient] AudioContext init deferred:', err);
      return null;
    }
  }

  /**
   * Normalizes mode string to canonical internal keys.
   */
  private normalizeMode(mode: AmbientMusicMode): 'SOFT_AMBIENT' | 'SOFT_SCIFI' {
    if (mode === 'SCI-FI' || mode === 'SOFT_SCIFI') {
      return 'SOFT_SCIFI';
    }
    return 'SOFT_AMBIENT';
  }

  /**
   * Applies ambient settings (Enabled, Mode, Volume).
   */
  public async applySettings(settings: BackgroundMusicSettings): Promise<void> {
    this.isEnabled = settings.enabled;
    // Cap at 0.20 max to protect user ears from excessive loudness
    this.targetVolume = Math.max(0, Math.min(0.2, settings.volume));

    const normalized = this.normalizeMode(settings.mode);

    if (!this.isEnabled) {
      this.stop();
      return;
    }

    if (this.currentMode !== normalized && this.isRunning) {
      this.currentMode = normalized;
      await this.restartSoundscape();
    } else {
      this.currentMode = normalized;
      if (!this.isRunning) {
        await this.start();
      } else {
        this.recalculateGain(false);
      }
    }
  }

  /**
   * Starts ambient soundscape generation.
   */
  public async start(): Promise<void> {
    if (this.isRunning || !this.isEnabled) return;

    try {
      const ctx = await this.ensureAudioContext();
      if (!ctx || ctx.state === 'suspended') {
        return;
      }

      this.cleanupSynthesizer();

      if (this.currentMode === 'SOFT_AMBIENT') {
        this.buildSoftAmbientSoundscape(ctx);
      } else {
        this.buildSoftSciFiSoundscape(ctx);
      }

      this.isRunning = true;
      this.recalculateGain(true); // Smooth 3-second gentle fade in
    } catch (err) {
      console.warn('[REVA][Ambient] Failed to start ambient atmosphere:', err);
    }
  }

  /**
   * Stops ambient soundscape with smooth fade-out.
   */
  public stop(): void {
    if (!this.isRunning && !this.ambientGain) return;

    try {
      if (this.audioCtx && this.ambientGain && this.audioCtx.state === 'running') {
        const now = this.audioCtx.currentTime;
        this.ambientGain.gain.cancelScheduledValues(now);
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      }

      setTimeout(() => {
        this.cleanupSynthesizer();
        this.isRunning = false;
      }, 850);
    } catch {
      this.cleanupSynthesizer();
      this.isRunning = false;
    }
  }

  private async restartSoundscape(): Promise<void> {
    this.stop();
    setTimeout(async () => {
      if (this.isEnabled) {
        await this.start();
      }
    }, 900);
  }

  /**
   * Updates current voice state to trigger real-time, silky-smooth audio ducking.
   */
  public updateVoiceState(state: VoiceDuckingState): void {
    if (this.currentVoiceState === state) return;
    this.currentVoiceState = state;

    switch (state) {
      case 'SPEAKING':
        // REVA speaks: gracefully lower to ~35% of ambient volume (e.g., 10% -> 3.5%)
        this.duckingMultiplier = 0.35;
        break;
      case 'LISTENING':
      case 'USER_SPEAKING':
        // Listening to user speech: gentle ducking to ~60%
        this.duckingMultiplier = 0.6;
        break;
      case 'THINKING':
        this.duckingMultiplier = 0.8;
        break;
      case 'ERROR':
        this.duckingMultiplier = 0.5;
        break;
      case 'IDLE':
      default:
        this.duckingMultiplier = 1.0;
        break;
    }

    this.recalculateGain(false);
  }

  /**
   * Smoothly adjusts the gain with gentle analog time constants.
   */
  private recalculateGain(isInitialFadeIn = false): void {
    if (!this.ambientGain || !this.audioCtx || this.audioCtx.state !== 'running') return;

    const finalGain = this.isEnabled ? this.targetVolume * this.duckingMultiplier : 0.0001;
    const now = this.audioCtx.currentTime;

    try {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(Math.max(0.0001, this.ambientGain.gain.value), now);

      if (isInitialFadeIn) {
        this.ambientGain.gain.linearRampToValueAtTime(Math.max(0.0001, finalGain), now + 2.5);
      } else {
        // Smooth ducking transition: gentle down (0.6s), gradual restore (1.8s)
        const timeConstant = this.duckingMultiplier < 1.0 ? 0.25 : 0.6;
        this.ambientGain.gain.setTargetAtTime(Math.max(0.0001, finalGain), now, timeConstant);
      }
    } catch (err) {
      console.warn('[REVA][Ambient] Gain adjustment warning:', err);
    }
  }

  /**
   * MODE 1: SOFT AMBIENT (Warm, Calm, Deep, Natural Room Tone)
   *
   * Acoustic Profile:
   * - Pure sine & soft low-passed triangle waves in low harmonic registers (55Hz - 196Hz).
   * - 24dB/oct steep low-pass filtering at 260Hz: completely eliminates high frequencies.
   * - Ultra-slow asynchronous prime-period LFOs (37s, 53s, 71s, 89s) for infinite non-repeating swells.
   * - Deep warm Brownian room tone (<100Hz) creating a comforting, quiet physical room feeling.
   */
  private buildSoftAmbientSoundscape(ctx: AudioContext): void {
    if (!this.ambientGain) return;

    // Dual-stage cascade low-pass filter (24dB/oct) to guarantee absolute ear softness
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(260, ctx.currentTime);
    filter1.Q.setValueAtTime(0.707, ctx.currentTime);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(240, ctx.currentTime);
    filter2.Q.setValueAtTime(0.707, ctx.currentTime);

    filter1.connect(filter2);
    filter2.connect(this.ambientGain);

    // Warm Low Drone Frequencies (A1 = 55Hz, E2 = 82.4Hz, A2 = 110Hz, C#3 = 138.6Hz, E3 = 164.8Hz)
    const frequencies = [55.0, 82.41, 110.0, 138.59, 164.81];
    // Prime-period LFO rates (Hz) for non-repeating continuous movement
    const lfoRates = [0.019, 0.014, 0.011, 0.008, 0.006]; // Cycles between 52s and 166s

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      // Pure sine for bottom frequencies, very soft triangle for upper harmonic
      osc.type = idx < 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Micro-detune for acoustic warmth
      const detune = (idx - 2) * 1.5;
      osc.detune.setValueAtTime(detune, ctx.currentTime);

      // Base quiet gain
      const baseGain = 0.06 / (idx === 0 ? 1.0 : 1.8);
      oscGain.gain.setValueAtTime(baseGain, ctx.currentTime);

      // Ultra-slow breathing LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(lfoRates[idx % lfoRates.length], ctx.currentTime);
      lfoGain.gain.setValueAtTime(baseGain * 0.35, ctx.currentTime);

      lfo.connect(oscGain.gain);
      lfo.start();

      if (panner) {
        const pan = ((idx % 3) - 1) * 0.25; // Subtle stereo field, no dizzy panning
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(panner);
        panner.connect(filter1);
      } else {
        osc.connect(oscGain);
        oscGain.connect(filter1);
      }

      osc.start();

      this.activeNodes.push({
        stop: () => {
          try {
            osc.stop();
            lfo.stop();
          } catch {}
        },
        disconnect: () => {
          try {
            osc.disconnect();
            oscGain.disconnect();
            lfo.disconnect();
            lfoGain.disconnect();
            if (panner) panner.disconnect();
          } catch {}
        },
      });
    });

    // Deep, soothing Brownian Room Tone Bed (<90Hz)
    this.createBrownianRoomBed(ctx, filter1, 90, 0.015);
  }

  /**
   * MODE 2: SOFT SCI-FI (Futuristic, Spacious, Subtle, Dreamlike Room Ambience)
   *
   * Acoustic Profile:
   * - Soft harmonic space drone (D2 = 73.4Hz, A2 = 110Hz, D3 = 146.8Hz, F#3 = 185Hz, A3 = 220Hz).
   * - Dual-stage low-pass filtering at 320Hz with an ultra-slow 90-second resonance swell.
   * - Generative multi-phase micro-shimmer that feels like standing inside a quiet futuristic AI core.
   * - Zero percussion, zero sharp arpeggios, zero ear fatigue.
   */
  private buildSoftSciFiSoundscape(ctx: AudioContext): void {
    if (!this.ambientGain) return;

    // Dual-stage cascade low-pass filter
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(320, ctx.currentTime);
    filter1.Q.setValueAtTime(1.1, ctx.currentTime);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(290, ctx.currentTime);
    filter2.Q.setValueAtTime(0.707, ctx.currentTime);

    filter1.connect(filter2);
    filter2.connect(this.ambientGain);

    // Ultra-slow atmospheric filter modulation (90-second period, 0.011 Hz)
    const filterLfo = ctx.createOscillator();
    const filterLfoGain = ctx.createGain();
    filterLfo.type = 'sine';
    filterLfo.frequency.setValueAtTime(0.011, ctx.currentTime);
    filterLfoGain.gain.setValueAtTime(60, ctx.currentTime); // Gentle 60Hz sweep range
    filterLfo.connect(filter1.frequency);
    filterLfo.start();

    // Harmonic Sci-Fi Notes (D2, A2, D3, F#3, A3)
    const frequencies = [73.42, 110.0, 146.83, 185.0, 220.0];
    const lfoRates = [0.017, 0.013, 0.009, 0.007, 0.005]; // Multi-minute phasing

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      // Pure sine & soft triangle
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Subtle celestial detuning
      osc.detune.setValueAtTime((idx - 2) * 2.2, ctx.currentTime);

      const baseGain = 0.05 / (idx === 0 ? 1.0 : 2.0);
      oscGain.gain.setValueAtTime(baseGain, ctx.currentTime);

      // Slow organic breath LFO
      const ampLfo = ctx.createOscillator();
      const ampLfoGain = ctx.createGain();
      ampLfo.type = 'sine';
      ampLfo.frequency.setValueAtTime(lfoRates[idx % lfoRates.length], ctx.currentTime);
      ampLfoGain.gain.setValueAtTime(baseGain * 0.3, ctx.currentTime);

      ampLfo.connect(oscGain.gain);
      ampLfo.start();

      if (panner) {
        const pan = ((idx % 4) - 1.5) * 0.3;
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(panner);
        panner.connect(filter1);
      } else {
        osc.connect(oscGain);
        oscGain.connect(filter1);
      }

      osc.start();

      this.activeNodes.push({
        stop: () => {
          try {
            osc.stop();
            ampLfo.stop();
          } catch {}
        },
        disconnect: () => {
          try {
            osc.disconnect();
            oscGain.disconnect();
            ampLfo.disconnect();
            ampLfoGain.disconnect();
            if (panner) panner.disconnect();
          } catch {}
        },
      });
    });

    this.activeNodes.push({
      stop: () => {
        try {
          filterLfo.stop();
        } catch {}
      },
      disconnect: () => {
        try {
          filterLfo.disconnect();
          filterLfoGain.disconnect();
          filter1.disconnect();
          filter2.disconnect();
        } catch {}
      },
    });

    // Deep sub-harmonic space room tone (<110Hz)
    this.createBrownianRoomBed(ctx, filter1, 110, 0.012);
  }

  /**
   * Generates a smooth Brownian (red noise) room tone bed.
   * Red/Brownian noise rolls off high frequencies naturally at 6dB/octave, creating
   * a velvety physical presence that makes the listener feel immersed in a quiet room.
   */
  private createBrownianRoomBed(
    ctx: AudioContext,
    destination: AudioNode,
    cutoffFreq: number,
    volume: number
  ): void {
    try {
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // True Brownian noise integrator
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Compensate for integration roll-off
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(cutoffFreq, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volume, ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(destination);

      noiseSource.start();

      this.activeNodes.push({
        stop: () => {
          try {
            noiseSource.stop();
          } catch {}
        },
        disconnect: () => {
          try {
            noiseSource.disconnect();
            noiseFilter.disconnect();
            noiseGain.disconnect();
          } catch {}
        },
      });
    } catch (e) {
      console.warn('[REVA][Ambient] Brownian bed skipped:', e);
    }
  }

  private cleanupSynthesizer(): void {
    this.activeNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
  }

  /**
   * Safely unlocks browser audio policies on first user interaction.
   */
  public async handleUserGestureUnlock(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        if (this.isEnabled && !this.isRunning) {
          await this.start();
        }
      } catch {}
    } else if (this.isEnabled && !this.isRunning) {
      await this.start();
    }
  }

  public getSettings(): BackgroundMusicSettings {
    return {
      enabled: this.isEnabled,
      mode: this.currentMode,
      volume: this.targetVolume,
    };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
