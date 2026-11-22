/**
 * @file MQTT 3.1.1 packet codec, the subset a signaling client needs: CONNECT,
 * CONNACK, PUBLISH (QoS 0), SUBSCRIBE, SUBACK, PINGREQ, PINGRESP,
 * DISCONNECT. Pure: no app, no DOM.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CONNECT = 1;
const CONNACK = 2;
const PUBLISH = 3;
const SUBSCRIBE = 8;
const SUBACK = 9;
const PINGREQ = 12;
const PINGRESP = 13;
const DISCONNECT = 14;

/** @param {string} text @returns {number[]} */
const utf8Field = (text) => {
  const bytes = encoder.encode(text);
  if (bytes.length > 0xffff) throw new Error("mqtt: string field over 65535 bytes");
  return [bytes.length >> 8, bytes.length & 0xff, ...bytes];
};

/** @param {number} length @returns {number[]} */
const remainingLength = (length) => {
  const out = [];
  do {
    let byte = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) byte |= 0x80;
    out.push(byte);
  } while (length > 0);
  return out;
};

/**
 * @param {number} type
 * @param {number} flags
 * @param {number[]} body
 * @returns {Uint8Array}
 */
const packet = (type, flags, body) =>
  Uint8Array.from([(type << 4) | flags, ...remainingLength(body.length), ...body]);

/**
 * @param {{ clientId: string, keepAlive?: number }} options
 * @returns {Uint8Array}
 */
export const encodeConnect = ({ clientId, keepAlive = 30 }) =>
  packet(CONNECT, 0, [...utf8Field("MQTT"), 4, 0x02, keepAlive >> 8, keepAlive & 0xff, ...utf8Field(clientId)]);

/**
 * @param {string} topic
 * @param {Uint8Array | string} payload
 * @returns {Uint8Array}
 */
export const encodePublish = (topic, payload) => {
  const bytes = typeof payload === "string" ? encoder.encode(payload) : payload;
  return packet(PUBLISH, 0, [...utf8Field(topic), ...bytes]);
};

/**
 * @param {number} packetId
 * @param {string[]} topics
 * @returns {Uint8Array}
 */
export const encodeSubscribe = (packetId, topics) =>
  packet(SUBSCRIBE, 0x02, [packetId >> 8, packetId & 0xff, ...topics.flatMap((topic) => [...utf8Field(topic), 0])]);

/** @returns {Uint8Array} */
export const encodePingReq = () => packet(PINGREQ, 0, []);
/** @returns {Uint8Array} */
export const encodeDisconnect = () => packet(DISCONNECT, 0, []);

/**
 * @param {{ sessionPresent?: boolean, code?: number }} [options]
 * @returns {Uint8Array}
 */
export const encodeConnAck = ({ sessionPresent = false, code = 0 } = {}) =>
  packet(CONNACK, 0, [sessionPresent ? 1 : 0, code]);

/**
 * @param {number} packetId
 * @param {number[]} codes
 * @returns {Uint8Array}
 */
export const encodeSubAck = (packetId, codes) => packet(SUBACK, 0, [packetId >> 8, packetId & 0xff, ...codes]);
/** @returns {Uint8Array} */
export const encodePingResp = () => packet(PINGRESP, 0, []);

/**
 * @typedef {{ type: "connack", sessionPresent: boolean, code: number }
 *   | { type: "publish", topic: string, payload: Uint8Array, text: string }
 *   | { type: "subscribe", packetId: number, topics: string[] }
 *   | { type: "suback", packetId: number, codes: number[] }
 *   | { type: "connect", clientId: string, keepAlive: number }
 *   | { type: "pingreq" } | { type: "pingresp" } | { type: "disconnect" }
 *   | { type: "unknown", code: number }} MqttPacket
 */

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {{ text: string, end: number }}
 */
const readField = (bytes, offset) => {
  const length = (bytes[offset] << 8) | bytes[offset + 1];
  const end = offset + 2 + length;
  return { text: decoder.decode(bytes.subarray(offset + 2, end)), end };
};

/**
 * Decode every complete packet at the head of `bytes`; the remainder is
 * the partial tail to prepend to the next read.
 * @param {Uint8Array} bytes
 * @returns {{ packets: MqttPacket[], rest: Uint8Array }}
 */
export const decodePackets = (bytes) => {
  /** @type {MqttPacket[]} */
  const packets = [];
  let offset = 0;
  while (offset < bytes.length) {
    const first = bytes[offset];
    let length = 0;
    let multiplier = 1;
    let cursor = offset + 1;
    let byte;
    do {
      if (cursor >= bytes.length) return { packets, rest: bytes.subarray(offset) };
      byte = bytes[cursor++];
      length += (byte & 0x7f) * multiplier;
      multiplier *= 128;
    } while (byte & 0x80);
    const end = cursor + length;
    if (end > bytes.length) return { packets, rest: bytes.subarray(offset) };
    const body = bytes.subarray(cursor, end);
    packets.push(decodeBody(first >> 4, body));
    offset = end;
  }
  return { packets, rest: bytes.subarray(offset) };
};

/**
 * @param {number} type
 * @param {Uint8Array} body
 * @returns {MqttPacket}
 */
const decodeBody = (type, body) => {
  if (type === CONNACK) return { type: "connack", sessionPresent: Boolean(body[0] & 1), code: body[1] };
  if (type === PUBLISH) {
    const { text: topic, end } = readField(body, 0);
    const payload = body.subarray(end);
    return { type: "publish", topic, payload, text: decoder.decode(payload) };
  }
  if (type === SUBACK) return { type: "suback", packetId: (body[0] << 8) | body[1], codes: [...body.subarray(2)] };
  if (type === SUBSCRIBE) {
    const packetId = (body[0] << 8) | body[1];
    const topics = [];
    let offset = 2;
    while (offset < body.length) {
      const { text, end } = readField(body, offset);
      topics.push(text);
      offset = end + 1;
    }
    return { type: "subscribe", packetId, topics };
  }
  if (type === CONNECT) {
    const { end: afterProtocol } = readField(body, 0);
    const keepAlive = (body[afterProtocol + 2] << 8) | body[afterProtocol + 3];
    const { text: clientId } = readField(body, afterProtocol + 4);
    return { type: "connect", clientId, keepAlive };
  }
  if (type === PINGREQ) return { type: "pingreq" };
  if (type === PINGRESP) return { type: "pingresp" };
  if (type === DISCONNECT) return { type: "disconnect" };
  return { type: "unknown", code: type };
};
