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

    const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
    const locate = (search: string): void => {
      Object.defineProperty(globalThis, "location", { configurable: true, value: { search } });
    };
    try {
      locate("?text=Shared%20text&title=Shared%20title");
      const textShare = outside.mobile.shared();
      eq("shared reads the text", textShare?.text ?? "", "Shared text");
      eq("shared reads the title", textShare?.title ?? "", "Shared title");
      locate("?text=&title=&file=%2F__mobile%2Fshared%2Fa.jpg&type=image%2Fjpeg&name=a.jpg");
      const fileShare = outside.mobile.shared();
      eq("shared reads a file url", fileShare?.files?.[0]?.url ?? "", "/__mobile/shared/a.jpg");
      eq("shared reads a file type", fileShare?.files?.[0]?.type ?? "", "image/jpeg");
      eq("shared reads a file name", fileShare?.files?.[0]?.name ?? "", "a.jpg");
      ok("shared does not invent text", fileShare?.text === undefined);
      locate("");
      ok("shared is null with no share query", outside.mobile.shared() === null);
      const unsupported = await outside.mobile.reminders.set([{ id: "r", hour: 7, minute: 0, title: "Go", body: "" }]);
      ok("reminders outside the shell are unsupported", !unsupported.supported);
      const unsupportedList = await outside.mobile.reminders.get();
      ok("reminders.get outside the shell is unsupported and empty", !unsupportedList.supported && unsupportedList.reminders.length === 0);
    } finally {
      if (previousLocation === undefined) Reflect.deleteProperty(globalThis, "location");
      else Object.defineProperty(globalThis, "location", previousLocation);
    }

    interface FakeInput {
      type: string;
      accept: string;
      files: { name: string; type: string }[];
      setAttribute(name: string, value: string): void;
      click(): void;
      addEventListener(type: string, fn: () => void, options?: { once: boolean }): void;
    }
    let change: (() => void) | null = null;
    const input: FakeInput = {
      type: "",
      accept: "",
      files: [],
      setAttribute(): void {},
      addEventListener(_type: string, fn: () => void): void {
        change = fn;
      },
      click(): void {
        input.files = [{ name: "shot.jpg", type: "image/jpeg" }];
        queueMicrotask(() => change?.());
      },
    };
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const urlType = URL as unknown as { createObjectURL: (blob: Blob) => string };
    const previousCreate = urlType.createObjectURL;
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: (): FakeInput => input } });
    urlType.createObjectURL = (): string => "blob:shot";
    try {
      const shot = await outside.mobile.capture({ kind: "image" });
      eq("capture on the web uses a file input", input.type, "file");
      eq("capture on the web accepts an image", input.accept, "image/*");
      eq("capture on the web answers a blob url", shot?.url ?? "", "blob:shot");
      eq("capture on the web answers the file's type", shot?.type ?? "", "image/jpeg");
      eq("capture on the web answers the file's name", shot?.name ?? "", "shot.jpg");
    } finally {
      urlType.createObjectURL = previousCreate;
      if (previousDocument === undefined) Reflect.deleteProperty(globalThis, "document");
      else Object.defineProperty(globalThis, "document", previousDocument);
    }
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
      if (method === "$ready") reply = { id, ok: true, value: { platform: "android", capabilities: ["share", "shareTarget", "capture", "reminders"] } };
      else if (method === "share") reply = { id, ok: true, value: { shared: true } };
      else if (method === "capture") reply = { id, ok: true, value: { url: "/__mobile/capture/1.jpg", type: "image/jpeg", name: "1.jpg" } };
      else if (method === "reminders.set") reply = { id, ok: true, value: { supported: true } };
      else if (method === "reminders.get") reply = { id, ok: true, value: { supported: true, reminders: [] } };
      else if (method === "reminders.clear") reply = { id, ok: true, value: { supported: true } };
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
    eq("ready lists the shell's capabilities", (ready?.capabilities ?? []).join(","), "share,shareTarget,capture,reminders");
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

    const captured = await inside.mobile.capture({ kind: "image" });
    eq("capture inside the shell answers the shell's file", captured?.url ?? "", "/__mobile/capture/1.jpg");
    const remindersSet = await inside.mobile.reminders.set([{ id: "r", hour: 7, minute: 30, title: "Go", body: "Now" }]);
    ok("reminders inside the shell are supported", remindersSet.supported);
    const remindersList = await inside.mobile.reminders.get();
    ok("reminders.get answers the shell's list", remindersList.supported && remindersList.reminders.length === 0);
  } finally {
    Reflect.deleteProperty(globalThis, "__lightMobile");
    Reflect.deleteProperty(globalThis, "lightMobile");
  }
  done();
};

await main();
