import { html, nothing } from "@lightstart/light/html";
import { signal } from "@lightstart/light/signals";
import T from "@lightstart/light/types";
import View from "@lightstart/light";

/**
 * @import { Signal } from "@lightstart/light/signals"
 * @import { TypeDefinition } from "@lightstart/light/types"
 */

const OCTAVE = [
  { note: "C", freq: 261.63, key: "a", slot: 0 },
  { note: "C♯", freq: 277.18, key: "w", slot: 1 },
  { note: "D", freq: 293.66, key: "s", slot: 0 },
  { note: "D♯", freq: 311.13, key: "e", slot: 2 },
  { note: "E", freq: 329.63, key: "d", slot: 0 },
  { note: "F", freq: 349.23, key: "f", slot: 0 },
  { note: "F♯", freq: 369.99, key: "t", slot: 4 },
  { note: "G", freq: 392, key: "g", slot: 0 },
  { note: "G♯", freq: 415.3, key: "y", slot: 5 },
  { note: "A", freq: 440, key: "h", slot: 0 },
  { note: "A♯", freq: 466.16, key: "u", slot: 6 },
  { note: "B", freq: 493.88, key: "j", slot: 0 },
];

const naturals = OCTAVE.filter((tone) => tone.slot === 0);
const sharps = OCTAVE.filter((tone) => tone.slot > 0);

View.define("grand-octave", {
  _down: /** @type {TypeDefinition<Record<string, Signal<boolean>>>} */ (T.object({ reactive: false, defaultValue: null })),
  _last: /** @type {TypeDefinition<Signal<(typeof OCTAVE)[number] | null>>} */ (T.object({ reactive: false, defaultValue: null })),
  _voices: /** @type {TypeDefinition<Map<string, { dampen: (at: number) => void }>>} */ (T.object({ reactive: false, defaultValue: null })),
  _audio: /** @type {TypeDefinition<AudioContext | null>} */ (T.object({ reactive: false, defaultValue: null })),
  _renders: T.number({ reactive: false, defaultValue: 0 }),
}, {
  connected() {
    this._down = Object.fromEntries(OCTAVE.map((tone) => [tone.note, signal(false)]));
    this._last = signal(/** @type {(typeof OCTAVE)[number] | null} */ (null));
    this._voices = new Map();
    globalThis.addEventListener("keydown", this._onKey);
    globalThis.addEventListener("keyup", this._onKey);
    globalThis.addEventListener("blur", this._releaseAll);
  },

  disconnected() {
    globalThis.removeEventListener("keydown", this._onKey);
    globalThis.removeEventListener("keyup", this._onKey);
    globalThis.removeEventListener("blur", this._releaseAll);
    this._releaseAll();
  },

  /** @param {KeyboardEvent} event */
  _onKey(event) {
    if (event.repeat) return;
    const tone = OCTAVE.find((t) => t.key === event.key);
    if (!tone) return;
    if (event.type === "keydown") this.noteOn(tone);
    else this.noteOff(tone);
  },

  _releaseAll() {
    for (const tone of OCTAVE) this.noteOff(tone);
  },

  /** @param {(typeof OCTAVE)[number]} tone */
  noteOn(tone) {
    if (this._down[tone.note].value) return;
    this._down[tone.note].value = true;
    this._last.value = tone;
    this.strike(tone);
  },

  /** @param {(typeof OCTAVE)[number]} tone */
  noteOff(tone) {
    this._down[tone.note].value = false;
    this.damp(tone);
  },

  /** @param {(typeof OCTAVE)[number]} tone */
  strike(tone) {
    if (!("AudioContext" in globalThis)) return;
    this._audio ??= new AudioContext();
    void this._audio.resume();
    const now = this._audio.currentTime;
    const envelope = new GainNode(this._audio, { gain: 0 });
    envelope.gain.linearRampToValueAtTime(0.22, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    const fundamental = new OscillatorNode(this._audio, { type: "triangle", frequency: tone.freq });
    const shimmer = new OscillatorNode(this._audio, { type: "sine", frequency: tone.freq * 2 });
    const shimmerGain = new GainNode(this._audio, { gain: 0.28 });
    fundamental.connect(envelope);
    shimmer.connect(shimmerGain).connect(envelope);
    envelope.connect(this._audio.destination);
    fundamental.start(now);
    shimmer.start(now);
    const stopAt = now + 2.3;
    fundamental.stop(stopAt);
    shimmer.stop(stopAt);
    this._voices.get(tone.note)?.dampen(now);
    this._voices.set(tone.note, {
      dampen: (/** @type {number} */ at) => {
        envelope.gain.cancelScheduledValues(at);
        envelope.gain.setTargetAtTime(0.0001, at, 0.06);
      },
    });
  },

  /** @param {(typeof OCTAVE)[number]} tone */
  damp(tone) {
    const voice = this._voices.get(tone.note);
    if (!voice || !this._audio) return;
    voice.dampen(this._audio.currentTime);
    this._voices.delete(tone.note);
  },

  /**
   * @param {(typeof OCTAVE)[number]} tone
   * @param {string} kind
   */
  keyFor(tone, kind) {
    const down = this._down[tone.note];
    return html`
      <button
        class=${() => `${kind} ${down.value ? "down" : ""}`}
        style=${kind === "sharp" ? `left: calc(100% / 7 * ${tone.slot})` : nothing}
        aria-label="${tone.note} (${tone.key})"
        aria-pressed=${() => down.value}
        @pointerdown=${() => this.noteOn(tone)}
        @pointerup=${() => this.noteOff(tone)}
        @pointerleave=${() => this.noteOff(tone)}
        @pointercancel=${() => this.noteOff(tone)}
        @pointerenter=${(e) => e.buttons > 0 && this.noteOn(tone)}
      ></button>
    `;
  },

  render() {
    this._renders += 1;
    return html`
      <div class="bed">
        <div class="naturals">
          ${naturals.map((tone) => this.keyFor(tone, "natural"))}
          ${sharps.map((tone) => this.keyFor(tone, "sharp"))}
        </div>
      </div>
      <p class="readout">
        <span>keys a–j play, w e t y u for sharps · drag for glissando</span>
        <span class="renders" title="how many times render() has run">render() ×${this._renders}</span>
        <b aria-live="polite">${() => {
          const tone = this._last.value;
          return tone ? `${tone.note} · ${tone.freq} Hz` : "-";
        }}</b>
      </p>
    `;
  },
});
