/**
 * @file Probe: what scriptc lowers of WebCrypto and its globals. `crypto.subtle.importKey` and
 * `sign` for HMAC-SHA256, `digest`, `getRandomValues`, `randomUUID`, and a constant-time compare
 * written in the core.
 */
const hex = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
};

const attempt = async (name: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    console.log(name + " refused: " + (error instanceof Error ? error.message : String(error)));
  }
};

const main = async (): Promise<void> => {
  console.log("crypto global " + typeof crypto + " subtle " + (typeof crypto === "object" && crypto !== null && "subtle" in crypto ? "yes" : "no"));
  await attempt("subtle digest", async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hello"));
    console.log("subtle sha " + hex(new Uint8Array(digest)));
  });
  await attempt("subtle hmac", async () => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("hello"));
    console.log("subtle hmac " + hex(new Uint8Array(signature)));
  });
  await attempt("getRandomValues", async () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    console.log("random hex length " + String(hex(bytes).length));
  });
  await attempt("randomUUID", async () => {
    console.log("uuid length " + String(crypto.randomUUID().length));
  });
  const safeEqual = (a: string, b: string): boolean => {
    let diff = a.length ^ b.length;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(b.length === 0 ? 0 : i % b.length);
    return diff === 0;
  };
  console.log("safe equal " + String(safeEqual("abc", "abc")) + " differs " + String(safeEqual("abc", "abd")));
};

main();

export {};
