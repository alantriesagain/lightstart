/**
 * The names a body prints: what Canon and Nikon call each mode, each setting
 * and each button, and where it sits on the body, so the camera can speak one
 * of them and the owner can carry the words to a real camera.
 */

/** @typedef {"canon" | "nikon"} BodyId */
/** @typedef {"auto" | "p" | "av" | "tv" | "m" | "b"} ModeId */

/** The modes a fixed lens offers, in the order the menu lists them. Av and B stay in the vocabulary and off the menu. */
export const MODE_ORDER = /** @type {ModeId[]} */ (["auto", "p", "tv", "m"]);

const CANON = {
  name: "Canon",
  modes: { auto: "A+", p: "P", av: "Av", tv: "Tv", m: "M", b: "B" },
  modeNames: { auto: "Scene Intelligent Auto", p: "Program", av: "Aperture priority", tv: "Shutter priority", m: "Manual", b: "Bulb" },
  controls: { shutter: "Shutter", aperture: "Aperture", iso: "ISO", ev: "EV", wb: "WB", mode: "Mode", aeLock: "✱", afOn: "AF-ON", quick: "Q" },
  metering: { evaluative: "Evaluative", centre: "Centre-weighted", spot: "Spot", partial: "Partial" },
  focus: { single: "One Shot", continuous: "Servo", manual: "MF" },
  placement: { shutter: "Main dial, top right, under the index finger", aperture: "Quick control dial, on the back under the thumb", iso: "ISO button on top, then the main dial", ev: "Quick control dial, with the ✱ held", mode: "Mode dial, top left" },
};

const NIKON = {
  name: "Nikon",
  modes: { auto: "AUTO", p: "P", av: "A", tv: "S", m: "M", b: "B" },
  modeNames: { auto: "Auto", p: "Programmed auto", av: "Aperture priority", tv: "Shutter priority", m: "Manual", b: "Bulb" },
  controls: { shutter: "Shutter", aperture: "Aperture", iso: "ISO", ev: "EV", wb: "WB", mode: "Mode", aeLock: "AE-L", afOn: "AF-ON", quick: "i" },
  metering: { evaluative: "Matrix", centre: "Centre-weighted", spot: "Spot", partial: "Highlight-weighted" },
  focus: { single: "AF-S", continuous: "AF-C", manual: "MF" },
  placement: { shutter: "Main command dial, on the back under the thumb", aperture: "Sub-command dial, at the front under the index finger", iso: "ISO button, then the main command dial", ev: "Exposure compensation button, then the main command dial", mode: "Mode dial, top left" },
};

export const BODIES = { canon: CANON, nikon: NIKON };

/** @param {BodyId} body @param {ModeId} mode */
export const modeLabel = (body, mode) => BODIES[body].modes[mode];

/** @param {BodyId} body @param {ModeId} mode */
export const modeName = (body, mode) => BODIES[body].modeNames[mode];

/** @param {BodyId} body @param {keyof typeof CANON.controls} control */
export const controlLabel = (body, control) => BODIES[body].controls[control];

/** @param {BodyId} body @param {keyof typeof CANON.placement} control */
export const placement = (body, control) => BODIES[body].placement[control];

/** The other body's word for the same mode, for the line under the dial. */
/** @param {BodyId} body @param {ModeId} mode */
export const modeAside = (body, mode) => {
  const other = /** @type {BodyId} */ (body === "canon" ? "nikon" : "canon");
  const mine = modeLabel(body, mode);
  const theirs = modeLabel(other, mode);
  return mine === theirs ? "" : `A ${BODIES[other].name} calls it ${theirs}.`;
};

/** One line that says what a mode does: who sets what, and the other body's word for it unless `aside` is off. */
/** @param {BodyId} body @param {ModeId} mode @param {{ aside?: boolean }} [opts] */
export const modeLine = (body, mode, opts) => {
  const aside = opts?.aside ?? true;
  const lines = {
    auto: "The camera sets everything.",
    p: "You set EV, it sets the rest.",
    av: "You set the aperture, it sets the shutter.",
    tv: "You set the shutter, ISO follows the light.",
    m: "You set the shutter and the ISO.",
    b: "The shutter stays open while you hold it.",
  };
  const other = aside ? modeAside(body, mode) : "";
  return other ? `${lines[mode]} ${other}` : lines[mode];
};
