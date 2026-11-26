// Skyline Courier — sound: everything you hear is synthesised live.
//
// No audio files exist in the game; every sound is built from oscillators and
// filtered noise through the Web Audio API. The engine hums while you fly,
// rings chime, the wind rises with speed, and landings and crashes get their
// own short sounds. Nothing starts until the pilot presses a key, so browsers
// never block the audio context.

/** Make the game's sound system. Call `unlock()` from a user gesture. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let engineOn = false;

  /** Create the context and the always-on engine and wind nodes. */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // The engine: a low sawtooth plus a soft sine, through a low-pass filter.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineSub = ctx.createOscillator();
    engineSub.type = 'sine';
    engineSub.frequency.value = 110;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();
    engineOn = true;

    // The wind: looping filtered noise whose gain follows the airspeed.
    const noiseLength = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();
  }

  /** The engine and wind follow throttle and speed, every frame. */
  function update(throttle, speed) {
    if (!ctx || !engineOn) return;
    const now = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(48 + throttle * 70, now, 0.1);
    engineGain.gain.setTargetAtTime(0.03 + throttle * 0.09, now, 0.1);
    windGain.gain.setTargetAtTime(Math.max(0, (speed - 55) / 220) * 0.12, now, 0.15);
  }

  /** A short two-note chime: a ring flown cleanly. */
  function ring() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    for (const [offset, freq] of [
      [0, 660],
      [0.09, 990],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + offset);
      osc.stop(now + offset + 0.4);
    }
  }

  /** A single soft thud: a ring missed. */
  function miss() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /** A bright rising arpeggio: a sortie finished. */
  function mission() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + index * 0.1);
      osc.stop(now + index * 0.1 + 0.45);
    });
  }

  /** A low noise burst with a falling tone: a crash. */
  function crash() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const noiseLength = ctx.sampleRate * 0.5;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    const ogain = ctx.createGain();
    ogain.gain.setValueAtTime(0.3, now);
    ogain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(ogain);
    ogain.connect(master);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /** A gentle major chord: wheels on the strip. */
  function land() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    [392, 494, 587, 784].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.95);
    });
  }

  /** Toggle mute; returns the new muted state. */
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { unlock, update, ring, miss, mission, crash, land, toggleMute };
}
