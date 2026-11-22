/**
 * @file Torrent signaler: WebTorrent trackers as a free, public rendezvous. A
 * broadcast signaler: the room announces a pool of sealed offers under
 * the room's info_hash, the tracker forwards them to whoever announced
 * the same hash, and answers ride back to the offerer. Pure: no app;
 * the socket constructor is injected for node tests.
 *
 * Tracker wire (JSON over WebSocket):
 *   announce  { action: "announce", info_hash, peer_id, numwant, offers: [{ offer_id, offer }] }
 *   forwarded { action: "announce", info_hash, peer_id, offer_id, offer }
 *   answer    { action: "announce", info_hash, peer_id, to_peer_id, offer_id, answer }
 *   forwarded { action: "announce", info_hash, peer_id, offer_id, answer }
 *   reply     { action: "announce", interval, "failure reason"?, "warning message"? }
 */

import { createReconnectingSocket } from "./reconnect.js";

/** @import { BroadcastSignaler, SignalPayload } from "../types.ts" */

export const DEFAULT_TRACKERS = [
  "wss://tracker.webtorrent.dev",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.files.fm:7073/announce",
];

const NUMWANT = 10;
const MAX_ATTEMPTS = 4;
const MIN_INTERVAL_MS = 10000;
const MAX_INTERVAL_MS = 120000;
const SEEN_LIMIT = 500;

/**
 * @param {{ trackers?: string[], infoHash: Uint8Array, selfId: string, WebSocket?: typeof WebSocket, announceInterval?: number }} config
 * @returns {BroadcastSignaler}
 */
export const createTorrentSignaler = ({ trackers = DEFAULT_TRACKERS, infoHash, selfId, WebSocket: Socket, announceInterval = 33333 }) => {
  const hash = String.fromCharCode(...infoHash);
  /** @type {Set<(signal: SignalPayload) => void>} */
  const offerHandlers = new Set();
  /** @type {Set<(signal: SignalPayload) => void>} */
  const answerHandlers = new Set();
  /** @type {Set<(reason: string) => void>} */
  const closeHandlers = new Set();
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Map<string, ReturnType<typeof createReconnectingSocket>>} */
  const offerSources = new Map();
  /** @type {Array<{ offerId: string, payload: unknown }>} */
  let offers = [];
  let interval = announceInterval;
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
      catch (e) { console.warn("[torrent] handler threw:", e); }
  };

  /** @param {string} key @returns {boolean} */
  const remember = (key) => {
    if (seen.has(key)) return false;
    if (seen.size >= SEEN_LIMIT) seen.delete(/** @type {string} */ (seen.keys().next().value));
    seen.add(key);
    return true;
  };

  /** @param {ReturnType<typeof createReconnectingSocket>} socket */
  const announceOn = (socket) => {
    socket.send(JSON.stringify({
      action: "announce", info_hash: hash, peer_id: selfId, numwant: NUMWANT,
      ...(offers.length ? { offers: offers.map(({ offerId, payload }) => ({ offer_id: offerId, offer: { type: "offer", sdp: payload } })) } : {}),
    }));
  };

  const announceAll = () => {
    for (const socket of sockets) announceOn(socket);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (closed) return;
    timer = setTimeout(() => { announceAll(); schedule(); }, interval);
  };

  const sockets = trackers.map((url) => {
    /** @type {ReturnType<typeof createReconnectingSocket>} */
    const socket = createReconnectingSocket({
      url,
      WebSocket: Socket,
      maxAttempts: MAX_ATTEMPTS,
      onGiveUp: (attempts) => console.warn(`[p2p] tracker ${url} unreachable after ${attempts} attempts; leaving it out`),
      onOpen: () => { resolveReady(); announceOn(socket); },
      onMessage: (data) => {
        let msg;
        try { msg = JSON.parse(String(data)); } catch { return; }
        if (msg["failure reason"]) return void console.warn(`[torrent] ${url}: ${msg["failure reason"]}`);
        if (msg["warning message"]) console.warn(`[torrent] ${url}: ${msg["warning message"]}`);
        if (msg.action !== "announce" || msg.info_hash !== hash) return;
        if (typeof msg.interval === "number") {
          const next = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, msg.interval * 1000));
          if (next !== interval) { interval = next; schedule(); }
        }
        if (msg.peer_id === selfId || !msg.offer_id) return;
        if (msg.offer?.sdp !== undefined) {
          if (!remember(`o:${msg.peer_id}:${msg.offer_id}`)) return;
          offerSources.set(msg.offer_id, socket);
          emitAll(offerHandlers, { peerId: msg.peer_id, offerId: msg.offer_id, payload: msg.offer.sdp });
        } else if (msg.answer?.sdp !== undefined) {
          if (!remember(`a:${msg.peer_id}:${msg.offer_id}`)) return;
          emitAll(answerHandlers, { peerId: msg.peer_id, offerId: msg.offer_id, payload: msg.answer.sdp });
        }
      },
    });
    return socket;
  });

  schedule();

  return {
    id: "torrent",
    selfId,
    ready,
    announce: (next) => {
      offers = next;
      announceAll();
      schedule();
    },
    answer: (peerId, offerId, payload) => {
      const frame = JSON.stringify({
        action: "announce", info_hash: hash, peer_id: selfId, to_peer_id: peerId, offer_id: offerId,
        answer: { type: "answer", sdp: payload },
      });
      const source = offerSources.get(offerId);
      if (source?.send(frame)) return;
      for (const socket of sockets) socket.send(frame);
    },
    onOffer: (handler) => { offerHandlers.add(handler); return () => offerHandlers.delete(handler); },
    onAnswer: (handler) => { answerHandlers.add(handler); return () => answerHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      for (const socket of sockets) socket.close();
      for (const handler of closeHandlers) handler("closed");
    },
  };
};
