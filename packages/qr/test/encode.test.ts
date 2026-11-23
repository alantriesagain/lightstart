/**
 * @file The encoder against its own reader: placement, Reed-Solomon
 * syndromes, format and version information, version selection, UTF-8 and
 * all four levels.
 */

import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import { alignmentPositions, dataOrder, encode, formatInfo, functionModules, layout, maskBit, versionInfo } from "../encode.js";
import type { QrLevel, QrMatrix } from "../types.ts";

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

const LEVEL_OF: Record<number, QrLevel> = { 1: "L", 0: "M", 3: "Q", 2: "H" };

const readFormat = ({ size, modules }: { size: number; modules: Uint8Array }) => {
  let bits = 0;
  for (let i = 0; i < 6; i++) bits |= modules[i * size + 8] << i;
  bits |= modules[7 * size + 8] << 6;
  bits |= modules[8 * size + 8] << 7;
  bits |= modules[8 * size + 7] << 8;
  for (let i = 9; i < 15; i++) bits |= modules[8 * size + (14 - i)] << i;
  const data = (bits ^ 0x5412) >> 10;
  return { level: LEVEL_OF[data >> 3], mask: data & 7, raw: bits };
};

const readVersion = ({ size, modules }: { size: number; modules: Uint8Array }) => {
  let bits = 0;
  for (let i = 0; i < 18; i++) bits |= modules[Math.floor(i / 3) * size + size - 11 + (i % 3)] << i;
  return bits >> 12;
};

const syndromesAreZero = (codeword: number[], ecCount: number) => {
  for (let s = 0; s < ecCount; s++) {
    let acc = 0;
    for (const byte of codeword) acc = mul(acc, EXP[s]) ^ byte;
    if (acc !== 0) return false;
  }
  return true;
};

const readBack = (matrix: QrMatrix) => {
  const { version, size, modules, mask, level } = matrix;
  const { blocks, ecPerBlock, shortLen, longBlocks } = layout(version, level);
  const { reserved } = functionModules(version);
  const order = dataOrder(size, reserved);
  const bytes: number[] = [];
  let acc = 0;
  let n = 0;
  for (const index of order) {
    const x = index % size;
    const y = (index - x) / size;
    acc = (acc << 1) | (modules[index] ^ (maskBit(mask, x, y) ? 1 : 0));
    if (++n === 8) { bytes.push(acc); acc = 0; n = 0; }
  }
  const dataBlocks: number[][] = Array.from({ length: blocks }, () => []);
  const ecBlocks: number[][] = Array.from({ length: blocks }, () => []);
  let cursor = 0;
  for (let i = 0; i <= shortLen; i++)
    for (let b = 0; b < blocks; b++) {
      const len = shortLen + (b >= blocks - longBlocks ? 1 : 0);
      if (i < len) dataBlocks[b].push(bytes[cursor++]);
    }
  for (let i = 0; i < ecPerBlock; i++) for (let b = 0; b < blocks; b++) ecBlocks[b].push(bytes[cursor++]);
  for (let b = 0; b < blocks; b++) ok(`block ${b} syndromes`, syndromesAreZero([...dataBlocks[b], ...ecBlocks[b]], ecPerBlock));
  const data = dataBlocks.flat();
  let bit = 0;
  const take = (width: number) => {
    let v = 0;
    for (let i = 0; i < width; i++, bit++) v = (v << 1) | ((data[bit >> 3] >> (7 - (bit & 7))) & 1);
    return v;
  };
  eq("byte mode indicator", String(take(4)), "4");
  const count = take(version < 10 ? 8 : 16);
  const payload = new Uint8Array(count);
  for (let i = 0; i < count; i++) payload[i] = take(8);
  return new TextDecoder().decode(payload);
};

const LEVELS: QrLevel[] = ["L", "M", "Q", "H"];

