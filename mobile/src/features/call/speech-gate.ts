/**
 * Speech gate: lets the patient's own nearby voice through and turns down background sound,
 * including other people talking further from the microphone.
 *
 * How it decides, per 128-sample block of microphone audio:
 * 1. Noise floor: tracks the quietest recent level of the room (fast down, slow up, and almost
 *    frozen while the patient is talking so a long sentence does not raise it).
 * 2. Patient level: tracks how loud the patient's own speech is once they have spoken.
 * 3. A sound opens the gate only if it is clearly above the floor AND within a "proximity
 *    window" of the patient's level. Sound drops ~6 dB per doubling of distance, so a voice or TV
 *    across the room usually arrives 10–20 dB quieter than the person holding the phone.
 * 4. Hold and hysteresis keep it open through pauses between words; a short look-ahead (applied
 *    by the audio processor) opens it before the first syllable reaches the output.
 * Closed means quieter, not silent, so speech that is misjudged is reduced rather than lost.
 *
 * The algorithm is plain ES5 in a string so the exact same code runs inside an AudioWorklet
 * (which cannot import modules from the app bundle) and in unit tests.
 */
export type NoiseFilterMode = 'off' | 'standard' | 'strong';
export type GateState = { floor: number; speech: number | null; gain: number; open: boolean; mode: NoiseFilterMode };
export interface SpeechGate {
  /** Advance one block whose smoothed level is `levelDb` (dBFS); returns the gain to apply (0..1). */
  step(levelDb: number): number;
  setMode(mode: NoiseFilterMode): void;
  state(): GateState;
}

export const GATE_SOURCE = String.raw`
function createSpeechGate(sampleRate, blockSize, initialMode) {
  var presets = {
    standard: { margin: 12, proximity: 15, floorGain: 0.15 },
    strong: { margin: 18, proximity: 11, floorGain: 0.05 }
  };
  var mode = (presets[initialMode] || initialMode === 'off') ? initialMode : 'standard';
  var blockSec = blockSize / sampleRate;
  function coef(seconds) { return 1 - Math.exp(-blockSec / seconds); }
  var calibration = Math.round(1.0 / blockSec);
  var holdBlocks = Math.round(0.3 / blockSec);
  var floor = -60, speech = null, gain = 1, open = true, hold = holdBlocks, blocks = 0, quiet = 0;
  return {
    setMode: function (next) { if (next === 'off' || presets[next]) mode = next; },
    state: function () { return { floor: floor, speech: speech, gain: gain, open: open, mode: mode }; },
    step: function (level) {
      if (!(level > -200)) level = -200;
      blocks++;
      if (mode === 'off') { gain = 1; open = true; return gain; }
      var p = presets[mode];
      if (blocks <= calibration) {
        // First second: learn the room quickly and keep the microphone open.
        floor += coef(0.15) * (level - floor);
        floor = Math.max(-90, Math.min(-25, floor));
        gain = 1; open = true; hold = holdBlocks;
        return gain;
      }
      var up = open ? coef(30) : coef(4);
      floor += (level < floor ? coef(0.4) : up) * (level - floor);
      floor = Math.max(-90, Math.min(-25, floor));
      var threshold = Math.max(floor + p.margin, -60);
      if (speech !== null) threshold = Math.max(threshold, Math.min(speech - p.proximity, -32));
      var above = level >= threshold;
      if (above || (open && level >= threshold - 4)) { open = true; hold = holdBlocks; }
      else if (hold > 0) { hold--; }
      else { open = false; }
      if (above) {
        speech = speech === null ? level : speech + (level > speech ? coef(0.8) : coef(2)) * (level - speech);
        quiet = 0;
      } else if (speech !== null && ++quiet > holdBlocks * 10) {
        // Long silence: relax the patient level so one loud bang cannot lock the gate.
        speech += coef(8) * ((floor + p.margin + p.proximity) - speech);
      }
      var target = open ? 1 : p.floorGain;
      gain += (target > gain ? coef(0.004) : coef(0.12)) * (target - gain);
      return gain;
    }
  };
}`;

/** AudioWorklet processor: level detection, 40 ms look-ahead and smooth gain, on mono audio. */
export const WORKLET_SOURCE = GATE_SOURCE + String.raw`
class SpeechGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    var block = 128;
    this.gate = createSpeechGate(sampleRate, block, options && options.processorOptions && options.processorOptions.mode);
    this.envCoef = 1 - Math.exp(-block / sampleRate / 0.02);
    this.env = 0;
    this.lookahead = Math.round(sampleRate * 0.04);
    this.buffer = new Float32Array(this.lookahead + block * 4);
    this.write = 0;
    this.gain = 1;
    var gate = this.gate;
    this.port.onmessage = function (event) { if (event.data && event.data.mode) gate.setMode(event.data.mode); };
  }
  process(inputs, outputs) {
    var input = inputs[0] && inputs[0][0];
    var output = outputs[0];
    var n = output[0].length, i, c;
    var buf = this.buffer, size = buf.length;
    var power = 0;
    for (i = 0; i < n; i++) {
      var sample = input ? input[i] : 0;
      buf[(this.write + i) % size] = sample;
      power += sample * sample;
    }
    this.env += this.envCoef * (power / n - this.env);
    var next = this.gate.step(10 * Math.log10(this.env + 1e-12));
    for (c = 0; c < output.length; c++) {
      var channel = output[c];
      for (i = 0; i < n; i++) {
        var g = this.gain + (next - this.gain) * (i / n);
        channel[i] = buf[(this.write + i - this.lookahead + size) % size] * g;
      }
    }
    this.write = (this.write + n) % size;
    this.gain = next;
    return true;
  }
}
registerProcessor('speech-gate', SpeechGateProcessor);`;

type GateFactory = (sampleRate: number, blockSize: number, mode?: NoiseFilterMode) => SpeechGate;
// Same source as the worklet, so tests exercise exactly what runs on the audio thread.
export const createSpeechGate = new Function(`${GATE_SOURCE}\nreturn createSpeechGate;`)() as GateFactory;
