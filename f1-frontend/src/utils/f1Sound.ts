// Audio Engine player for F1.mp4 (Trimmed to start at 10 seconds)

const START_OFFSET_SECONDS = 10.0;

class F1AudioEngine {
  private audioCtx: AudioContext | null = null;
  private trimmedBuffer: AudioBuffer | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private isLoading = false;
  private fallbackAudio: HTMLAudioElement | null = null;


  constructor() {
    if (typeof window !== 'undefined') {
      // Pre-load audio buffer in the background
      this.loadAudioBuffer();
    }
  }

  private async loadAudioBuffer() {
    if (this.trimmedBuffer || this.isLoading || typeof window === 'undefined') return;
    this.isLoading = true;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();

      const res = await fetch('/F1.mp4');
      const arrayBuffer = await res.arrayBuffer();
      const fullBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

      // Cut out the first 10 seconds into a new buffer
      const sampleRate = fullBuffer.sampleRate;
      const startSample = Math.floor(START_OFFSET_SECONDS * sampleRate);
      const totalSamples = fullBuffer.length;

      if (totalSamples > startSample) {
        const trimmedLength = totalSamples - startSample;
        const channels = fullBuffer.numberOfChannels;
        const trimmed = this.audioCtx.createBuffer(channels, trimmedLength, sampleRate);

        for (let c = 0; c < channels; c++) {
          const srcData = fullBuffer.getChannelData(c);
          const dstData = trimmed.getChannelData(c);
          dstData.set(srcData.subarray(startSample));
        }
        this.trimmedBuffer = trimmed;
      } else {
        this.trimmedBuffer = fullBuffer;
      }
    } catch (e) {
      console.warn("Web Audio decode fallback to HTMLAudioElement:", e);
      this.initFallbackAudio();
    } finally {
      this.isLoading = false;
    }
  }

  private initFallbackAudio() {
    if (!this.fallbackAudio && typeof window !== 'undefined') {
      this.fallbackAudio = new Audio('/F1.mp4');
      this.fallbackAudio.volume = 0.75;
      this.fallbackAudio.addEventListener('ended', () => {
        if (this.isPlaying && this.fallbackAudio) {
          this.fallbackAudio.currentTime = START_OFFSET_SECONDS;
          this.fallbackAudio.play().catch(() => {});
        } else {
          this.isPlaying = false;
        }
      });
    }
  }

  // Play acceleration pulse from 10s cutout
  playRev() {
    if (this.audioCtx && this.trimmedBuffer) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.stopAll();

      const source = this.audioCtx.createBufferSource();
      const gain = this.audioCtx.createGain();
      source.buffer = this.trimmedBuffer;
      source.loop = false;
      gain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);

      source.connect(gain);
      gain.connect(this.audioCtx.destination);
      source.start(0);

      this.currentSource = source;
      this.isPlaying = true;
      source.onended = () => {
        this.isPlaying = false;
      };
      return;
    }

    // Fallback if buffer is still fetching
    this.initFallbackAudio();
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.currentTime = START_OFFSET_SECONDS;
        this.fallbackAudio.volume = 0.85;
        this.fallbackAudio.play().catch((e) => console.warn("Audio play prevented:", e));
        this.isPlaying = true;
      } catch (e) {
        console.warn("Playback error:", e);
      }
    }
  }

  // Toggle continuous playback starting at 10s mark with seamless loop
  toggleContinuous(on: boolean) {
    if (!on) {
      this.stopAll();
      return;
    }

    if (this.audioCtx && this.trimmedBuffer) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.stopAll();

      const source = this.audioCtx.createBufferSource();
      const gain = this.audioCtx.createGain();
      source.buffer = this.trimmedBuffer;
      source.loop = true;
      gain.gain.setValueAtTime(0.75, this.audioCtx.currentTime);

      source.connect(gain);
      gain.connect(this.audioCtx.destination);
      source.start(0);

      this.currentSource = source;
      this.isPlaying = true;
      return;
    }

    // Fallback HTMLAudioElement
    this.initFallbackAudio();
    if (this.fallbackAudio) {
      try {
        if (this.fallbackAudio.currentTime < START_OFFSET_SECONDS) {
          this.fallbackAudio.currentTime = START_OFFSET_SECONDS;
        }
        this.fallbackAudio.volume = 0.75;
        this.fallbackAudio.play().catch((e) => console.warn("Audio play prevented:", e));
        this.isPlaying = true;
      } catch (e) {
        console.warn("Playback error:", e);
      }
    }
  }

  stopAll() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = START_OFFSET_SECONDS;
      } catch {}
    }
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

export const f1Audio = new F1AudioEngine();


