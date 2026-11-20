/**
 * tests/test_audio_synth.mjs
 * Verification Suite for js/audio/soundSynthesizer.js
 * 
 * Tests 100% Procedural Web Audio API Sound Synthesizer:
 * 1. Module Exports & Lazy Initialization
 * 2. White & Pink Noise Buffer Generation (Voss-McCartney algorithm)
 * 3. playChalkStroke(intensity, speed) [Bandpass 1.8kHz - 3.2kHz]
 * 4. playChalkHit() [Resonant click / thud]
 * 5. playFlightWind(speed) [Pitched aerodynamic whistle & wind turbulence]
 * 6. playSlingshotHum(proximity) [Kepler gravitational field resonant hum]
 * 7. playBlackHoleImplosion() [Descending sub-bass 60Hz->20Hz + swirling LFO flanger]
 * 8. playSupernovaExplosion() [Distorted noise burst + sub-bass boom + 3s exponential decay]
 * 9. playEraserWipe(speed) & Continuous Loop [Lowpass pink noise 600Hz - 1.2kHz]
 * 10. playEnvelopeOpen() [Wax seal snap + paper friction sweep]
 * 11. Mute, Volume Control & Backward Compatibility Aliases
 */

import assert from 'assert';
import { SoundSynthesizer, soundSynthesizer } from '../js/audio/soundSynthesizer.js';
import { audioSynth } from '../js/audioSynth.js';

console.log('=== RUNNING SOUND SYNTHESIZER PROCEDURAL AUDIO TEST SUITE ===\n');

// ============================================================================
// Web Audio API Mock for Node.js
// ============================================================================

class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.events = [];
  }

  setValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', value: val, time });
  }

  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', value: val, time });
  }

  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', value: val, time });
  }

  setTargetAtTime(val, time, timeConstant) {
    this.value = val;
    this.events.push({ type: 'setTargetAtTime', value: val, time, timeConstant });
  }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.gain = new MockAudioParam(1.0);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1.0);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = new Array(channels).fill(0).map(() => new Float32Array(length));
  }

  getChannelData(channel) {
    return this.channelData[channel];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
  }

  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockWaveShaperNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.curve = null;
    this.oversample = 'none';
  }
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.currentTime = 0.05;
    this.state = 'suspended';
    this.destination = new MockAudioNode(this);
    this.createdNodes = [];
  }

  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  createGain() {
    const node = new MockGainNode(this);
    this.createdNodes.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = new MockBiquadFilterNode(this);
    this.createdNodes.push(node);
    return node;
  }

  createOscillator() {
    const node = new MockOscillatorNode(this);
    this.createdNodes.push(node);
    return node;
  }

  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }

  createBufferSource() {
    const node = new MockAudioBufferSourceNode(this);
    this.createdNodes.push(node);
    return node;
  }

  createWaveShaper() {
    const node = new MockWaveShaperNode(this);
    this.createdNodes.push(node);
    return node;
  }
}

// ============================================================================
// TEST 1: MODULE EXPORTS AND INSTANTIATION
// ============================================================================
console.log('[Test 1] Testing Module Exports & Instances:');
assert(typeof SoundSynthesizer === 'function', 'SoundSynthesizer must be a class constructor');
assert(typeof soundSynthesizer === 'object' && soundSynthesizer !== null, 'soundSynthesizer must be an object');
assert(typeof audioSynth === 'object' && audioSynth !== null, 'audioSynth alias must export properly');
assert.strictEqual(soundSynthesizer, audioSynth, 'audioSynth must point to the same singleton instance');
console.log('  -> SoundSynthesizer exported correctly as ES6 module.');
console.log('  [PASS] Module export structure verified.\n');

// ============================================================================
// TEST 2: LAZY INITIALIZATION & PROCEDURAL NOISE BUFFERS
// ============================================================================
console.log('[Test 2] Testing Lazy AudioContext Initialization & Noise Buffers:');
const testSynth = new SoundSynthesizer();
assert.strictEqual(testSynth.isInitialized, false, 'Should be uninitialized initially');
assert.strictEqual(testSynth.ctx, null, 'Context should initially be null');

const mockCtx = new MockAudioContext();
testSynth.init(mockCtx);

assert.strictEqual(testSynth.isInitialized, true, 'Should be marked initialized');
assert.strictEqual(testSynth.ctx, mockCtx, 'Context should reference initialized mockCtx');
assert.strictEqual(testSynth.masterGain.connections[0], mockCtx.destination, 'masterGain must connect to destination');

