/**
 * The camera's sounds, made on the spot with the Web Audio API so no file
 * ships: a shutter click, and the beeps of a self-timer. Each set owns its
 * context, made on the first sound, which a press or a tap gives the gesture
 * for, and resumed whenever it is suspended; whoever plays them keeps the set.
 */

/** @import { CameraSounds } from "../types.ts" */

/** @returns {CameraSounds} */
export const createSounds = () => {
  /** @type {AudioContext | null} */
  let context = null;

  const audio = () => {
    const Ctor = globalThis.AudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  };

  /** @param {number} [frequency] @param {number} [ms] @param {number} [gain] */
  const beep = (frequency = 1200, ms = 90, gain = 0.25) => {
    const ctx = audio();
    if (!ctx) return;
    const at = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    vol.gain.setValueAtTime(0.0001, at);
    vol.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
    osc.connect(vol).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + ms / 1000 + 0.02);
  };

  const click = () => {
    const ctx = audio();
    if (!ctx) return;
    const at = ctx.currentTime;
    /** @param {number} start @param {number} ms @param {number} gain @param {number} cutoff */
    const burst = (start, ms, gain, cutoff) => {
      const length = Math.ceil(ctx.sampleRate * (ms / 1000));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      const vol = ctx.createGain();
      vol.gain.value = gain;
      source.connect(filter).connect(vol).connect(ctx.destination);
      source.start(at + start);
    };
    burst(0, 28, 0.5, 6000);
    burst(0.07, 40, 0.35, 2500);
  };

  /** @param {number} count */
  const tick = (count) => beep(count <= 1 ? 1760 : 1046, count <= 1 ? 160 : 80, 0.2);

  return { beep, click, tick };
};
