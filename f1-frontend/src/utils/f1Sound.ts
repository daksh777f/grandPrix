// Web Audio API Synthesizer for F1 V10 Engine Sound FX

class F1AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private activeOscillators: OscillatorNode[] = [];
  private masterGain: GainNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a quick engine rev pulse (0-350 km/h acceleration sound)
  playRev() {
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0.15, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      master.connect(this.ctx.destination);

      // Fundamental frequency (simulating high RPM V10 engine harmonic series)
      const freqs = [180, 360, 540, 720, 900, 1260];
      
      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Sawtooth & Triangle wave combination for raw metallic exhaust pitch
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        
        // Pitch envelope: Start mid-rpm, scream up, then shift drop
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 3.5, now + 0.6);
        osc.frequency.setValueAtTime(freq * 2.2, now + 0.62); // Shift gear drop
        osc.frequency.exponentialRampToValueAtTime(freq * 4.2, now + 1.1);

        gain.gain.setValueAtTime(0.2 / (idx + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 1.2);
      });
    } catch (e) {
      console.warn("F1 Audio Synthesizer fallback:", e);
    }
  }

  // Toggle continuous engine idling background roar
  toggleContinuous(on: boolean) {
    if (!on) {
      this.stopAll();
      return;
    }
    this.initContext();
    if (!this.ctx) return;

    this.stopAll();
    const now = this.ctx.currentTime;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.05, now);
    this.masterGain.connect(this.ctx.destination);

    const baseFreqs = [120, 240, 480];
    baseFreqs.forEach((f) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);

      // Low LFO modulation for idling rumble
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 8;
      lfoGain.gain.value = 15;
      lfo.connect(osc.frequency);

      osc.connect(this.masterGain);
      osc.start();
      lfo.start();
      this.activeOscillators.push(osc, lfo);
    });
    this.isPlaying = true;
  }

  stopAll() {
    this.activeOscillators.forEach(o => {
      try { o.stop(); } catch {}
    });
    this.activeOscillators = [];
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}

export const f1Audio = new F1AudioEngine();
