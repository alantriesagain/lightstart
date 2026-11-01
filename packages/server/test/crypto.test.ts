/**
 * @file The hashing seam and signed cookies: HMAC-SHA256 and SHA-256 against known values,
 * constant-time equality, a random token, signing and unsigning a value, key rotation over
 * several secrets, and every malformed or forged form answering null. Through `NodeCrypto`
 * (`node:crypto`, the same calls natively), so both runtimes print the same output.
 */
import { signCookieValue, unsignCookieValue } from "../crypto.ts";
import { NodeCrypto } from "../node/crypto.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const main = (): void => {
  const crypto = new NodeCrypto();
  eq(
    "HMAC-SHA256 of a known message",
    crypto.hmacSha256("key", "The quick brown fox jumps over the lazy dog"),
    "97yD9DBThCSxMpjmqm-xQ-9NWaFJRhdZl0edvC0aPNg",
  );
  eq("HMAC is base64url", String(crypto.hmacSha256("key", "hello").indexOf(".")), "-1");
  eq("SHA-256 of text", crypto.sha256("hello"), "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  eq("SHA-256 of bytes is the same", crypto.sha256(new TextEncoder().encode("hello")), crypto.sha256("hello"));
  eq("constant-time equality", String(crypto.safeEqual("abc", "abc")) + " " + String(crypto.safeEqual("abc", "abd")) + " " + String(crypto.safeEqual("abc", "ab")), "true false false");
  const token = crypto.randomToken(16);
  ok("a 16-byte token is 22 base64url characters", /^[A-Za-z0-9_-]{22}$/.test(token));

  const signed = signCookieValue(crypto, "secret", "user=42");
  eq("a signed value is value.signature", signed.slice(0, "user=42.".length), "user=42.");
  eq("and unsigns to the value", unsignCookieValue(crypto, "secret", signed) ?? "", "user=42");
  eq("another secret does not verify", String(unsignCookieValue(crypto, "other", signed)), "null");
  eq("a tampered value does not verify", String(unsignCookieValue(crypto, "secret", "user=43" + signed.slice("user=42".length))), "null");
  eq("a tampered signature does not verify", String(unsignCookieValue(crypto, "secret", signed.slice(0, signed.length - 1) + "A")), "null");
  eq("no dot is malformed", String(unsignCookieValue(crypto, "secret", "user=42")), "null");
  eq("an empty signature is malformed", String(unsignCookieValue(crypto, "secret", "user=42.")), "null");

  const oldSigned = signCookieValue(crypto, "old", "sid=1");
  const newSigned = signCookieValue(crypto, "new", "sid=2");
  eq(
    "key rotation accepts old and new",
    (unsignCookieValue(crypto, ["new", "old"], oldSigned) ?? "none") + " " + (unsignCookieValue(crypto, ["new", "old"], newSigned) ?? "none"),
    "sid=1 sid=2",
  );
  eq("a value with dots survives", unsignCookieValue(crypto, "secret", signCookieValue(crypto, "secret", "a.b.c")) ?? "", "a.b.c");

  done();
};

main();
