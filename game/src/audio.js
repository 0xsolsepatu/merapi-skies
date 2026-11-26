// Synthesised sound for Merapi Skies: no audio files, everything is
// WebAudio oscillators and filtered noise. The context only starts on a
// user gesture (Chrome blocks autoplay), and screenshot mode never touches
// it, so headless runs stay silent and error-free.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 31;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: a looped noise buffer through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', gain = 0.16, when = 0) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* sound is decoration, never a crash */ }
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    // Called every frame while flying: engine hum follows throttle, wind
    // follows airspeed.
    update(throttle, speed, airborne) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const rpm = 58 + throttle * 95 + speed * 0.25;
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm / 2, t, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
      engineGain.gain.setTargetAtTime(airborne ? 0.045 + throttle * 0.05 : 0.02 + throttle * 0.03, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.12, (speed / 92) * 0.12), t, 0.15);
    },
    click() {
      tone(660, 0.07, 'square', 0.08);
    },
    chime() {
      tone(880, 0.18, 'sine', 0.16);
      tone(1318, 0.28, 'sine', 0.14, 0.09);
    },
    thud() {
      tone(70, 0.3, 'sine', 0.3);
      tone(45, 0.35, 'triangle', 0.2, 0.02);
    },
    beep() {
      tone(1180, 0.09, 'square', 0.07);
    },
    crash() {
      tone(55, 0.7, 'sawtooth', 0.25);
      tone(38, 0.9, 'sine', 0.28, 0.05);
    },
    fanfare() {
      tone(523, 0.16, 'sine', 0.15);
      tone(659, 0.16, 'sine', 0.15, 0.14);
      tone(784, 0.3, 'sine', 0.16, 0.28);
    },
  };
}
