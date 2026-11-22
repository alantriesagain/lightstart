/**
 * @file Room crypto for public signaling: the room password derives an
 * AES-GCM key that seals every signal payload, so trackers and brokers relay
 * opaque blobs. Pure WebCrypto: no app, no DOM. Needs a secure context
 * (`hasSubtle()` says); the relay signaler never needs it.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 100000;
const IV_BYTES = 12;

/** Whether this runtime has the WebCrypto the public signalers need. */
export const hasSubtle = () => typeof globalThis.crypto?.subtle?.deriveKey === "function";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const bytesToBase64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin);
};

/**
 * @param {string} text
 * @returns {Uint8Array}
 */
export const base64ToBytes = (text) => {
  const bin = atob(text);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export const bytesToHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The 20-byte room digest public signalers key on: SHA-1 of `appId@roomId`
 * (the WebTorrent info_hash size).
 * @param {string} appId
 * @param {string} roomId
 * @returns {Promise<Uint8Array>}
 */
export const roomDigest = async (appId, roomId) =>
  new Uint8Array(await crypto.subtle.digest("SHA-1", encoder.encode(`${appId}@${roomId}`)));

/**
 * @param {string} appId
 * @param {string} password
 * @returns {Promise<CryptoKey>}
 */
export const deriveRoomKey = async (appId, password) => {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode(`lightstart/p2p/${appId}`), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

/**
 * @param {CryptoKey} key
 * @param {unknown} value
 * @returns {Promise<string>} base64(iv + ciphertext)
 */
export const seal = async (key, value) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return bytesToBase64(out);
};

/**
 * @param {CryptoKey} key
 * @param {string} sealed
 * @returns {Promise<unknown>} the value, or null when the blob is not ours
 */
export const open = async (key, sealed) => {
  try {
    const bytes = base64ToBytes(sealed);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: /** @type {BufferSource} */ (/** @type {unknown} */ (bytes.subarray(0, IV_BYTES))) }, key, /** @type {BufferSource} */ (/** @type {unknown} */ (bytes.subarray(IV_BYTES))));
    return JSON.parse(decoder.decode(plain));
  } catch {
    return null;
  }
};
