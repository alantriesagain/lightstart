/**
 * Byte plumbing shared by every driver. Bytes cross the native bridge as hex
 * strings: a 200-byte media response as a JSON array of numbers is miserable
 * to read and several times the payload.
 */

/** @param {number[]|Uint8Array} bytes */
export const bytesToHex = (bytes) =>
  [...bytes].map((b) => (b & 0xff).toString(16).padStart(2, "0")).join("");

/** @param {string} hex @returns {number[]} */
export const hexToBytes = (hex) => {
  const clean = String(hex ?? "").trim();
  if (clean.length % 2 !== 0) throw new Error("odd-length-hex");
  const out = [];
  for (let i = 0; i < clean.length; i += 2) {
    const byte = Number.parseInt(clean.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid-hex");
    out.push(byte);
  }
  return out;
};

/**
 * Split a payload into ATT-sized writes. 20 bytes is the safe default MTU
 * before negotiation; a driver that negotiates larger can pass its own size.
 * @param {number[]|Uint8Array} bytes
 * @param {number} [size]
 * @returns {number[][]}
 */
export const chunk = (bytes, size = 20) => {
  if (!(size > 0)) throw new Error("chunk-size-must-be-positive");
  const all = [...bytes];
  if (!all.length) return [];
  const out = [];
  for (let i = 0; i < all.length; i += size) out.push(all.slice(i, i + size));
  return out;
};