const short = encode("hello world", { level: "M" });
eq("a short string is version 1", String(short.version), "1");
eq("a version 1 symbol is 21 modules", String(short.size), "21");
eq("a short string reads back", readBack(short), "hello world");
eq("level M has ten error-correction codewords per block", String(layout(1, "M").ecPerBlock), "10");

for (const level of LEVELS)
  for (const mask of [0, 3, 7]) {
    const m = encode("format", { level, mask });
    eq(`the format information decodes back at ${level} mask ${mask}`, JSON.stringify(readFormat(m)), JSON.stringify({ level, mask, raw: formatInfo(level, mask) }));
  }

const url = `http://192.168.0.12:3520/settings#peer=${"eyJ2IjozLCJhIjoiY2VudGF2byIsInIiOiJhYmMifQ".repeat(5)}`;
const pairing = encode(url, { level: "M" });
eq("a pairing URL lands in version 11", String(pairing.version), "11");
eq("version 11 at level M has five blocks", String(layout(11, "M").blocks), "5");
eq("a pairing URL reads back", readBack(pairing), url);

const text = "café 日本語 😀";
eq("UTF-8 goes through byte mode", readBack(encode(text, { level: "L" })), text);

const long = encode("x".repeat(150), { level: "L" });
ok("a long payload is version 7 or later", long.version >= 7);
eq("the version information reads back", String(readVersion(long)), String(long.version));
eq("version 7 information is the standard's", String(versionInfo(7)), String(0x07c94));

eq("fourteen bytes fit version 1 at level M", String(encode("x".repeat(14), { level: "M" }).version), "1");
eq("fifteen bytes grow to version 2", String(encode("x".repeat(15), { level: "M" }).version), "2");
eq("2953 bytes fill version 40 at level L", String(encode("x".repeat(2953), { level: "L" }).version), "40");
throws("2954 bytes do not fit version 40", () => encode("x".repeat(2954), { level: "L" }), "do not fit version 40");

const auto = encode("mask me", { level: "Q" });
ok("the scored mask is one of the eight", auto.mask >= 0 && auto.mask <= 7);
const forced = encode("mask me", { level: "Q", mask: auto.mask });
eq("forcing the scored mask draws the same modules", JSON.stringify([...forced.modules]), JSON.stringify([...auto.modules]));

const finders = functionModules(7);
const at = (x: number, y: number) => finders.modules[y * finders.size + x];
for (const [cx, cy] of [[3, 3], [finders.size - 4, 3], [3, finders.size - 4]]) {
  eq(`finder centre ${cx},${cy} is dark`, String(at(cx, cy)), "1");
  eq(`finder ring ${cx},${cy} is light`, String(at(cx + 2, cy)), "0");
  eq(`finder edge ${cx},${cy} is dark`, String(at(cx + 3, cy)), "1");
  eq(`finder separator ${cx},${cy} is light`, String(at(cx, cy + (cy < 8 ? 4 : -4))), "0");
}
eq("the timing pattern survives the format reservation", String(at(8, 6)), "1");
eq("the timing pattern survives across", String(at(6, 8)), "1");
eq("alignment positions at version 7", JSON.stringify(alignmentPositions(7)), JSON.stringify([6, 22, 38]));
eq("alignment positions at version 32", JSON.stringify(alignmentPositions(32)), JSON.stringify([6, 34, 60, 86, 112, 138]));
eq("alignment positions at version 40", JSON.stringify(alignmentPositions(40)), JSON.stringify([6, 30, 58, 86, 114, 142, 170]));
eq("the alignment centre is dark", String(at(22, 22)), "1");
eq("the alignment ring is light", String(at(21, 22)), "0");
eq("the alignment edge is dark", String(at(20, 22)), "1");
eq("the dark module is dark", String(at(8, finders.size - 8)), "1");

const repeated = "0123456789".repeat(60);
for (const level of LEVELS) {
  const m = encode(repeated, { level });
  eq(`${level} reads back a large payload`, readBack(m), repeated);
  ok(`${level} spans several blocks`, layout(m.version, level).blocks > 1);
}

done();
