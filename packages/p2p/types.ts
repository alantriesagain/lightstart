/**
 * @file @lightstart/p2p: the public types of the room, its signalers, the
 * relay hub and the pairing payload. The controller's port and host types
 * arrive with the controller, which is not ported yet.
 */

/** Where a host looks for its signalers and relay. */
export interface P2PConfig {
  /** Ordered signalers the host announces on; the payload carries them to the guest. */
  signalers?: SignalerId[];
  /** A relay hub speaking the `/_relay` protocol; the dev server's own is found by probe. */
  relayUrl?: string | null;
  /** WebTorrent trackers used by the `torrent` signaler. */
  trackers?: string[];
  /** MQTT brokers used by the `mqtt` signaler. */
  brokers?: string[];
  /** ICE servers every `RTCPeerConnection` is made with. */
  iceServers?: RTCIceServer[];
}

export type SignalerId = "relay" | "torrent" | "mqtt";

export type PeerTransport = "direct" | "relayed";

export interface RelayInfo {
  relay: boolean;
  origins: { local: string; lan?: string; tunnel?: string };
}

export interface RoomConfig {
  roomId: string;
  password: string;
  appId: string;
  signalers: string[];
  relayUrl: string | null;
  pairUrl: string;
  expiresAt: number;
}

export interface PairPayload {
  a: string;
  r: string;
  p: string;
  s: string[];
  u?: string;
  v: number;
  exp: number;
}

/** A signal as a signaler delivers it: who, which offer, and the sealed or plain payload. */
export interface SignalPayload {
  peerId: string;
  offerId: string;
  payload: unknown;
}

/** What every signaler shares: identity, readiness, answers, and teardown. */
export interface Signaler {
  id: string;
  selfId: string;
  ready: Promise<unknown>;
  presence?: boolean;
  answer(peerId: string, offerId: string, payload: unknown): void;
  onOffer(handler: (signal: SignalPayload) => void): () => void;
  onAnswer(handler: (signal: SignalPayload) => void): () => void;
  onClose(handler: (reason: string) => void): () => void;
  close(): void;
}

/** Trackers and brokers: the room announces an offer pool and hears who answers. */
export interface BroadcastSignaler extends Signaler {
  presence?: false;
  announce(offers: Array<{ offerId: string; payload: unknown }>): void;
}

/** The relay hub: peers are known, offers target one peer, ICE trickles, and data can fall back to the hub. */
export interface PresenceSignaler extends Signaler {
  presence: true;
  peers(): string[];
  onPeer(handler: (peerId: string) => void): () => void;
  onPeerGone(handler: (peerId: string) => void): () => void;
  offer(peerId: string, offerId: string, payload: unknown): void;
  candidate(peerId: string, offerId: string, payload: unknown): void;
  onCandidate(handler: (signal: SignalPayload) => void): () => void;
  sendData(peerId: string | null, frame: unknown): void;
  onData(handler: (frame: unknown, from: string) => void): () => void;
}

/** One WebRTC connection with its data channel, as `rtc/peer.js` builds it. */
export interface RtcPeer {
  readonly state: "connecting" | "open" | "closed";
  /** The video the other side sends, once negotiated (a peer made with `video`). */
  readonly remoteTrack: MediaStreamTrack | null;
  /** Put a track on this side's video slot, or `null` to stop sending; no renegotiation. */
  setTrack(track: MediaStreamTrack | null): Promise<void>;
  onTrack(handler: (track: MediaStreamTrack) => void): () => void;
  offer(options?: { trickle?: boolean }): Promise<string>;
  answer(sdp: string, options?: { trickle?: boolean }): Promise<string>;
  accept(sdp: string): Promise<void>;
  addCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  send(text: string): Promise<void>;
  onMessage(handler: (text: string) => void): () => void;
  onOpen(handler: () => void): () => void;
  onClose(handler: (reason: string) => void): () => void;
  onCandidate(handler: (candidate: RTCIceCandidateInit) => void): () => void;
  close(): void;
}

/** A named message lane over the room: broadcast or unicast, handlers hear `(data, from)`. */
export interface RoomAction {
  send(data: unknown, to?: string | string[]): Promise<void>;
  on(handler: (data: unknown, from: string) => void): () => void;
}

/** The room every strategy answers with: peers come and go, actions carry data. */
export interface Room {
  selfId: string;
  ready: Promise<unknown>;
  peers(): string[];
  transportOf(peerId: string): PeerTransport | null;
  action(name: string): RoomAction;
  onPeerJoin(handler: (peerId: string) => void): () => void;
  onPeerLeave(handler: (peerId: string) => void): () => void;
  onTransportChange(handler: (peerId: string, transport: PeerTransport) => void): () => void;
  onClose(handler: (reason: string) => void): () => void;
  /** Send a video track to every peer, now and as they join (`null` stops it). Needs a room joined with `video`. */
  setTrack(track: MediaStreamTrack | null): Promise<void>;
  /** The video a peer sends over its direct link, or null. */
  trackOf(peerId: string): MediaStreamTrack | null;
  /** Hear a peer's video as its direct link opens or its track arrives. */
  onTrack(handler: (peerId: string, track: MediaStreamTrack) => void): () => void;
  leave(): void;
}