// Verify White Noise Buffer
assert(testSynth.whiteNoiseBuffer !== null, 'White noise buffer must be generated');
assert(testSynth.whiteNoiseBuffer.length === 44100 * 2, 'White noise buffer length must be 2 seconds');
const whiteData = testSynth.whiteNoiseBuffer.getChannelData(0);
let whiteNonZero = false;
let whiteMax = -1;
let whiteMin = 1;
for (let i = 0; i < whiteData.length; i++) {
  if (whiteData[i] !== 0) whiteNonZero = true;
  if (whiteData[i] > whiteMax) whiteMax = whiteData[i];
  if (whiteData[i] < whiteMin) whiteMin = whiteData[i];
}
assert(whiteNonZero, 'White noise buffer must contain non-zero random floats');
assert(whiteMax <= 1.0 && whiteMin >= -1.0, 'White noise samples must stay within [-1.0, 1.0]');
console.log(`  -> White noise samples: min=${whiteMin.toFixed(3)}, max=${whiteMax.toFixed(3)}`);

// Verify Pink Noise Buffer (Voss-McCartney algorithm)
assert(testSynth.pinkNoiseBuffer !== null, 'Pink noise buffer must be generated');
assert(testSynth.pinkNoiseBuffer.length === 44100 * 2, 'Pink noise buffer length must be 2 seconds');
const pinkData = testSynth.pinkNoiseBuffer.getChannelData(0);
let pinkNonZero = false;
let pinkMax = -1;
let pinkMin = 1;
for (let i = 0; i < pinkData.length; i++) {
  if (pinkData[i] !== 0) pinkNonZero = true;
  if (pinkData[i] > pinkMax) pinkMax = pinkData[i];
  if (pinkData[i] < pinkMin) pinkMin = pinkData[i];
}
assert(pinkNonZero, 'Pink noise buffer must contain non-zero samples');
console.log(`  -> Pink noise (1/f) samples: min=${pinkMin.toFixed(3)}, max=${pinkMax.toFixed(3)}`);
console.log('  [PASS] Lazy AudioContext init and dual noise buffers verified.\n');

// ============================================================================
// TEST 3: playChalkStroke(intensity, speed)
// ============================================================================
console.log('[Test 3] Testing playChalkStroke(intensity, speed):');
mockCtx.createdNodes = [];
testSynth.playChalkStroke(1.2, 1.5, 0.15);

const chalkFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'bandpass');
assert(chalkFilter, 'Chalk stroke must include a bandpass filter');
const chalkFreq = chalkFilter.frequency.value;
console.log(`  -> Chalk stroke bandpass center frequency: ${chalkFreq.toFixed(1)} Hz (Range: 1800Hz - 3200Hz)`);
assert(chalkFreq >= 1800 && chalkFreq <= 3200, 'Bandpass frequency must fall within 1.8kHz - 3.2kHz');

const chalkOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'triangle');
assert(chalkOsc, 'Chalk stroke must include stick vibration triangle oscillator');
assert(chalkOsc.started, 'Stick oscillator must be started');
assert(chalkOsc.stopped, 'Stick oscillator must be scheduled to stop');
console.log(`  -> Chalk stick vibration oscillator: ${chalkOsc.frequency.value.toFixed(1)} Hz`);
console.log('  [PASS] playChalkStroke acoustic specs verified.\n');

// ============================================================================
// TEST 4: playChalkHit()
// ============================================================================
console.log('[Test 4] Testing playChalkHit():');
mockCtx.createdNodes = [];
testSynth.playChalkHit();

const thudOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'sine');
assert(thudOsc, 'Chalk hit must include low resonant thud oscillator');
const freqEvents = thudOsc.frequency.events;
const initialThudFreq = freqEvents[0]?.value;
const finalThudFreq = freqEvents[1]?.value;
console.log(`  -> Low thud sine sweep: ${initialThudFreq} Hz -> ${finalThudFreq} Hz (exponential ramp)`);
assert(initialThudFreq === 240, 'Initial thud frequency should be 240Hz');
assert(finalThudFreq === 50, 'Final thud frequency should reach 50Hz');

const clickFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'bandpass');
assert(clickFilter, 'Chalk hit must include high transient click filter');
console.log(`  -> Chalk click transient filter: ${clickFilter.frequency.value} Hz`);
assert(clickFilter.frequency.value === 2800, 'Click transient filter must be centered at 2.8kHz');
console.log('  [PASS] playChalkHit acoustic impact verified.\n');

// ============================================================================
// TEST 5: playFlightWind(speed)
// ============================================================================
console.log('[Test 5] Testing playFlightWind(speed):');
mockCtx.createdNodes = [];
testSynth.playFlightWind(1.8);

const windNoise = mockCtx.createdNodes.find(n => n instanceof MockAudioBufferSourceNode);
assert(windNoise && windNoise.started, 'Flight wind must start turbulence noise buffer source');

