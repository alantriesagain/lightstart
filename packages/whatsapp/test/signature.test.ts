// node-only
/**
 * @file Meta's two webhook checks: the subscription handshake, and the
 * X-Hub-Signature-256 over the bytes exactly as sent.
 */

import { createHmac } from "node:crypto";
import { done, eq, ok } from "@lightstart/test/assert.ts";

import { constantTimeEqual, signatureOf, verifyChallenge, verifySignature } from "../server/signature.ts";

const SECRET = "app-secret";
const BODY = '{"object":"whatsapp_business_account","entry":[{"id":"1","note":"Caf\\u00e9"}]}';
const metaSigns = (body: string, secret: string): string => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const main = async (): Promise<void> => {
  const ask = (params: Record<string, string>): URLSearchParams => new URLSearchParams(params);

  eq(
    "handshake: the challenge when mode and token match",
    String(verifyChallenge(ask({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "1158201444" }), "tok")),
    "1158201444",
  );
  eq("handshake: null for a wrong token", String(verifyChallenge(ask({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "1" }), "tok")), "null");
  eq("handshake: null for another mode", String(verifyChallenge(ask({ "hub.mode": "unsubscribe", "hub.verify_token": "tok", "hub.challenge": "1" }), "tok")), "null");
  eq("handshake: null when no token is set", String(verifyChallenge(ask({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" }), "")), "null");

  const header = metaSigns(BODY, SECRET);
  eq("signature: a good signature over the exact bytes", String(await verifySignature(BODY, header, SECRET)), "true");
  eq("signature: hex case does not matter", String(await verifySignature(BODY, header.toUpperCase().replace("SHA256=", "sha256="), SECRET)), "true");
  eq("signature: a reformatted body is a different signature", String(await verifySignature(JSON.stringify(JSON.parse(BODY)), header, SECRET)), "false");
  eq("signature: another secret is refused", String(await verifySignature(BODY, header, "other")), "false");
  eq("signature: no secret is refused", String(await verifySignature(BODY, header, "")), "false");
  for (const bad of [null, undefined, "", "sha1=abc", header.replace("sha256=", ""), `${header}00`])
    eq(`signature: a ${String(bad)} header is refused`, String(await verifySignature(BODY, bad, SECRET)), "false");
  eq("signature: the helper signs as Meta does", await signatureOf(BODY, SECRET), metaSigns(BODY, SECRET));

  eq("constant time: equal bytes", String(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))), "true");
  eq("constant time: different bytes", String(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))), "false");
  eq("constant time: different lengths", String(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))), "false");
  ok("signature: done", true);
  done();
};

await main();
