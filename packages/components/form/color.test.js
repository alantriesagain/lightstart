import assert from "node:assert/strict";
import { test } from "node:test";
import { formatHex, parseHex, sameColor } from "./color.js";

test("every hex spelling reads as six lowercase digits, with the alpha it carried", () => {
  assert.deepEqual(parseHex("#FF725E"), { hex: "#ff725e", alpha: null });
  assert.deepEqual(parseHex("ff725e"), { hex: "#ff725e", alpha: null });
  assert.deepEqual(parseHex("#abc"), { hex: "#aabbcc", alpha: null });
  assert.deepEqual(parseHex("#abcd"), { hex: "#aabbcc", alpha: 0.867 });
  assert.deepEqual(parseHex("#ff725e80"), { hex: "#ff725e", alpha: 0.502 });
  assert.deepEqual(parseHex("#ff725eff"), { hex: "#ff725e", alpha: 1 });
});

test("what is not a colour reads as no colour", () => {
  for (const value of ["", "red", "#12", "#12345", null, undefined, 42]) assert.deepEqual(parseHex(value), { hex: "", alpha: null });
});

test("a colour is written with its alpha only when the control tracks alpha and it is below one", () => {
  assert.equal(formatHex("#FF725E", null, false), "#ff725e");
  assert.equal(formatHex("#ff725e", 0.5, false), "#ff725e", "a control without alpha drops it");
  assert.equal(formatHex("#ff725e", 0.5, true), "#ff725e80");
  assert.equal(formatHex("#ff725e", 1, true), "#ff725e");
  assert.equal(formatHex("#ff725e", 0, true), "#ff725e00");
  assert.equal(formatHex("#ff725e", 1.7, true), "#ff725e", "alpha is clamped");
  assert.equal(formatHex("nope", 0.5, true), "");
});

test("two spellings of one colour are the same colour", () => {
  assert.equal(sameColor("#FFF", "#ffffff"), true);
  assert.equal(sameColor("#ffffffff", "#fff"), true);
  assert.equal(sameColor("#ffffff80", "#fff"), false);
  assert.equal(sameColor("", ""), false);
});
