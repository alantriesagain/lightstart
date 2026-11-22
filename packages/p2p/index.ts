/**
 * @file @lightstart/p2p: pair a phone or any second device into a running
 * app over a WebRTC mesh. The room joins through any number of signalers;
 * the public ones seal their signals with the room key. `configureP2P`
 * names where a host looks, and the relay hub is served by `light serve`.
 */

export { base64ToBytes, bytesToBase64, bytesToHex, deriveRoomKey, hasSubtle, open, roomDigest, seal } from "./crypto.js";
export { PAIR_VERSION, decodePairPayload, encodePairPayload, isCurrent, isExpired } from "./pair-payload.js";
export { createRoom, joinRoom, randomId } from "./room.js";
export { configureP2P, getRelayInfo, isLoopback, p2pConfig, pairParam, resolveSignalers } from "./strategy.js";
export { DEFAULT_ICE_SERVERS, createRtcPeer } from "./rtc/peer.js";
export { createChunker } from "./rtc/chunker.js";
export { createRelaySignaler } from "./signal/relay.js";
export { DEFAULT_BROKERS, createMqttSignaler } from "./signal/mqtt.js";
export { DEFAULT_TRACKERS, createTorrentSignaler } from "./signal/torrent.js";
export { createReconnectingSocket } from "./signal/reconnect.js";
export type { BroadcastSignaler, PairPayload, P2PConfig, PeerTransport, PresenceSignaler, RelayInfo, Room, RoomAction, RoomConfig, RtcPeer, Signaler, SignalerId, SignalPayload } from "./types.ts";
