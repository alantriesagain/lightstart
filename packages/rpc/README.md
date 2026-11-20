# `@lightstart/rpc`

A channel between two runtimes over anything with `postMessage` and a
message listener: a `MessagePort`, a `Worker`, a service worker, or a native
bridge through a small adapter. The package knows nothing about an app; the
model example below is only the shape light's own pieces fit into.

## Port

```ts
import { portOf, listen } from "@lightstart/rpc";

const port = portOf(worker); // a MessagePort, a Worker, or { postMessage, addEventListener }
```

`portOf` returns a `Port`: `postMessage(message, transfer?)`, a message
listener (`addEventListener` on an `EventTarget`, `on` on an
`EventEmitter`), and `start?`. `listen(port, name, fn)` subscribes and answers
the unsubscribe.

## Requests

```ts
import { serve, client } from "@lightstart/rpc";

// one side
const server = serve(port, {
  add: (payload, { progress }) => {
    progress({ at: 1 });
    return Number(payload) + 1;
  },
});

// the other side
const rpc = client(port, { timeoutMs: 5000 });
const value = await rpc.request("add", 2, {
  timeoutMs: 1000,
  transfer: [],
  onProgress: (value) => console.log(value),
});
rpc.post("log", { line: "one way" });
rpc.close();
```

- `request(name, payload, { timeoutMs, transfer, onProgress })` answers a
  promise. `timeoutMs: 0` disables the timeout; a request that runs out
  rejects.
- `post(name, payload, { transfer })` sends a request whose answer is ignored.
- A handler gets `(payload, { progress })`; every `progress(value)` becomes a
  progress frame before the answer.
- A throw becomes an error value `{ name, message, ...own enumerable fields }`
  and is rebuilt on the client as an `Error` with those fields, so a
  validation `errors` map or a `status` survives.
- A name with no handler answers an error whose message is `unknown request`.
- `close()` rejects what is still in flight, naming each request. A
  worker-backed client also closes itself on the worker's `error` or
  `messageerror`.
- `serve` answers `{ dispose }`.

## Relayed events

```ts
import { relay } from "@lightstart/rpc";
import { event } from "@lightstart/light/signals";

const localChanged = event<{ id: string }>();
const relayed = relay(port, { changed: localChanged });
localChanged.emit({ id: "a" }); // arrives as "changed" on the other side
relayed.dispose();
```

Both sides declare the same names. A relayed value is not posted back, and a
name that is not declared is ignored (and counted by `relayed.ignored()`).
Every emitter must be an `Emitter` from `@lightstart/light/signals`.

## Mirrored signals

```ts
import { mirror } from "@lightstart/rpc";

// the owner
mirror(port, "online", signal, { owner: true });
// the follower, in another runtime
mirror(port, "online", signal, { owner: false });
```

The owner posts its value on every change and once when the follower sends
`{ kind: "hello", signal }`; the follower sets its signal from the owner's
frames and never posts a write back. It is one way by design: only the owner
writes.

## Frames

| Frame | Fields |
|---|---|
| request | `{ kind: "request", id, name, payload }` |
| response | `{ kind: "response", id, ok, value \| error }` |
| progress | `{ kind: "progress", id, value }` |
| event | `{ kind: "event", event, value }` |
| mirror | `{ kind: "mirror", signal, value }` |
| hello | `{ kind: "hello", signal }` |

## The model, end to end

The worker holds the store and serves the model handlers:

```ts
import { serve, relay } from "@lightstart/rpc";
import { createModelHandlers } from "@lightstart/light/model/store";
import { modelChanged, modelError } from "@lightstart/light/model/events";

const handlers = createModelHandlers(() => store);
serve(self, {
  model: ({ action, model, payload }) => handlers[action]({ model, ...payload }),
});
relay(self, { modelChanged, modelError });
```

The page sends every model call through the channel and hears changes through
the relayed event:

```ts
import { client, relay } from "@lightstart/rpc";
import { configureModel, defineModel, onChange } from "@lightstart/light/model";
import { modelChanged, modelError } from "@lightstart/light/model/events";
import T from "@lightstart/light/types/index.js";

const rpc = client(worker);
configureModel({
  request: (action, model, payload) => rpc.request("model", { action, model, payload }),
});
relay(worker, { modelChanged, modelError });

const todos = defineModel("todos", { title: T.string({ required: true }) });
onChange("todos", undefined, (event) => console.log(event.action));
await todos.add({ title: "one" });
```

`onChange`, live queries and every model api now work on the page while the
store sits in the worker.
