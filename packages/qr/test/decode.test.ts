/**
 * @file The reader: sampled grids, damage correction, the perspective map,
 * and a symbol found in frames turned, slanted, mirrored, noisy and unevenly
 * lit.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { encode, functionModules } from "../encode.js";
import { decodeQr, perspective, readMatrix } from "../decode.js";
import type { QrLevel, QrMatrix } from "../types.ts";

const PAIR = `https://example.com/#cam=${"eyJ2IjoxLCJhIjoiY2FtZXJhLWxpbmsiLCJyIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3QiLCJwIjoi".repeat(3).slice(0, 190)}`;

type Place = (x: number, y: number) => [number, number];
type Light = (x: number, y: number) => number;

const random = (initial: number) => {
  let seed = initial;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
};

const frame = (
  matrix: QrMatrix,
  { width = 480, height = 480, place, noise = 0, light = () => 1 }: { width?: number; height?: number; place: Place; noise?: number; light?: Light },
) => {
  const data = new Uint8Array(width * height);
  const rand = random(7);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const [u, v] = place(x + 0.5, y + 0.5);
      const mx = Math.floor(u);
      const my = Math.floor(v);
      const dark = mx >= 0 && my >= 0 && mx < matrix.size && my < matrix.size && matrix.modules[my * matrix.size + mx];
      const value = ((dark ? 35 : 220) + (rand() - 0.5) * noise) * light(x, y);
      data[y * width + x] = Math.max(0, Math.min(255, Math.round(value)));
    }
  return { data, width, height };
};

const turned = (size: number, scale: number, degrees: number, cx = 240, cy = 240): Place => {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (x: number, y: number) => {
    const dx = (x - cx) / scale;
    const dy = (y - cy) / scale;
    return [size / 2 + cos * dx + sin * dy, size / 2 - sin * dx + cos * dy];
  };
};

const skewed = (matrix: QrMatrix, quad: number[]): Place => perspective(quad, [0, 0, matrix.size, 0, matrix.size, matrix.size, 0, matrix.size]);

const LEVELS: QrLevel[] = ["L", "M", "Q", "H"];

for (const text of ["hi", "HELLO WORLD 123", "https://example.com/a/longer/path?with=query", "Olá, café ☕", PAIR, "x".repeat(400)])
  for (const level of LEVELS) {
    const matrix = encode(text, { level });
    eq(`readMatrix reads back ${level} v${matrix.version}`, String(readMatrix(matrix.modules, matrix.size)), text);
  }

const damagedMatrix = encode(PAIR, { level: "M" });
const { reserved } = functionModules(damagedMatrix.version);
const data = [...damagedMatrix.modules.keys()].filter((i) => !reserved[i]);
const rand = random(3);
const damaged = Uint8Array.from(damagedMatrix.modules);
for (let n = 0; n < 24; n++) {
  const i = data[Math.floor(rand() * data.length)];
  damaged[i] ^= 1;
}
eq("damaged modules are corrected", String(readMatrix(damaged, damagedMatrix.size)), PAIR);
const ruined = Uint8Array.from(damagedMatrix.modules);
for (const i of data) if (rand() < 0.3) ruined[i] ^= 1;
eq("a symbol damaged past correction is refused", String(readMatrix(ruined, damagedMatrix.size)), "null");

eq("a grid whose size is not a version is refused", String(readMatrix(new Uint8Array(22 * 22), 22)), "null");

const map = perspective([0, 0, 10, 0, 10, 10, 0, 10], [5, 7, 90, 2, 110, 95, -3, 80]);
const corners: Array<[[number, number], [number, number]]> = [[[0, 0], [5, 7]], [[10, 0], [90, 2]], [[10, 10], [110, 95]], [[0, 10], [-3, 80]]];
for (const [[x, y], [ex, ey]] of corners) {
  const [px, py] = map(x, y);
  ok(`perspective takes ${x},${y} to its corner`, Math.abs(px - ex) < 1e-6 && Math.abs(py - ey) < 1e-6);
}

const pair = encode(PAIR, { level: "M" });

eq("reads a symbol facing the camera", String(decodeQr(frame(pair, { place: turned(pair.size, 5, 0) }))), PAIR);

const small = encode("cam", { level: "M" });
eq("the small symbol is version 1", String(small.version), "1");
eq("reads a version 1 symbol with no alignment pattern", String(decodeQr(frame(small, { width: 200, height: 200, place: turned(small.size, 5, 0, 100, 100) }))), "cam");

for (const degrees of [17, 90, 145, 180, 270, 333]) eq(`reads it turned ${degrees} degrees`, String(decodeQr(frame(pair, { place: turned(pair.size, 5, degrees) }))), PAIR);

eq("reads it seen at a slant", String(decodeQr(frame(pair, { place: skewed(pair, [70, 60, 420, 95, 400, 430, 85, 400]) }))), PAIR);
eq("reads it at a second slant", String(decodeQr(frame(pair, { place: skewed(pair, [100, 60, 385, 72, 415, 425, 65, 405]) }))), PAIR);

const mirrored = turned(pair.size, 5, 10);
eq("reads it mirrored", String(decodeQr(frame(pair, { place: (x, y) => mirrored(480 - x, y) }))), PAIR);

eq("reads it through sensor noise and uneven light", String(decodeQr(frame(pair, { place: turned(pair.size, 5, 8), noise: 70, light: (x) => 0.45 + (0.55 * x) / 480 }))), PAIR);

const grey = frame(pair, { place: turned(pair.size, 5, 0) });
const rgba = new Uint8ClampedArray(grey.width * grey.height * 4);
grey.data.forEach((v, i) => rgba.set([v, v, v, 255], i * 4));
eq("reads RGBA as getImageData gives it", String(decodeQr({ data: rgba, width: grey.width, height: grey.height })), PAIR);

const noise = random(11);
const blank = new Uint8Array(320 * 240);
for (let i = 0; i < blank.length; i++) blank[i] = Math.floor(noise() * 255);
eq("answers null for a noisy frame", String(decodeQr({ data: blank, width: 320, height: 240 })), "null");
eq("answers null for a flat frame", String(decodeQr({ data: new Uint8Array(320 * 240).fill(200), width: 320, height: 240 })), "null");

done();
