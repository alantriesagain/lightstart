/**
 * What each exposure mode lets you set and what it leaves to the camera: the
 * table a body's readout reads, so a cell is `set` (yours, on the dial), `auto`
 * (the camera's, shown with an A), `locked` (the lens cannot change it) or
 * `hidden`. Only what the sensor takes is a cell: the lens, the shutter, the
 * ISO, the exposure bias, the focus.
 */

/** @typedef {"set" | "auto" | "locked" | "hidden"} Availability */
/** @typedef {"mode" | "shutter" | "aperture" | "iso" | "ev" | "focus"} Cell */
/** @import { ModeId } from "./bodies.js" */

/** @type {Record<ModeId, Record<Cell, Availability>>} */
const TABLE = {
  auto: { mode: "set", shutter: "auto", aperture: "auto", iso: "auto", ev: "auto", focus: "auto" },
  p: { mode: "set", shutter: "auto", aperture: "auto", iso: "auto", ev: "set", focus: "set" },
  av: { mode: "set", shutter: "auto", aperture: "set", iso: "set", ev: "set", focus: "set" },
  tv: { mode: "set", shutter: "set", aperture: "auto", iso: "set", ev: "set", focus: "set" },
  m: { mode: "set", shutter: "set", aperture: "set", iso: "set", ev: "set", focus: "set" },
  b: { mode: "set", shutter: "hidden", aperture: "set", iso: "set", ev: "hidden", focus: "set" },
};

export const CELLS = /** @type {Cell[]} */ (["mode", "shutter", "aperture", "iso", "ev", "focus"]);

/**
 * @param {ModeId} mode
 * @param {Cell} cell
 * @param {{ fixedAperture?: boolean, autoIso?: boolean }} [lens]
 * @returns {Availability}
 */
export const availability = (mode, cell, lens = {}) => {
  const base = TABLE[mode][cell];
  if (cell === "aperture" && lens.fixedAperture && base !== "hidden") return "locked";
  if (cell === "iso" && lens.autoIso && base === "set") return "auto";
  return base;
};

/** The cells a dial can turn in a mode, in readout order. */
/** @param {ModeId} mode @param {{ fixedAperture?: boolean }} [lens] */
export const settable = (mode, lens = {}) => CELLS.filter((c) => availability(mode, c, lens) === "set");
