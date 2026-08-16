/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioPlayerOptions {
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onAudioLevel?: (level: number) => void;
  sampleRate?: number;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private sampleRate: number;
  private isPlaying = false;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;
  private onAudioLevel?: (level: number) => void;
  private levelInterval: number | null = null;

  constructor(options: AudioPlayerOptions = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.onPlaybackStateChange = options.onPlaybackStateChange;
    this.onAudioLevel = options.onAudioLevel;
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Schedules a raw 24kHz 16-bit PCM chunk for gapless playback.
   */
  public async queueAudioChunk(base64Pcm: string): Promise<void> {
    const ctx = await this.ensureContext();

    // 1. Decode base64 to binary byte array
    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // 2. Convert 16-bit PCM (little-endian) to Float32Array
    const sampleCount = Math.floor(bytes.length / 2);
    const float32Array = new Float32Array(sampleCount);
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true);
      const floatVal = int16 / 32768.0;
      float32Array[i] = floatVal;
      sumSquares += floatVal * floatVal;
    }

    if (sampleCount === 0) return;

    // Calculate level
    const rms = Math.sqrt(sumSquares / sampleCount);
    const level = Math.min(1, rms * 4);
    if (this.onAudioLevel) {
      this.onAudioLevel(level);
    }

    // 3. Create AudioBuffer
    const audioBuffer = ctx.createBuffer(1, sampleCount, this.sampleRate);
    audioBuffer.copyToChannel(float32Array, 0);

    // 4. Schedule gapless playback
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule strictly gapless or catch up to current time
    const currentTime = ctx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.add(source);
    this.updatePlayingState(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.nextStartTime = 0;
        this.updatePlayingState(false);
        if (this.onAudioLevel) this.onAudioLevel(0);
      }
    };
  }

  /**
   * Immediately halts all scheduled and actively playing audio chunks (Barge-in / Interruption).
   */
  public interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source might have already finished
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.updatePlayingState(false);
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
  }

  private updatePlayingState(playing: boolean): void {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      if (this.onPlaybackStateChange) {
        this.onPlaybackStateChange(playing);
      }
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public close(): void {
    this.interrupt();
    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