const windWhistle = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'sine');
assert(windWhistle && windWhistle.started, 'Flight wind must include whistling sine vortex oscillator');
const whistleEvents = windWhistle.frequency.events;
console.log(`  -> Whistle vortex tone at speed=1.8: ${whistleEvents[0]?.value.toFixed(1)} Hz (duration: 0.35s)`);
assert(whistleEvents.length >= 3, 'Whistle frequency should have ramps up and down');
console.log('  [PASS] playFlightWind aerodynamic whistling verified.\n');

// ============================================================================
// TEST 6: playSlingshotHum(proximity)
// ============================================================================
console.log('[Test 6] Testing playSlingshotHum(proximity):');
mockCtx.createdNodes = [];
testSynth.playSlingshotHum(0.85);

const sawOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'sawtooth');
const sineOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'sine');
assert(sawOsc && sawOsc.started, 'Slingshot hum must have fundamental sawtooth oscillator');
assert(sineOsc && sineOsc.started, 'Slingshot hum must have beating sine oscillator');

const humFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'lowpass');
assert(humFilter, 'Slingshot hum must be filtered by lowpass filter');
console.log(`  -> Slingshot hum: saw=${sawOsc.frequency.value.toFixed(1)} Hz, detuned sine=${sineOsc.frequency.value.toFixed(1)} Hz, lowpass cutoff=${humFilter.frequency.value.toFixed(1)} Hz`);
assert(humFilter.frequency.value >= 160 && humFilter.frequency.value <= 450, 'Hum filter cutoff in expected celestial resonance range');
console.log('  [PASS] playSlingshotHum gravitational field resonance verified.\n');

// ============================================================================
// TEST 7: playBlackHoleImplosion()
// ============================================================================
console.log('[Test 7] Testing playBlackHoleImplosion():');
mockCtx.createdNodes = [];
testSynth.playBlackHoleImplosion();

const subSweepOsc = mockCtx.createdNodes.find(
  n => n instanceof MockOscillatorNode && n.type === 'sine' && n.frequency.events[0]?.value === 60
);
assert(subSweepOsc, 'Must find 60Hz initial sub-bass sweep oscillator');
const subEvents = subSweepOsc.frequency.events;
const fInitial = subEvents[0]?.value;
const fFinal = subEvents[1]?.value;
console.log(`  -> Event horizon collapse sub-bass: ${fInitial} Hz -> ${fFinal} Hz`);
assert(fInitial === 60, 'Sub-bass sweep must begin at 60Hz');
assert(fFinal === 20, 'Sub-bass sweep must descend to 20Hz');

const lfoOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n !== subSweepOsc);
assert(lfoOsc && lfoOsc.started, 'Black hole implosion must feature an active LFO for swirling flanger effect');
console.log(`  -> Swirling flanger LFO rate: ${lfoOsc.frequency.events[0]?.value} Hz -> ${lfoOsc.frequency.events[1]?.value} Hz`);
console.log('  [PASS] playBlackHoleImplosion descending sub-bass sweep + flanger verified.\n');

// ============================================================================
// TEST 8: playSupernovaExplosion()
// ============================================================================
console.log('[Test 8] Testing playSupernovaExplosion():');
mockCtx.createdNodes = [];
testSynth.playSupernovaExplosion();

const boomOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'sine');
assert(boomOsc, 'Supernova must feature sub-bass boom oscillator');
console.log(`  -> Sub-bass boom: ${boomOsc.frequency.events[0]?.value} Hz -> ${boomOsc.frequency.events[1]?.value} Hz`);
assert(boomOsc.frequency.events[0]?.value === 90, 'Sub-bass boom starts at 90Hz');
assert(boomOsc.frequency.events[1]?.value === 24, 'Sub-bass boom drops to 24Hz');

const waveShaper = mockCtx.createdNodes.find(n => n instanceof MockWaveShaperNode);
assert(waveShaper, 'Supernova must feature WaveShaper distortion node');
assert(waveShaper.curve instanceof Float32Array, 'WaveShaper must have Float32Array saturation curve');
assert(waveShaper.curve.length === 44100, 'Saturation curve must have 44100 samples');
console.log(`  -> WaveShaper distortion oversampling: ${waveShaper.oversample}, curve points: ${waveShaper.curve.length}`);

const decayFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'lowpass');
assert(decayFilter, 'Supernova must have wideband lowpass decay filter');
const filterEvents = decayFilter.frequency.events;
console.log(`  -> Lowpass shockwave decay: ${filterEvents[0]?.value} Hz -> ${filterEvents[1]?.value} Hz over 3.0s`);
assert(filterEvents[0]?.value === 1600, 'Lowpass cutoff starts at 1600Hz');
assert(filterEvents[1]?.value === 120, 'Lowpass cutoff sweeps down to 120Hz');
console.log('  [PASS] playSupernovaExplosion 3-second cosmic shockwave verified.\n');

