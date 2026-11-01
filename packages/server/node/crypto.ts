/**
 * @file The `Crypto` seam on node's `node:crypto`: HMAC-SHA256 as base64url, SHA-256 as hex, a
 * length-checked `timingSafeEqual`, and `randomBytes` as base64url. The same calls compile natively
 * (`probes/crypto-node.ts`), so the node adapter uses this one under both runtimes.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Crypto } from "../crypto.ts";

export class NodeCrypto extends Crypto {
  hmacSha256(key: string, data: string): string {
    const hmac = createHmac("sha256", key);
    hmac.update(data);
    return hmac.digest("base64url");
  }

  sha256(data: string | Uint8Array): string {
    const hash = createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
  }

  safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  randomToken(bytes: number): string {
    return randomBytes(bytes).toString("base64url");
  }
}
