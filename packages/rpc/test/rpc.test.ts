// node-only
import { MessageChannel } from "node:worker_threads";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { client, mirror, portOf, relay, serve } from "../index.ts";
import type { Port } from "../index.ts";
import { event, signal } from "@lightstart/light/signals";
import type { Emitter } from "@lightstart/light/signals";
import { configureModel, defineModel, onChange } from "@lightstart/light/model";
import { modelChanged, modelError } from "@lightstart/light/model/events";
import { createModelHandlers, createStore } from "@lightstart/light/model/store";
import type { QueryOptions, Row, StorageAdapter } from "@lightstart/light/model";
import T from "@lightstart/light/types/index.js";

interface Pair {
  a: Port;
  b: Port;
  stop(): void;
}

const pair = (): Pair => {
  const channel = new MessageChannel();
  return {
    a: portOf(channel.port1),
    b: portOf(channel.port2),
    stop: () => {
      channel.port1.close();
      channel.port2.close();
    },
  };
};

const tick = (ms = 10): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const failure = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (caught) {
    return caught instanceof Error ? caught : new Error(String(caught));
  }
  return new Error("did not reject");
};

const fields = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

const memoryAdapter = (): StorageAdapter => {
  const tables = new Map<string, Map<string, Row>>();
  const table = (model: string): Map<string, Row> => {
    let found = tables.get(model);
    if (!found) {
      found = new Map();
      tables.set(model, found);
    }
    return found;
  };
  const adapter = {
    async init() {},
    async get(model: string, id: string | number): Promise<Row | null> {
      return table(model).get(String(id)) ?? null;
    },
    async query(model: string, _opts?: QueryOptions): Promise<{ rows: Row[], total: number }> {
      const rows = [...table(model).values()];
      return { rows, total: rows.length };
    },
    async insert(model: string, row: Row): Promise<Row> {
      table(model).set(String(row["id"]), row);
      return row;
    },
    async update(model: string, row: Row): Promise<Row> {
      table(model).set(String(row["id"]), row);
      return row;
    },
    async delete(model: string, id: string | number): Promise<void> {
      table(model).delete(String(id));
    },
    async count(model: string): Promise<number> {
      return table(model).size;
    },
    async close() {},
  };
  return adapter as unknown as StorageAdapter;
};

const main = async (): Promise<void> => {
  {
    const { a, b, stop } = pair();
    const server = serve(b, { add: (payload) => Number(payload) + 1 });
    const rpc = client(a);
    eq("a request answers", String(await rpc.request("add", 2)), "3");
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, { never: () => new Promise(() => undefined) });
    const rpc = client(a);
    const error = await failure(rpc.request("never", undefined, { timeoutMs: 20 }));
    ok("a timeout rejects", error.message.includes("timed out"));
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, {
      validate: () => {
        const error = Object.assign(new Error("bad input"), { status: 422 });
        Reflect.set(error, "errors", { title: "required" });
        throw error;
      },
    });
    const rpc = client(a);
    const error = await failure(rpc.request("validate"));
    eq("an error keeps its message", error.message, "bad input");
    eqn("an error keeps a field", Number(fields(error)["status"]), 422);
    eq("an error keeps an object field", JSON.stringify(fields(error)["errors"]), '{"title":"required"}');
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, { echo: (payload) => payload });
    const rpc = client(a);
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const answer = fields(await rpc.request("echo", { buffer }, { transfer: [buffer] }));
    eqn("a transfer list moves the buffer", (answer["buffer"] as ArrayBuffer).byteLength, 4);
    eqn("the sent buffer is detached", buffer.byteLength, 0);
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, {
      work: async (_payload, { progress }) => {
        progress(1);
        progress(2);
        return "done";
      },
    });
    const rpc = client(a);
    const seen: unknown[] = [];
    const value = await rpc.request("work", undefined, { onProgress: (each) => seen.push(each) });
    eq("progress frames arrive", seen.join(","), "1,2");
    eq("the answer follows progress", String(value), "done");
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, {});
    const rpc = client(a);
    const error = await failure(rpc.request("missing"));
    ok("an unknown name is an error naming the request", error.message.includes("unknown request"));
    rpc.close();
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const server = serve(b, { never: () => new Promise(() => undefined) });
    const rpc = client(a);
    const flight = rpc.request("never");
    rpc.close();
    const error = await failure(flight);
    ok("close rejects what is in flight and names it", error.message.includes("never"));
    server.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const left = event<string>();
    const right = event<string>();
    const seenLeft: string[] = [];
    const seenRight: string[] = [];
    left.on((value) => seenLeft.push(value));
    right.on((value) => seenRight.push(value));
    const sentLeft = relay(a, { ping: left as unknown as Emitter<unknown> });
    relay(b, { ping: right as unknown as Emitter<unknown> });

    left.emit("x");
    await tick();
    eq("an event crosses to the other side", seenRight.join(","), "x");
    eq("an event is not echoed back", seenLeft.join(","), "x");

    right.emit("y");
    await tick();
    eq("an event crosses both ways", seenLeft.join(","), "x,y");

    b.postMessage({ kind: "event", event: "nope", value: 1 });
    await tick();
    eqn("an undeclared event is counted and ignored", sentLeft.ignored(), 1);
    eq("an undeclared event does not reach a local emitter", seenLeft.join(","), "x,y");

    sentLeft.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const owner = signal(1);
    const follower = signal(0);
    const onOwner = mirror(a, "count", owner, { owner: true });
    await tick();
    eqn("the follower starts at its own value", follower.peek(), 0);
    const onFollower = mirror(b, "count", follower, { owner: false });
    await tick();
    eqn("a late follower converges", follower.peek(), 1);

    owner.value = 5;
    await tick();
    eqn("a change reaches the follower", follower.peek(), 5);

    follower.value = 9;
    await tick();
    eqn("the follower does not write back", owner.peek(), 5);

    onOwner.dispose();
    onFollower.dispose();
    stop();
  }

  {
    const { a, b, stop } = pair();
    const store = createStore({
      models: { note: { $adapter: "memory", title: T.string({ required: true }) } },
      databases: { memory: memoryAdapter() },
      defaultAdapter: "memory",
    });
    const handlers = createModelHandlers(() => store);
    const server = serve(b, {
      model: (payload) => {
        const call = payload as { action: string, model: string, payload?: Record<string, unknown> };
        const handler = handlers[call.action];
        if (typeof handler !== "function") throw new Error(`unknown model action: ${call.action}`);
        return handler({ model: call.model, ...(call.payload ?? {}) });
      },
    });
    relay(b, {
      modelChanged: modelChanged as unknown as Emitter<unknown>,
      modelError: modelError as unknown as Emitter<unknown>,
    });

    const rpc = client(a);
    relay(a, {
      modelChanged: modelChanged as unknown as Emitter<unknown>,
      modelError: modelError as unknown as Emitter<unknown>,
    });
    configureModel({
      request: (action, model, payload) => rpc.request("model", { action, model, payload }),
    });

    const note = defineModel("note", { title: T.string({ required: true }) });
    const heard = new Promise<string>((resolve) => {
      onChange("note", undefined, (change) => resolve(change.action));
    });
    const row = await note.add({ title: "hello" });
    eq("the model add answers the row", String(fields(row)["title"]), "hello");
    eq("the change crossed the channel", await heard, "add");
    const all = await note.getAll();
    eqn("the store in the worker holds the row", all.length, 1);

    rpc.close();
    server.dispose();
    stop();
  }
};

await main();
done();
