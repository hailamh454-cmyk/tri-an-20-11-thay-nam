/**
 * js/audioSynth.js
 * Backward-compatibility wrapper re-exporting SoundSynthesizer from js/audio/soundSynthesizer.js
 */

import { SoundSynthesizer, soundSynthesizer } from './audio/soundSynthesizer.js';

export { SoundSynthesizer, soundSynthesizer };
export const audioSynth = soundSynthesizer;
export default soundSynthesizer;
