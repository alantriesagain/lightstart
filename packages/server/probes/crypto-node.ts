/**
 * @file Probe: what scriptc lowers of `node:crypto` and `Buffer` for hashing. HMAC-SHA256 in hex
 * and base64url, SHA-256 of text and bytes, `timingSafeEqual`, `randomBytes`, and a UUID.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const attempt = (name: string, fn: () => void): void => {
  try {
    fn();
  } catch (error) {
    console.log(name + " refused: " + (error instanceof Error ? error.message : String(error)));
  }
};

const main = (): void => {
  attempt("createHmac hex", () => {
    const h = createHmac("sha256", "key");
    h.update("hello");
    console.log("hmac hex " + h.digest("hex"));
  });
  attempt("createHmac base64url", () => {
    const h = createHmac("sha256", "key");
    h.update("hello");
    console.log("hmac b64url " + h.digest("base64url").slice(0, 16));
  });
  attempt("createHash hex", () => {
    const h = createHash("sha256");
    h.update("hello");
    console.log("sha hex " + h.digest("hex"));
  });
  attempt("createHash bytes", () => {
    const h = createHash("sha256");
    h.update(new TextEncoder().encode("hello"));
    console.log("sha bytes " + h.digest("base64url"));
  });
  attempt("timingSafeEqual", () => {
    const a = Buffer.from("abc");
    const b = Buffer.from("abc");
    const c = Buffer.from("abd");
    console.log("safe equal " + String(timingSafeEqual(a, b)) + " differs " + String(timingSafeEqual(a, c)));
  });
  attempt("randomBytes", () => {
    const b = randomBytes(16);
    console.log("random length " + String(b.length) + " hex " + String(b.toString("hex").length));
  });
  attempt("randomUUID", () => {
    console.log("uuid length " + String(randomUUID().length));
  });
  attempt("Buffer base64url round trip", () => {
    const text = "a+b/c?";
    const encoded = Buffer.from(text, "utf8").toString("base64url");
    console.log("b64url " + encoded + " round " + Buffer.from(encoded, "base64url").toString("utf8"));
  });
};

main();