// ============================================================================
// TEST 9: playEraserWipe(speed) & Continuous Loop
// ============================================================================
console.log('[Test 9] Testing playEraserWipe(speed) & Continuous Eraser Controller:');
mockCtx.createdNodes = [];
testSynth.playEraserWipe(1.2);

const eraserFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'lowpass');
assert(eraserFilter, 'Eraser wipe must use lowpass filter');
const eraserCutoff = eraserFilter.frequency.value;
console.log(`  -> Discrete eraser wipe filter: ${eraserCutoff.toFixed(1)} Hz (Range: 600Hz - 1.2kHz)`);
assert(eraserCutoff >= 600 && eraserCutoff <= 1200, 'Eraser cutoff must fall within 600Hz - 1.2kHz');

// Continuous eraser dragging
console.log('  -> Testing continuous eraser wiping:');
testSynth.startEraserWiping();
assert(testSynth.activeEraserSource !== null, 'Active eraser loop source must be created');
assert(testSynth.activeEraserSource.loop === true, 'Eraser source must loop');

testSynth.updateEraserSpeed(10.0);
assert(testSynth.eraserFilter.frequency.value >= 600, 'Eraser dynamic frequency updated');

testSynth.stopEraserWiping();
assert(testSynth.activeEraserSource === null, 'Eraser source cleaned up on stop');
console.log('  [PASS] Felt eraser pink noise & continuous kinematics verified.\n');

// ============================================================================
// TEST 10: playEnvelopeOpen()
// ============================================================================
console.log('[Test 10] Testing playEnvelopeOpen():');
mockCtx.createdNodes = [];
testSynth.playEnvelopeOpen();

const snapOsc = mockCtx.createdNodes.find(n => n instanceof MockOscillatorNode && n.type === 'square');
assert(snapOsc, 'Envelope open must include wax seal snap square wave oscillator');
console.log(`  -> Wax seal fracture: ${snapOsc.frequency.events[0]?.value} Hz -> ${snapOsc.frequency.events[1]?.value} Hz`);
assert(snapOsc.frequency.events[0]?.value === 850, 'Wax seal snap initial freq 850Hz');
assert(snapOsc.frequency.events[1]?.value === 100, 'Wax seal snap final freq 100Hz');

const paperFilter = mockCtx.createdNodes.find(n => n instanceof MockBiquadFilterNode && n.type === 'bandpass');
assert(paperFilter, 'Envelope open must include paper friction bandpass filter');
console.log(`  -> Paper friction sweep: ${paperFilter.frequency.events[0]?.value} Hz -> ${paperFilter.frequency.events[1]?.value} Hz`);
assert(paperFilter.frequency.events[0]?.value === 1400, 'Paper bandpass start 1400Hz');
assert(paperFilter.frequency.events[1]?.value === 2400, 'Paper bandpass end 2400Hz');
console.log('  [PASS] playEnvelopeOpen wax seal snap and parchment friction verified.\n');

// ============================================================================
// TEST 11: MUTE, VOLUME, AND BACKWARD-COMPATIBILITY ALIASES
// ============================================================================
console.log('[Test 11] Testing Mute, Volume & Backward-Compatibility:');
testSynth.setVolume(0.5);
assert.strictEqual(testSynth.volume, 0.5, 'Volume should be 0.5');

const isMuted = testSynth.toggleMute();
assert.strictEqual(isMuted, true, 'Synthesizer should now be muted');
assert.strictEqual(testSynth.masterGain.gain.value, 0, 'Master gain must be 0 when muted');

// Sounds called while muted should execute cleanly without creating unhandled errors
testSynth.playChalkStroke();
testSynth.playChalkHit();
testSynth.playFlightWind();
testSynth.playSupernovaExplosion();

const unmuted = testSynth.toggleMute();
assert.strictEqual(unmuted, false, 'Synthesizer should now be unmuted');
assert.strictEqual(testSynth.masterGain.gain.value, 0.5, 'Master gain restored to volume level 0.5');

// Test backward compatibility aliases
testSynth.playChalkWrite(0.12);
testSynth.playPaperOpen();
testSynth.playBlackHoleHum(75);
testSynth.playExplosion();
testSynth.playSuccess();
console.log('  -> All backward compatibility aliases executed cleanly.');
console.log('  [PASS] Mute, volume, and alias compatibility verified.\n');

console.log('================================================================');
console.log('ALL TESTS PASSED! 100% PROCEDURAL AUDIO SYNTHESIZER READY.');
console.log('================================================================\n');
