// node-only
/**
 * @file The page side: outside the shell it is absent and shares through
 * `navigator.share`; inside a fake shell it follows the request protocol,
 * capabilities, requests and events.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";

interface ShellEvent {
  data: unknown;
}

type Listener = (event: ShellEvent) => void;

const pageUrl = new URL("../page.ts", import.meta.url).href;
const asGlobals = globalThis as unknown as { __lightMobile?: unknown; lightMobile?: unknown; navigator?: unknown };

const main = async (): Promise<void> => {
  Reflect.deleteProperty(globalThis, "__lightMobile");
  Reflect.deleteProperty(globalThis, "lightMobile");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let shared: unknown = null;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      share: async (data: unknown): Promise<void> => {
        shared = data;
      },
    },
  });

  try {
    const outside = (await import(`${pageUrl}?outside`)) as typeof import("../page.ts");
    ok("outside the shell present is false", !outside.mobile.present);
    ok("outside the shell ready is null", outside.mobile.ready === null);
    ok("outside the shell can is false", !outside.mobile.can("share"));
    const rejected = await outside.mobile.request("share").then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("a request outside the shell rejects", rejected.includes("not running inside a mobile shell"));
    const result = await outside.mobile.share({ title: "Hello", text: "hi" });
    ok("share falls back to navigator.share", result.shared);
    const data = shared as { title?: string; text?: string } | null;
    eq("the fallback keeps the title", data?.title ?? "", "Hello");
    eq("the fallback keeps the text", data?.text ?? "", "hi");
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "navigator");
    else Object.defineProperty(globalThis, "navigator", previous);
  }

  let listener: Listener | null = null;
  const push = (data: unknown): void => {
    if (listener !== null) listener({ data });
  };
  const channel = {
    postMessage(text: string): void {
      const request = JSON.parse(text) as [number, string, unknown[]];
      const [id, method] = request;
      let reply: Record<string, unknown>;
      if (method === "$ready") reply = { id, ok: true, value: { platform: "android", capabilities: ["share"] } };
      else if (method === "share") reply = { id, ok: true, value: { shared: true } };
      else reply = { id, ok: false, error: `no method ${method}` };
      queueMicrotask(() => listener?.({ data: JSON.stringify(reply) }));
    },
    addEventListener(_type: "message", fn: Listener): void {
      listener = fn;
    },
    removeEventListener(): void {
      listener = null;
    },
  };
  asGlobals.__lightMobile = { present: true };
  asGlobals.lightMobile = channel;

  try {
    const inside = (await import(`${pageUrl}?inside`)) as typeof import("../page.ts");
    ok("inside the shell present is true", inside.mobile.present);
    ok("inside the shell ready is a promise", inside.mobile.ready !== null);
    const ready = await inside.mobile.ready;
    eq("ready names the platform", ready?.platform ?? "", "android");
    eq("ready lists share", (ready?.capabilities ?? []).join(","), "share");
    ok("can follows the capabilities", inside.mobile.can("share"));
    ok("can is false for a capability the shell does not have", !inside.mobile.can("camera"));

    const sharedResult = await inside.mobile.request<{ shared: boolean }>("share", [{ text: "hi" }]);
    ok("a request answers its value", sharedResult.shared);

    const failure = await inside.mobile.request("camera").then(
      () => "",
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
    ok("an error reply rejects with its message", failure.includes("no method camera"));

    let received: unknown = null;
    const off = inside.mobile.on("ping", (payload) => {
      received = payload;
    });
    push(JSON.stringify({ event: "ping", payload: 42 }));
    eq("an event reaches its listener", String(received), "42");
    off();
    push(JSON.stringify({ event: "ping", payload: 43 }));
    eq("unsubscribing stops the event", String(received), "42");
  } finally {
    Reflect.deleteProperty(globalThis, "__lightMobile");
    Reflect.deleteProperty(globalThis, "lightMobile");
  }
  done();
};

await main();
