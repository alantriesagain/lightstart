/**
 * @file One WebRTC peer: an `RTCPeerConnection` with a single ordered data
 * channel, offer/answer either gathered complete (for broadcast signalers)
 * or trickled (for the relay), chunked sends with backpressure, and one
 * `close` for every way a connection ends. The connection constructor is
 * injected so node tests script it.
 *
 * With `video`, both sides negotiate one video slot that can send and
 * receive, empty until `setTrack` puts a track on it. Swapping or removing
 * the track later replaces it on the slot, so a camera can start, switch
 * lenses or stop without another offer.
 */

import { createChunker } from "./chunker.js";

/** @import { RtcPeer } from "../types.ts" */

export const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

const CHANNEL = "rpc";
const GATHER_TIMEOUT_MS = 3000;
const MAX_CHUNK = 65536;
const LOW_WATER = 65535;

/**
 * @param {{ iceServers?: RTCIceServer[], rtcConfig?: RTCConfiguration, video?: boolean, factory?: (config: RTCConfiguration) => RTCPeerConnection }} [options]
 * @returns {RtcPeer}
 */
export const createRtcPeer = ({ iceServers = DEFAULT_ICE_SERVERS, rtcConfig = {}, video = false, factory = (config) => new RTCPeerConnection(config) } = {}) => {
  const pc = factory({ iceServers, ...rtcConfig });
  /** @type {MediaStreamTrack | null} */
  let localTrack = null;
  /** @type {MediaStreamTrack | null} */
  let remoteTrack = null;
  /** @type {Set<(track: MediaStreamTrack) => void>} */
  const trackHandlers = new Set();
  /** @type {RTCDataChannel | null} */
  let channel = null;
  let chunker = createChunker({ maxSize: MAX_CHUNK });
  let opened = false;
  let closed = false;
  let remoteSet = false;
  /** @type {RTCIceCandidateInit[]} */
  const queuedCandidates = [];
  /** @type {Set<(text: string) => void>} */
  const messageHandlers = new Set();
  /** @type {Set<() => void>} */
  const openHandlers = new Set();
  /** @type {Set<(reason: string) => void>} */
  const closeHandlers = new Set();
  /** @type {Set<(candidate: RTCIceCandidateInit) => void>} */
  const candidateHandlers = new Set();
  /** @type {Promise<void>} */
  let drain = Promise.resolve();

  const finish = (/** @type {string} */ reason) => {
    if (closed) return;
    closed = true;
    try { channel?.close(); } catch {}
    try { pc.close(); } catch {}
    for (const handler of closeHandlers)
      try { handler(reason); } catch (e) { console.warn("[rtc] close handler threw:", e); }
  };

  const wireChannel = (/** @type {RTCDataChannel} */ next) => {
    channel = next;
    next.binaryType = "arraybuffer";
    next.bufferedAmountLowThreshold = LOW_WATER;
    next.onopen = () => {
      const negotiated = pc.sctp?.maxMessageSize;
      chunker = createChunker({ maxSize: Math.min(negotiated && negotiated > 0 ? negotiated : MAX_CHUNK, MAX_CHUNK) });
      opened = true;
      for (const handler of openHandlers)
        try { handler(); } catch (e) { console.warn("[rtc] open handler threw:", e); }
    };
    next.onmessage = (event) => {
      const whole = chunker.push(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      if (whole === null) return;
      for (const handler of messageHandlers)
        try { handler(whole); } catch (e) { console.warn("[rtc] message handler threw:", e); }
    };
    next.onclose = () => finish("channel closed");
    next.onerror = () => finish("channel error");
  };

  const videoSlot = () => pc.getTransceivers?.().find((t) => t.receiver.track?.kind === "video") ?? null;

  const applyTrack = async () => {
    const slot = videoSlot();
    if (slot && !closed) await slot.sender.replaceTrack(localTrack);
  };

  pc.ondatachannel = (event) => wireChannel(event.channel);
  pc.ontrack = (event) => {
    if (event.track.kind !== "video") return;
    remoteTrack = event.track;
    for (const handler of trackHandlers)
      try { handler(event.track); } catch (e) { console.warn("[rtc] track handler threw:", e); }
  };
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    for (const handler of candidateHandlers)
      try { handler(event.candidate.toJSON()); } catch (e) { console.warn("[rtc] candidate handler threw:", e); }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") finish(`connection ${pc.connectionState}`);
  };
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") finish("ice failed");
  };

  const gathered = () => new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve(undefined);
    const timer = setTimeout(done, GATHER_TIMEOUT_MS);
    function done() {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve(undefined);
    }
    function check() {
      if (pc.iceGatheringState === "complete") done();
    }
    pc.addEventListener("icegatheringstatechange", check);
  });

  const local = async (/** @type {boolean} */ trickle) => {
    if (!trickle) await gathered();
    return /** @type {string} */ (pc.localDescription?.sdp);
  };

  const flushCandidates = async () => {
    remoteSet = true;
    for (const candidate of queuedCandidates.splice(0))
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn("[rtc] candidate rejected:", e); }
  };

  const waitLow = () => new Promise((resolve) => {
    const current = /** @type {RTCDataChannel} */ (channel);
    const done = () => { current.removeEventListener("bufferedamountlow", done); resolve(undefined); };
    current.addEventListener("bufferedamountlow", done);
  });

  return {
    get state() {
      if (closed) return "closed";
      return opened ? "open" : "connecting";
    },
    get remoteTrack() {
      return remoteTrack;
    },
    async offer({ trickle = false } = {}) {
      wireChannel(pc.createDataChannel(CHANNEL, { ordered: true }));
      if (video) pc.addTransceiver("video", { direction: "sendrecv" });
      await applyTrack();
      await pc.setLocalDescription(await pc.createOffer());
      return local(trickle);
    },
    async answer(sdp, { trickle = false } = {}) {
      await pc.setRemoteDescription({ type: "offer", sdp });
      await flushCandidates();
      const slot = video ? videoSlot() : null;
      if (slot) slot.direction = "sendrecv";
      await applyTrack();
      await pc.setLocalDescription(await pc.createAnswer());
      return local(trickle);
    },
    async setTrack(track) {
      localTrack = track;
      await applyTrack();
    },
    onTrack: (handler) => { trackHandlers.add(handler); return () => trackHandlers.delete(handler); },
    async accept(sdp) {
      await pc.setRemoteDescription({ type: "answer", sdp });
      await flushCandidates();
    },
    async addCandidate(candidate) {
      if (!remoteSet) return void queuedCandidates.push(candidate);
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn("[rtc] candidate rejected:", e); }
    },
    send(text) {
      const current = channel;
      if (!current || !opened || closed) return Promise.reject(new Error("rtc: channel not open"));
      const frames = chunker.split(text);
      drain = drain.then(async () => {
        for (const frame of frames) {
          if (closed || current.readyState !== "open") throw new Error("rtc: channel closed mid-send");
          if (current.bufferedAmount > LOW_WATER) await waitLow();
          current.send(frame);
        }
      });
      return drain;
    },
    onMessage: (handler) => { messageHandlers.add(handler); return () => messageHandlers.delete(handler); },
    onOpen: (handler) => { openHandlers.add(handler); return () => openHandlers.delete(handler); },
    onClose: (handler) => { closeHandlers.add(handler); return () => closeHandlers.delete(handler); },
    onCandidate: (handler) => { candidateHandlers.add(handler); return () => candidateHandlers.delete(handler); },
    close: () => finish("closed"),
  };
};
