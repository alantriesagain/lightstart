# Working on @lightstart/p2p

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public entry: the room, the crypto, the pairing payload, the signalers, `configureP2P` and the strategy |
| `types.ts` | The public types: config, payload, signalers, peers, rooms, rooms' actions and the relay info |
| `room.js` | `joinRoom` and `createRoom`: the mesh, the offer pool, presence fallback, retries, probes and video |
| `rtc/peer.js` | `createRtcPeer`: one `RTCPeerConnection`, its data channel, trickle or gathered offers, backpressure |
| `rtc/chunker.js` | `createChunker`: `id:index:total\n` frames and their reassembly |
| `crypto.js` | `deriveRoomKey`, `seal`, `open`, `roomDigest`, the base64 and hex helpers, `hasSubtle` |
| `pair-payload.js` | `encodePairPayload`, `decodePairPayload`, `isCurrent`, `isExpired`, `PAIR_VERSION` |
| `signal/relay.js` | `createRelaySignaler`: the presence signaler for `/_relay` |
| `signal/torrent.js` | `createTorrentSignaler`: the WebTorrent tracker broadcast signaler |
| `signal/mqtt.js` | `createMqttSignaler`: the MQTT broker broadcast signaler |
| `signal/mqtt-packet.js` | The MQTT 3.1.1 packet codec |
| `signal/reconnect.js` | `createReconnectingSocket`: doubling backoff, an attempt cap, give-up once |
| `strategy.js` | `configureP2P`, `p2pConfig`, `getRelayInfo`, `resolveSignalers`, `isLoopback`, `pairParam` |
| `cli/relay-hub.ts` | `createRelayHub`, `relayHub`: rooms, auth, targeted and broadcast frames, origins, pair payload |
| `cli/routes/relay.ts` | `relayApp` (the `/_relay` socket), `relayHttp` (info and pair), `relayApplication`, and the gated route file |
| `cli/extend/serve.ts` | `light serve`'s `/_relay/info` and `/_relay/pair`, for a project declaring the package |
| `cli/project.ts` | `projectHasP2P`: whether the served project names `@lightstart/p2p` |
| `cli/hooks/serve.after.ts` | `serve:after`: the reachable origins into the hub, close it at shutdown |
| `lib/dom.d.ts` | The DOM lib reference the tsconfig's `lib` omits, as `@lightstart/maps` does |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts`, all `// node-only`, and one Chromium test |

## The language choice

The framework-free modules stay JavaScript with JSDoc types, as light's components are. `index.ts`, `types.ts` and the CLI files are TypeScript. Node tests are `.ts` plain scripts so `light test` finds them; the browser test is `.js` on `node:test`, as light's component browser tests are.

## Rules the sources keep

- No `any`, in TypeScript or JSDoc. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Comments are a module header and doc comments on exported symbols, nothing else.
- The room and its peers stay page-safe: no DOM beyond WebRTC, no app global, no `node:` import. The node-only pieces live under `cli/`.
- `configureP2P` is the app's settings; there is no manifest block and no global. `resolveSignalers` reads it, then a live `/_relay/info` through `appUrl("/_relay/info")`, so an app under a base probes the same base.
- Public signalers need `hasSubtle()`; the relay does not. Only a project that calls `configureP2P({ signalers })` reaches for third-party trackers or brokers.
- The relay socket is a route file (`cli/routes/relay.ts`), because `light serve` offers websocket upgrades to route apps (`pipeline.apps`) and not to apps added with `api.handle`. The HTTP routes are the serve extension's handled app.
- Everything the relay contributes is gated by `projectHasP2P`: a project that does not name the package gets no socket, no info and no pair routes.
- There is no terminal QR: light has no QR package. The serve hook prints the reachable origins.
- Tests are plain scripts on `@lightstart/test/assert.ts`, not a test framework. Every node test starts with `// node-only` (it opens sockets, browses or waits on real timers). The browser test runs one file per run.
- TypeScript with erasable syntax only; the package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `joinRoom({ appId, password, signalers, relayUrl, trackers, brokers, iceServers, rtcConfig, video, selfId, fallbackMs }, roomId)` and the `Room` methods | an app pairing a device, and the room tests |
| `createRoom({ selfId, signalers, createPeer, seal, open, ... })` and the same `Room` shape | a test scripting signalers and peers, and `joinRoom` |
| `randomId(length?)` | room ids, offer ids and peer ids |
| `deriveRoomKey`, `seal`, `open`, `roomDigest`, `bytesToHex`, `hasSubtle` | the room's crypto and the public signalers |
| `encodePairPayload`, `decodePairPayload`, `isCurrent`, `isExpired`, `PAIR_VERSION` | the pair link and the guest's first read |
| `configureP2P(config)`, `p2pConfig()`, `getRelayInfo()`, `resolveSignalers()`, `isLoopback(host?)`, `pairParam()` | the host's strategy, the controller later, and the strategy test |
| `createRelaySignaler`, `createTorrentSignaler`, `createMqttSignaler` and their configs | `joinRoom`, and the signaler tests against fake and real servers |
| `createReconnectingSocket` | the torrent and MQTT signalers |
| `createRelayHub()`, `relayHub(log?)`, `createRelayHub().channel()` | the `/_relay` route, the serve hook and the hub tests |
| `relayApp`, `relayHttp`, `relayApplication` | the dev server's route and extension, and a project serving the hub itself |
| `projectHasP2P(projectDir)` | the serve extension, the route file and the serve hook |
| `/_relay` frames: `join`/`joined`/`error`, `peer-joined`/`peer-left`, `data`, `leave` | the relay signaler, the hub and a browser on the dev server |
| `/_relay/info` as `{ relay: true, origins: { local, lan?, tunnel? } }` | `getRelayInfo` and the host's pairing origin |
| `/_relay/pair` as `POST { payload, roomId, path }` and `GET { payload, path }`, gated on a live room | the zero-QR pairing path |
| `<project>/package.json` naming `@lightstart/p2p` | whether `light serve` hosts the relay |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/p2p
light test @lightstart/p2p
npx eslint packages/p2p
# from packages/p2p, one browser file per run:
light test test/room.browser.test.js
```
