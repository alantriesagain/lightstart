// node-only
/**
 * @file The data-channel chunker: framing, in-order and out-of-order
 * reassembly, interleaved messages, malformed and duplicate frames, the
 * pending cap and a max size that cannot carry a payload.
 */

import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import { createChunker } from "../rtc/chunker.js";

{
  const { split, push } = createChunker({ maxSize: 64 });
  const frames = split("hello");
  eq("a short message is one frame", String(frames.length), "1");
  ok("the frame carries its header", /^1:0:1\nhello$/.test(frames[0]));
  eq("the frame reassembles", String(push(frames[0])), "hello");
}

{
  const { split, push } = createChunker({ maxSize: 32 });
  const text = "x".repeat(500);
  const frames = split(text);
  ok("a long message is several frames", frames.length > 1);
  ok("every frame stays within maxSize", frames.every((frame) => frame.length <= 32));
  let result = null;
  for (const frame of frames) result = push(frame) ?? result;
  eq("the frames reassemble in order", String(result), text);
}

{
  const sender = createChunker({ maxSize: 40 });
  const receiver = createChunker();
  const text = Array.from({ length: 300 }, (_, i) => String(i % 10)).join("");
  const frames = sender.split(text).reverse();
  const results = frames.map((frame) => receiver.push(frame)).filter(Boolean);
  eq("frames reassemble out of order", JSON.stringify(results), JSON.stringify([text]));
  eq("no partial message is left", String(receiver.pendingCount()), "0");
}

{
  const sender = createChunker({ maxSize: 40 });
  const receiver = createChunker();
  const a = sender.split("a".repeat(100));
  const b = sender.split("b".repeat(100));
  const results: Array<string | null> = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) results.push(receiver.push(a[i]));
    if (b[i]) results.push(receiver.push(b[i]));
  }
  eq("interleaved messages reassemble", JSON.stringify(results.filter(Boolean)), JSON.stringify(["a".repeat(100), "b".repeat(100)]));
}

{
  const { push } = createChunker();
  eq("a frame without a header is ignored", JSON.stringify(push("no header")), "null");
  eq("an out-of-range index is ignored", JSON.stringify(push("1:5:2\nout of range")), "null");
  eq("the first slice of a message is held", JSON.stringify(push("7:0:2\nfirst")), "null");
  eq("a duplicate slice is ignored", JSON.stringify(push("7:0:2\nfirst")), "null");
  eq("the last slice completes the message", String(push("7:1:2\nsecond")), "firstsecond");
}

{
  const { push, pendingCount } = createChunker({ maxPending: 2 });
  push("1:0:2\na");
  push("2:0:2\nb");
  push("3:0:2\nc");
  eq("past maxPending the oldest is dropped", String(pendingCount()), "2");
  eq("the dropped message never completes", JSON.stringify(push("1:1:2\na")), "null");
  eq("the kept message completes", String(push("3:1:2\nc")), "cc");
}

throws("a maxSize that cannot carry a payload is refused", () => createChunker({ maxSize: 6 }).split("payload"), "no room");

done();
