/**
 * @file `@lightstart/pix`: paying with Pix. The BR Code a payer scans or
 * pastes, built the same in a browser and under node, and the checkout view a
 * `@lightstart/billing` method draws.
 */

export { brcode, crc16, pixText } from "./lib/brcode.ts";
export type { PixCharge, PixCode, PixSettings } from "./types.ts";
