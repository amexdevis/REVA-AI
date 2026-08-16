/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioRecorderOptions {
  onAudioData: (base64Pcm: string, level: number) => void;
  onError: (err: Error) => void;
  targetSampleRate?: number;
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRecording = false;
  private isPaused = false;
  private targetSampleRate: number;
  private onAudioData: (base64Pcm: string, level: number) => void;
  private onError: (err: Error) => void;

  constructor(options: AudioRecorderOptions) {
    this.targetSampleRate = options.targetSampleRate || 16000;
    this.onAudioData = options.onAudioData;
    this.onError = options.onError;
  }

  public async start(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      // Real microphone request with hardware acoustic protections
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      // Buffer size 4096 gives ~85ms chunks at 48kHz, suitable for low-latency streaming
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRecording || this.isPaused) {
          return;
        }

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const inputSampleRate = this.audioContext?.sampleRate || 48000;

        // Compute RMS level for UI visualization
        let sumSquares = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          sumSquares += inputChannelData[i] * inputChannelData[i];
        }
        const rms = Math.sqrt(sumSquares / inputChannelData.length);
        const normalizedLevel = Math.min(1, rms * 5); // Normalized 0..1

        // Resample input buffer to 16kHz
        const resampledData = this.resampleToTarget(inputChannelData, inputSampleRate, this.targetSampleRate);

        // Convert Float32Array to 16-bit PCM little-endian
        const pcm16Buffer = this.floatTo16BitPCM(resampledData);

        // Convert to Base64
        const base64 = this.arrayBufferToBase64(pcm16Buffer);

        this.onAudioData(base64, normalizedLevel);
      };

      this.sourceNode.connect(this.processorNode);
      // Connect to destination to keep audio process alive, muted via 0-gain or processor destination
      this.processorNode.connect(this.audioContext.destination);

      this.isRecording = true;
      this.isPaused = false;
    } catch (err: any) {
      this.stop();
      this.onError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public stop(): void {
    this.isRecording = false;
    this.isPaused = false;

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /**
   * Resamples raw Float32 audio data using linear interpolation.
   */
  private resampleToTarget(
    inputData: Float32Array,
    inputRate: number,
    targetRate: number
  ): Float32Array {
    if (inputRate === targetRate) {
      return inputData;
    }

    const ratio = inputRate / targetRate;
    const newLength = Math.round(inputData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const frac = position - index;

      const sample0 = inputData[index] ?? 0;
      const sample1 = inputData[index + 1] ?? sample0;

      result[i] = sample0 + frac * (sample1 - sample0);
    }

    return result;
  }

  /**
   * Converts Float32Array (-1.0 to 1.0) to 16-bit PCM little-endian ArrayBuffer.
   */
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      // Clamp and map to 16-bit signed integer (-32768 to 32767)
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, val, true); // true for Little-Endian
    }

    return buffer;
  }

  /**
   * Encodes an ArrayBuffer into a Base64 string.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
