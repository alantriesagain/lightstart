/**
 * @file The address precedence: Cloudflare's header only for a Cloudflare
 * host, the caller's `c.ip` otherwise, and never a raw forwarded chain.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { clientIp } from "../server/ip.ts";

const request = (headers: Record<string, string>) => ({
  headers: { get: (name: string): string | null => headers[name] ?? null },
});

const main = async (): Promise<void> => {
  eq(
    "clientIp: Cloudflare's header wins when the caller says the host is Cloudflare",
    String(clientIp(request({ "cf-connecting-ip": "1.1.1.1" }), { trusted: true, ip: "2.2.2.2" })),
    "1.1.1.1",
  );
  eq(
    "clientIp: without trust, the header is ignored and c.ip answers",
    String(clientIp(request({ "cf-connecting-ip": "1.1.1.1" }), { ip: "2.2.2.2" })),
    "2.2.2.2",
  );
  eq(
    "clientIp: a raw X-Forwarded-For is never believed",
    String(clientIp(request({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }), { trusted: true })),
    "null",
  );
  eq(
    "clientIp: an empty Cloudflare header falls back rather than answering nothing",
    String(clientIp(request({ "cf-connecting-ip": "   " }), { trusted: true, ip: "2.2.2.2" })),
    "2.2.2.2",
  );
  eq(
    "clientIp: the chosen address loses its whitespace",
    String(clientIp(request({ "cf-connecting-ip": "  1.1.1.1  " }), { trusted: true })),
    "1.1.1.1",
  );
  eq("clientIp: no header and no c.ip is null, not a guess", String(clientIp(request({}), { trusted: true })), "null");
  ok("clientIp: an unset option is the non-Cloudflare path", clientIp(request({ "cf-connecting-ip": "1.1.1.1" })) === null);

  done();
};

await main();
