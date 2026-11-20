/**
 * js/audio/soundSynthesizer.js
 * Procedural Web Audio API Sound Synthesizer for 2011 Thầy Nam Physics Tribute
 * 
 * 100% Procedural Audio Synthesis - Zero External Audio Files:
 * - Chalk writing friction & impact clicks on slate blackboard
 * - Aerodynamic projectile flight whistling & wind noise
 * - Planetary Kepler gravitational slingshot resonance hum
 * - Relativistic Schwarzschild black hole implosion (sub-bass + swirling flanger)
 * - Supernova cosmic explosion (distorted noise burst + sub-bass boom + 3s exponential decay)
 * - Felt cloth eraser dragging & pink noise dust wipe
 * - Vintage Kraft paper rustle & wax seal fracture
 * 
 * Complies with Google Antigravity Architecture & Physics Standards.
 */

export class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.isInitialized = false;
    this.volume = 0.8;

    // Cached noise buffers
    this.whiteNoiseBuffer = null;
    this.pinkNoiseBuffer = null;

    // Continuous sound nodes
    this.activeEraserSource = null;
    this.eraserFilter = null;
    this.eraserGain = null;

    this.activeFlightWindSource = null;
    this.flightWindFilter = null;
    this.flightWindGain = null;
    this.flightWindOsc = null;

    this.activeSlingshotSource = null;
    this.slingshotGain = null;
    this.slingshotOsc1 = null;
    this.slingshotOsc2 = null;
    this.slingshotFilter = null;
  }

  /**
   * Lazy initialization of AudioContext on user interaction.
   * Can accept an existing or mock AudioContext (useful for testing or external injection).
   */
  init(externalCtx = null) {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    try {
      if (externalCtx) {
        this.ctx = externalCtx;
      } else {
        const AudioCtx = typeof window !== 'undefined'
          ? (window.AudioContext || window.webkitAudioContext)
          : null;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate procedural noise buffers
      this.whiteNoiseBuffer = this._generateWhiteNoiseBuffer(2.0);
      this.pinkNoiseBuffer = this._generatePinkNoiseBuffer(2.0);

      this.isInitialized = true;
      return this.ctx;
    } catch (err) {
      console.warn('[SoundSynthesizer] AudioContext initialization failed or blocked:', err);
      return null;
    }
  }

  /**
   * Toggles audio mute state.
   * @returns {boolean} New mute state.
   */
  toggleMute() {
    return this.setMuted(!this.isMuted);
  }

  /**
   * Sets mute state explicitly.
   * @param {boolean} muted
   * @returns {boolean}
   */
  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /**
   * Sets master volume level (0.0 - 1.0).
   * @param {number} vol
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Internal helper: generates a mono white noise buffer.
   */
  _generateWhiteNoiseBuffer(seconds = 2.0) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Internal helper: generates true 1/f Pink Noise using the Voss-McCartney algorithm.
   * Pink noise produces rich, natural felt cloth friction and soft chalk textures.
   */
  _generatePinkNoiseBuffer(seconds = 2.0) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const bufferSize = Math.floor(sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  /**
   * Creates a distortion curve for analog saturation / waveshaping.
   */
  _makeDistortionCurve(amount = 25) {
    const k = typeof amount === 'number' ? amount : 25;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Ensures AudioContext is ready.
   */
  _ensureContext() {
    if (!this.ctx || !this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return !this.isMuted && this.ctx != null;
  }

  // =========================================================================
  // 1. CHALK SOUND EFFECTS
  // =========================================================================

  /**
   * playChalkStroke(intensity, speed)
   * Bandpass-filtered noise (1.8kHz - 3.2kHz) simulating chalk friction on slate.
   * Micro-oscillator models chalk stick vibration.
   * 
   * @param {number} intensity Stroke force [0.1 - 2.0], default 1.0
   * @param {number} speed Drawing velocity [0.1 - 2.5], default 1.0
   * @param {number} duration Duration in seconds, default ~0.14s
   */
  playChalkStroke(intensity = 1.0, speed = 1.0, duration = 0.14) {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const clampedIntensity = Math.max(0.1, Math.min(2.0, intensity));
    const clampedSpeed = Math.max(0.1, Math.min(2.5, speed));

    // Bandpass center frequency modulated between 1800Hz and 3200Hz
    const centerFreq = Math.min(3200, Math.max(1800, 1800 + clampedSpeed * 550 + Math.random() * 250));
    const strokeDuration = Math.max(0.06, Math.min(0.35, duration / Math.max(0.6, clampedSpeed)));

    // Noise friction layer
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(1.0);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(centerFreq, t);
    bandpass.Q.setValueAtTime(3.2 + clampedIntensity * 0.8, t);

    const noiseGain = this.ctx.createGain();
    const peakGain = 0.16 * clampedIntensity;
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(peakGain, t + 0.015);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + strokeDuration);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Subtle micro-vibration of chalk stick on rigid stone (350Hz - 480Hz)
    const stickOsc = this.ctx.createOscillator();
    stickOsc.type = 'triangle';
    stickOsc.frequency.setValueAtTime(360 + clampedSpeed * 40 + Math.random() * 50, t);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, t);
    oscGain.gain.linearRampToValueAtTime(0.03 * clampedIntensity, t + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + strokeDuration * 0.85);

    stickOsc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noiseSource.start(t);
    stickOsc.start(t);
    noiseSource.stop(t + strokeDuration);
    stickOsc.stop(t + strokeDuration);
  }

  /**
   * Backward-compatible alias for chalkboard writing.
   */
  playChalkWrite(duration = 0.12) {
    this.playChalkStroke(1.0, 1.0, duration);
  }

  /**
   * playChalkHit()
   * Resonant click/thud on target impact (projectile hitting blackboard / planetary boundary).
   */
  playChalkHit() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;

    // 1. Resonant low thud: Sine wave pitch drop 240Hz -> 50Hz
    const thudOsc = this.ctx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(240, t);
    thudOsc.frequency.exponentialRampToValueAtTime(50, t + 0.09);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(0.35, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);

    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain);

    // 2. High-frequency brittle chalk transient click
    const clickNoise = this.ctx.createBufferSource();
    clickNoise.buffer = this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(0.5);

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(2800, t);
    clickFilter.Q.setValueAtTime(4.0, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.25, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickNoise.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);

    thudOsc.start(t);
    clickNoise.start(t);
    thudOsc.stop(t + 0.10);
    clickNoise.stop(t + 0.03);
  }

  // =========================================================================
  // 2. PROJECTILE FLIGHT WIND & KEPLER SLINGSHOT
  // =========================================================================

  /**
   * playFlightWind(speed)
   * Pitched whistling sound during projectile trajectory.
   * Single-shot whoosh or trajectory sample.
   * 
   * @param {number} speed Velocity scalar [0.0 - 3.0], default 1.0
   */
  playFlightWind(speed = 1.0) {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const normSpeed = Math.max(0.1, Math.min(3.0, speed));
    const duration = 0.35;

    // Filtered aerodynamic turbulence
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer || this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(1.0);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    const centerFreq = 450 + normSpeed * 400;
    bandpass.frequency.setValueAtTime(centerFreq * 0.8, t);
    bandpass.frequency.exponentialRampToValueAtTime(centerFreq * 1.25, t + duration * 0.5);
    bandpass.frequency.exponentialRampToValueAtTime(centerFreq * 0.7, t + duration);
    bandpass.Q.setValueAtTime(4.5, t);

    const gain = this.ctx.createGain();
    const peakGain = 0.18 * Math.min(normSpeed, 1.8);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Whistling air vortex tone
    const whistle = this.ctx.createOscillator();
    whistle.type = 'sine';
    const whistleFreq = 500 + normSpeed * 350;
    whistle.frequency.setValueAtTime(whistleFreq * 0.9, t);
    whistle.frequency.linearRampToValueAtTime(whistleFreq * 1.15, t + duration * 0.5);
    whistle.frequency.exponentialRampToValueAtTime(whistleFreq * 0.8, t + duration);

    const whistleGain = this.ctx.createGain();
    whistleGain.gain.setValueAtTime(0.001, t);
    whistleGain.gain.linearRampToValueAtTime(0.08 * normSpeed, t + duration * 0.4);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    whistle.connect(whistleGain);
    whistleGain.connect(this.masterGain);

    noise.start(t);
    whistle.start(t);
    noise.stop(t + duration);
    whistle.stop(t + duration);
  }

  /**
   * playSlingshotHum(proximity)
   * Planetary gravitational field resonance hum.
   * 
   * @param {number} proximity Normalized closeness to planet [0.0 = far, 1.0 = periapsis]
   */
  playSlingshotHum(proximity = 0.5) {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const p = Math.max(0.0, Math.min(1.0, proximity));
    const duration = 0.6;

    // Deep fundamental tone (55Hz - 90Hz based on proximity)
    const baseFreq = 55 + p * 35;
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 1.1, t + duration * 0.5);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 0.95, t + duration);

    // Slightly detuned oscillator for acoustic gravitational beating
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq + 1.8, t);

    // Lowpass filter to muffle raw sawtooth into warm celestial hum
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = 160 + p * 280;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.Q.setValueAtTime(2.5, t);

    const gain = this.ctx.createGain();
    const peakGain = 0.05 + p * 0.22;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  /**
   * Backward-compatible alias for black hole gravity hum.
   */
  playBlackHoleHum(freq = 65) {
    const proximity = Math.min(1.0, Math.max(0.1, (freq - 40) / 60));
    this.playSlingshotHum(proximity);
  }

  // =========================================================================
  // 3. BLACK HOLE IMPLOSION & SUPERNOVA EXPLOSION
  // =========================================================================

  /**
   * playBlackHoleImplosion()
   * Descending sub-bass sweep (60Hz -> 20Hz) + swirling flanger noise
   * Simulates gravitational collapse into the singularity.
   */
  playBlackHoleImplosion() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const duration = 2.0;

    // 1. Descending sub-bass sweep: 60Hz -> 20Hz
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, t);
    subOsc.frequency.exponentialRampToValueAtTime(20, t + duration);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.01, t);
    subGain.gain.linearRampToValueAtTime(0.55, t + duration * 0.7);
    subGain.gain.linearRampToValueAtTime(0.001, t + duration);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    // 2. Swirling flanger noise: Event horizon vortex
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(2.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(5.0, t);

    // LFO to swirl the filter frequency back and forth
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.5, t); // 3.5 Hz swirling speed
    lfo.frequency.linearRampToValueAtTime(7.0, t + duration); // Accelerate swirl

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(600, t);
    lfoGain.gain.linearRampToValueAtTime(1200, t + duration);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.28, t + duration * 0.8);
    noiseGain.gain.linearRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    subOsc.start(t);
    noise.start(t);
    lfo.start(t);

    subOsc.stop(t + duration);
    noise.stop(t + duration);
    lfo.stop(t + duration);
  }

  /**
   * playSupernovaExplosion()
   * Powerful distorted noise burst + sub-bass boom + 3s exponential decay.
   * Detonates the chalk dust formulas across the classroom universe.
   */
  playSupernovaExplosion() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const duration = 3.0;

    // 1. Massive Sub-bass boom: 90Hz sweeping down to 24Hz
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, t);
    subOsc.frequency.exponentialRampToValueAtTime(24, t + 1.4);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.6);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 2.6);

    // 2. Distorted Mid-range Shockwave (Triangle wave through WaveShaper saturation)
    const midOsc = this.ctx.createOscillator();
    midOsc.type = 'sawtooth';
    midOsc.frequency.setValueAtTime(160, t);
    midOsc.frequency.exponentialRampToValueAtTime(35, t + 1.0);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._makeDistortionCurve(30);
    shaper.oversample = '4x';

    const midGain = this.ctx.createGain();
    midGain.gain.setValueAtTime(0.45, t);
    midGain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    midOsc.connect(shaper);
    shaper.connect(midGain);
    midGain.connect(this.masterGain);
    midOsc.start(t);
    midOsc.stop(t + 1.3);

    // 3. Wideband Distorted Noise Burst with 3.0s exponential decay
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(3.5);

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1600, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, t + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  /**
   * Backward-compatible alias for explosion.
   */
  playExplosion() {
    this.playSupernovaExplosion();
  }

  // =========================================================================
  // 4. FELT ERASER CLOTH & PAPER ENVELOPE
  // =========================================================================

  /**
   * playEraserWipe(speed)
   * Lowpass pink noise (600Hz - 1.2kHz) scaled with eraser drag velocity.
   * Single-shot wipe stroke.
   * 
   * @param {number} speed Drag velocity scalar, default 1.0
   */
  playEraserWipe(speed = 1.0) {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;
    const normSpeed = Math.max(0.1, Math.min(2.5, speed));
    const duration = Math.max(0.1, 0.22 / Math.sqrt(normSpeed));

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer || this._generatePinkNoiseBuffer(1.0);

    // Lowpass filter 600Hz - 1.2kHz scaled with speed
    const cutoffFreq = Math.min(1200, Math.max(600, 600 + normSpeed * 280));
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFreq, t);
    filter.Q.setValueAtTime(1.4, t);

    const gain = this.ctx.createGain();
    const peakGain = 0.22 * Math.min(normSpeed, 1.6);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + duration);
  }

  /**
   * Continuous felt eraser dragging audio loop start.
   */
  startEraserWiping() {
    if (!this._ensureContext() || this.activeEraserSource) return;

    try {
      this.activeEraserSource = this.ctx.createBufferSource();
      this.activeEraserSource.buffer = this.pinkNoiseBuffer || this._generatePinkNoiseBuffer(2.0);
      this.activeEraserSource.loop = true;

      this.eraserFilter = this.ctx.createBiquadFilter();
      this.eraserFilter.type = 'lowpass';
      this.eraserFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.eraserFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.eraserGain = this.ctx.createGain();
      this.eraserGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.activeEraserSource.connect(this.eraserFilter);
      this.eraserFilter.connect(this.eraserGain);
      this.eraserGain.connect(this.masterGain);

      this.activeEraserSource.start();
    } catch (err) {
      console.warn('[SoundSynthesizer] Failed to start continuous eraser:', err);
    }
  }

  /**
   * Updates continuous eraser pitch and volume based on drag speed.
   * @param {number} speed
   */
  updateEraserSpeed(speed) {
    if (!this.ctx || !this.eraserGain || !this.eraserFilter || this.isMuted) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(Math.max(speed / 15, 0), 1.0);
    const targetGain = norm > 0.05 ? norm * 0.28 : 0.001;
    const targetFreq = 600 + norm * 600; // 600Hz - 1200Hz

    this.eraserGain.gain.setTargetAtTime(targetGain, t, 0.04);
    this.eraserFilter.frequency.setTargetAtTime(targetFreq, t, 0.04);
  }

  /**
   * Stops continuous eraser loop.
   */
  stopEraserWiping() {
    if (this.eraserGain && this.ctx) {
      this.eraserGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    }
    if (this.activeEraserSource) {
      try {
        this.activeEraserSource.stop(this.ctx.currentTime + 0.05);
      } catch (e) {}
      this.activeEraserSource = null;
    }
  }

  /**
   * playEnvelopeOpen()
   * Paper friction rustle and wax seal snap.
   */
  playEnvelopeOpen() {
    if (!this._ensureContext()) return;
    const t = this.ctx.currentTime;

    // 1. Crisp wax seal fracture: square wave transient 850Hz -> 100Hz
    const snapOsc = this.ctx.createOscillator();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(850, t);
    snapOsc.frequency.exponentialRampToValueAtTime(100, t + 0.04);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.24, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    snapOsc.connect(snapGain);
    snapGain.connect(this.masterGain);
    snapOsc.start(t);
    snapOsc.stop(t + 0.05);

    // 2. Paper sliding friction rustle
    const paperNoise = this.ctx.createBufferSource();
    paperNoise.buffer = this.whiteNoiseBuffer || this._generateWhiteNoiseBuffer(1.0);

    const paperFilter = this.ctx.createBiquadFilter();
    paperFilter.type = 'bandpass';
    paperFilter.frequency.setValueAtTime(1400, t);
    paperFilter.frequency.linearRampToValueAtTime(2400, t + 0.25);
    paperFilter.Q.setValueAtTime(2.0, t);

    const paperGain = this.ctx.createGain();
    paperGain.gain.setValueAtTime(0.01, t);
    paperGain.gain.linearRampToValueAtTime(0.18, t + 0.08);
    paperGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    paperNoise.connect(paperFilter);
    paperFilter.connect(paperGain);
    paperGain.connect(this.masterGain);

    paperNoise.start(t);
    paperNoise.stop(t + 0.38);
  }

  /**
   * Backward-compatible alias for opening the paper letter.
   */
  playPaperOpen() {
    this.playEnvelopeOpen();
  }

  /**
   * Harmonious success chime when a challenge level is cleared.
   */
  playSuccess() {
    if (!this._ensureContext()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const t = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const startTime = t + idx * 0.07;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }
}

// Singleton export
export const soundSynthesizer = new SoundSynthesizer();
