/**
 * @file MQTT signaler: public brokers as a free rendezvous. A broadcast
 * signaler: sealed offers publish on the room topic, answers on the
 * offerer's own topic; every broker in the list carries the same frames
 * and duplicates are dropped by id. Pure: no app; the socket constructor is
 * injected for node tests.
 */

import { createReconnectingSocket } from "./reconnect.js";
import { decodePackets, encodeConnect, encodePingReq, encodePublish, encodeSubscribe } from "./mqtt-packet.js";

/** @import { BroadcastSignaler, SignalPayload } from "../types.ts" */

export const DEFAULT_BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081",
];

const SEEN_LIMIT = 500;
const MAX_ATTEMPTS = 4;

/**
 * @param {{ brokers?: string[], roomHash: string, selfId: string, WebSocket?: typeof WebSocket, announceInterval?: number, keepAlive?: number }} config
 * @returns {BroadcastSignaler}
 */
export const createMqttSignaler = ({ brokers = DEFAULT_BROKERS, roomHash, selfId, WebSocket: Socket, announceInterval = 33333, keepAlive = 30 }) => {
  const roomTopic = `lightstart/${roomHash}`;
  const ownTopic = `${roomTopic}/${selfId}`;
  /** @type {Set<(signal: SignalPayload) => void>} */
  const offerHandlers = new Set();
  /** @type {Set<(signal: SignalPayload) => void>} */
  const answerHandlers = new Set();
  /** @type {Set<(reason: string) => void>} */
  const closeHandlers = new Set();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Array<{ offerId: string, payload: unknown }>} */
  let offers = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  let closed = false;
  /** @type {(value?: unknown) => void} */
  let resolveReady = () => {};
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  /**
   * @template T
   * @param {Set<(detail: T) => void>} handlers
   * @param {T} detail
   */
  const emitAll = (handlers, detail) => {
    for (const handler of handlers)
      try { handler(detail); }
      catch (e) { console.warn("[mqtt] handler threw:", e); }
  };

  /** @param {string} key @returns {boolean} */
  const remember = (key) => {
    if (seen.has(key)) return false;
    if (seen.size >= SEEN_LIMIT) seen.delete(/** @type {string} */ (seen.keys().next().value));
    seen.add(key);
    return true;
  };

  /** @param {string} text */
  const handleFrame = (text) => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (!msg || msg.from === selfId || typeof msg.offerId !== "string") return;
    if (msg.t === "offer") {
      if (!remember(`o:${msg.from}:${msg.offerId}`)) return;
      emitAll(offerHandlers, { peerId: msg.from, offerId: msg.offerId, payload: msg.payload });
    } else if (msg.t === "answer") {
      if (!remember(`a:${msg.from}:${msg.offerId}`)) return;
      emitAll(answerHandlers, { peerId: msg.from, offerId: msg.offerId, payload: msg.payload });
    }
  };

  const connections = brokers.map((url) => {
    let subscribed = false;
    /** @type {Uint8Array<ArrayBufferLike>} */
    let rest = new Uint8Array(0);
    /** @type {ReturnType<typeof setInterval> | null} */
    let ping = null;
    const stopPing = () => { if (ping) clearInterval(ping); ping = null; };
    /** @type {ReturnType<typeof createReconnectingSocket>} */
    const socket = createReconnectingSocket({
      url,
      protocols: ["mqtt"],
      binaryType: "arraybuffer",
      WebSocket: Socket,
      maxAttempts: MAX_ATTEMPTS,
      onGiveUp: (attempts) => console.warn(`[p2p] broker ${url} unreachable after ${attempts} attempts; leaving it out`),
      onOpen: () => {
        subscribed = false;
        rest = new Uint8Array(0);
        socket.send(encodeConnect({ clientId: selfId, keepAlive }));
      },
      onMessage: (data) => {
        const chunk = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(/** @type {ArrayBufferLike} */ (data));
        const joined = new Uint8Array(rest.length + chunk.length);
        joined.set(rest);
        joined.set(chunk, rest.length);
        const decoded = decodePackets(joined);
        rest = decoded.rest;
        for (const packet of decoded.packets)
          if (packet.type === "connack") {
            if (packet.code !== 0) return void console.warn(`[mqtt] ${url}: connection refused (${packet.code})`);
            socket.send(encodeSubscribe(1, [roomTopic, ownTopic]));
            stopPing();
            ping = setInterval(() => socket.send(encodePingReq()), keepAlive * 750);
          } else if (packet.type === "suback") {
            subscribed = true;
            resolveReady();
            publishOffers();
          } else if (packet.type === "publish") handleFrame(packet.text);
      },
      onClose: () => { subscribed = false; stopPing(); },
    });
    const publishOffers = () => {
      if (!subscribed) return;
      for (const { offerId, payload } of offers)
        socket.send(encodePublish(roomTopic, JSON.stringify({ t: "offer", from: selfId, offerId, payload })));
    };
    return {
      publishOffers,
      /** @param {string} topic @param {string} text */
      publish: (topic, text) => subscribed && socket.send(encodePublish(topic, text)),
      close: () => { stopPing(); socket.close(); },
    };
  });

  const announceAll = () => {
    for (const connection of connections) connection.publishOffers();
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (closed) return;
    timer = setTimeout(() => { announceAll(); schedule(); }, announceInterval);
  };

  schedule();

  return {
    id: "mqtt",
    selfId,
    ready,
    announce: (next) => {
      offers = next;
      announceAll();
      schedule();
    },
    answer: (peerId, offerId, payload) => {
      const text = JSON.stringify({ t: "answer", from: selfId, offerId, payload });
      for (const connection of connections) connection.publish(`${roomTopic}/${peerId}`, text);
    },
    onOffer: (handler) => { offerHandlers.add(handler); return () => offerHandlers.delete(handler); },
    onAnswer: (handler) => { answerHandlers.add(handler); return () => answerHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      for (const connection of connections) connection.close();
      for (const handler of closeHandlers) handler("closed");
    },
  };
};
