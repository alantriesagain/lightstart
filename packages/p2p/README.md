# @lightstart/p2p: pair a phone (or any second device) into a running app

A room is a WebRTC mesh whose peers find each other through any number of
signalers. A guest is a thin client of the host: it loads the same app and
drives the host's data over one peer channel. This package holds the core:
the mesh, the encrypted signaling, the signalers, the pairing payload codec
and the `/_relay` hub the dev server hosts. The controller and the views that
sit on top of it are the next stage (see [Later](#later)).

## Architecture

| Layer | File | Role |
|---|---|---|
| Room | `room.js` | `joinRoom(config, roomId)`: a WebRTC mesh over any number of signalers; `createRoom` is the pure mesh manager |
| Peer | `rtc/peer.js` | one `RTCPeerConnection` and its ordered data channel, chunked sends (`rtc/chunker.js`) with backpressure |
| Signalers | `signal/relay.js`, `signal/torrent.js`, `signal/mqtt.js` | where peers find each other (below) |
| Crypto | `crypto.js` | the room key (PBKDF2 to AES-GCM) that seals every signal on a public signaler |
| Pairing codec | `pair-payload.js` | the `#peer=` fragment: base64(JSON) of `{ v: 3, a: appId, r: roomId, p: password, s: signalers, u?: relayUrl, exp }` |
| Strategy | `strategy.js` | `configureP2P` names the signalers, trackers, brokers, ICE servers and relay; `resolveSignalers` reads them and probes `/_relay/info` |
| Relay hub | `cli/relay-hub.ts` | room-scoped WebSocket forwarding on `/_relay`, its info and pair routes, and the serve hook that advertises reachable origins |

`pair-payload.js` keeps its original name: the pairing payload is a public
shape other pieces (and the payload's own `#peer=` fragment) read by that
name, and there is nothing in it that a shorter name would make clearer.

## Signalers

A room announces on every signaler it was given and the first path that
completes a connection wins. Peer ids are the same across signalers, so a
peer seen twice is one peer.

| | `relay` | `torrent` | `mqtt` |
|---|---|---|---|
| Rendezvous | this package's `/_relay` WebSocket hub on the dev server (`cli/relay-hub.ts`), or `configureP2P({ relayUrl })` | public WebTorrent trackers | public MQTT brokers |
| Kind | presence: the hub knows who is in the room, offers target one peer, ICE trickles | broadcast: a pool of gathered offers, the tracker forwards them | broadcast: offers on the room topic, answers on the offerer's topic |
| Signal payload | plain (the room secret gates every join) | sealed with the room key | sealed with the room key |
| Secure context | not needed | needed (`crypto.subtle`) | needed |
| Data path | direct WebRTC, or the hub's `data` frames when no channel opens | direct WebRTC | direct WebRTC |
| Third-party infrastructure | none | four public trackers | three public brokers |

The host resolves the list (`strategy.js`): `configureP2P({ signalers })`
wins; else a live `/_relay/info` gives `["relay"]` with the relay first so a
LAN pair completes before a tracker answers; else nothing. Announcing a room
to third-party trackers and brokers is a decision a project makes through
`configureP2P`, never a default. The pairing payload carries the list, so
the guest never guesses.

```js
import { configureP2P } from "@lightstart/p2p";

configureP2P({
  signalers: ["relay", "torrent", "mqtt"],
  trackers: ["wss://tracker.webtorrent.dev"],
  brokers: ["wss://broker.emqx.io:8084/mqtt"],
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  relayUrl: "http://localhost:3000",
});
```

`getRelayInfo` fetches `appUrl("/_relay/info")` from `@lightstart/app`, so an
app deployed under a base (`/budget`) probes its relay under the same base
and the dev server answers both.

### The mesh (`room.js`)

One link per peer. Two links to the same peer (both sides answered each
other's offers at once) resolve to the one the lower id offered. A peer
joins when its channel opens; with the relay present, a peer whose channel
has not opened after 8 s joins as `relayed` and its actions ride the hub's
data frames until a channel opens (then it is promoted to `direct`). A
dropped link while the hub still sees the peer is retried with backoff; a
hub leave while a channel is open is probed with a ping; a pending link
times out after 15 s. Chunks are sized to the negotiated
`sctp.maxMessageSize` (at most 64 KB) and sends wait on `bufferedamountlow`.

### Video

A room joined with `video: true` negotiates one video slot on every direct
link, sending and receiving, empty until a track is put on it. That makes a
second phone usable as a camera: `room.setTrack(track)` sends a track to
every peer (pooled offers and links still to come included), a later call
swaps it in place (front to back camera) and `null` stops it, all without
another offer. `room.onTrack((peerId, track) => ...)` hears a peer's video
once its link is the one the mesh kept, and `room.trackOf(peerId)` reads it.
Video needs a direct link: a peer that joined `relayed` has data only.

```js
import { joinRoom } from "@lightstart/p2p";

const room = await joinRoom({ appId, password, signalers, relayUrl, video: true }, roomId);
room.action("rpc").on((data, from) => console.log(from, data));
await room.action("rpc").send({ hello: "from the phone" });
```

## The relay on light serve

A project that declares `@lightstart/p2p` gets the relay on `light serve`:

- `cli/routes/relay.ts` answers the `/_relay` WebSocket. Route apps are what
  the dev server offers an upgrade to first, so the hub takes the socket there.
- `cli/extend/serve.ts` adds `GET /_relay/info`, `POST /_relay/pair` and
  `GET /_relay/pair`.
- `cli/hooks/serve.after.ts` feeds `--host 0.0.0.0` and `--tunnel` origins
  into the hub and closes it at shutdown. It prints the reachable origins;
  there is no terminal QR, since light has no QR package yet.

The extension api's `api.handle(app)` does not receive websocket upgrades
(the dev server's `attachSockets` takes `pipeline.apps`, the route files).
That is why the socket is a route file and the HTTP routes are a handled app;
both exist only when the project's `package.json` names the package.

A project can also host the hub on a server of its own:

```ts
import { serve } from "@lightstart/server/node";
import { createRelayHub } from "@lightstart/p2p/cli/relay-hub.ts";
import { relayApplication } from "@lightstart/p2p/cli/routes/relay.ts";

const hub = createRelayHub();
const server = await serve(relayApplication(hub), { port: 3000 });
// feed the reachable origins in: hub.setOrigins({ lan, tunnel })
// and close the hub with the server: hub.close()
```

## Room crypto

The room password derives an AES-GCM key (PBKDF2, 100000 iterations,
SHA-256) salted with the app id. Every signal sent through a public signaler
is sealed with it, so a tracker or broker relays opaque blobs. The relay
signaler never needs the key: its join is gated by the room secret and the
dev server is the user's own machine. `hasSubtle()` says whether the runtime
can run the public signalers; without it only the relay is offered.

## The pairing payload

```js
import { decodePairPayload, encodePairPayload, isCurrent, isExpired } from "@lightstart/p2p";

const encoded = encodePairPayload({ a: appId, r: roomId, p: password, s: ["relay", "torrent"], v: 3, exp: Date.now() + 300000 });
// put it in a link: `${origin}/#peer=${encoded}`
const payload = decodePairPayload(location.hash);
if (payload && isCurrent(payload) && !isExpired(payload)) {
  // ask the host to join
}
```

The payload is a bearer capability: whoever holds it can request to join
until `exp`. On the relay the room secret still gates every join, and on a
public signaler the key seals every signal.

## Threat model

- Public signalers (trackers, brokers) see the room's SHA-1 digest and
  sealed offers; they cannot read an SDP or join.
- The relay sees plaintext SDP, and the room secret gates every join.
- Data is DTLS end to end when the transport is `direct`. When it is
  `relayed`, frames cross the relay in the clear: plain LAN ws is plaintext
  regardless, and the relay is the user's own dev server; off-LAN use rides
  the tunnel's TLS.
- `GET /_relay/pair` hands the pair payload to anyone who can reach the dev
  server, the same exposure as a QR visible on the desk. Holding it only
  lets a device ask to join; approval (or prior trust) remains the gate.
- The pair URL is a full credential while valid.

## Later

These pieces of the original package are the next stage and are not in this
one: the controller (`controllers/peers.js`), `ports.js`, `relay.js` (the
wire relay), `events.js`, `commands.js`, `wire-codec.js`, `frontend.js`,
`backend.js`, `ide-extension.js`, and the views (`<p2p-pair>`,
`<p2p-lounge>`, `<p2p-status>`). The types they need arrive with them.

## Testing

```bash
light test @lightstart/p2p                 # node tests, plain scripts
light test test/room.browser.test.js       # from packages/p2p, one browser file per run
```

The node tests run under `node` and are marked `// node-only`; they cover the
chunker, packet codec, crypto, the pairing payload, every signaler against a
fake tracker and broker and the real hub, the strategy, the hub and its
routes, and the mesh against scripted peers. The browser test opens two real
`RTCPeerConnection`s, round-trips a megabyte, falls back to relayed data under
blocked ICE, carries and swaps a camera track, and reports a peer that left.
light's browser runner serves static files only, so that test signals through
an in-page presence bus; the real `/_relay` client and hub are covered by the
node tests.
