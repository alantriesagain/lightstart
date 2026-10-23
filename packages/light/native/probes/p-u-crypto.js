/**
 * @file Probe U: `crypto.randomBytes` as the asset server's per-launch token, and `Math.random`
 * as its fallback. Prints lengths and shapes only, so node and native outputs match.
 */
import { randomBytes } from "node:crypto";

const token = randomBytes(16).toString("hex");
console.log("randomBytes hex length", token.length, /^[0-9a-f]+$/.test(token));
const a = randomBytes(8);
const b = randomBytes(8);
console.log("two draws differ", a.toString("hex") !== b.toString("hex"));
let fallback = "";
for (let i = 0; i < 8; i++) fallback += Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
console.log("fallback length", fallback.length);

export {};
