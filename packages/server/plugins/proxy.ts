/**
 * @file Running behind a reverse proxy or a load balancer: `app.plugin(new TrustProxy({ trust: ["10.0.0.0/8"] }))`.
 * A request whose peer is a trusted proxy has its protocol, host and client address taken from
 * what the proxy forwarded (`Forwarded`, else `X-Forwarded-Proto`, `X-Forwarded-Host` and
 * `X-Forwarded-For`), so `c.protocol`, `c.host`, `c.url` and `c.ip` say what the client asked for
 * and who it was. Any other request's forwarding headers are ignored, since anyone can send them.
 * The client's address is the rightmost one in the chain that is not itself a trusted proxy, so a
 * client cannot pose as another by sending its own `X-Forwarded-For`. `trust` lists proxy
 * addresses and IPv4 ranges, or is `true` when every peer is a proxy (a container only a proxy
 * can reach).
 */
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply } from "../reply.ts";

export interface ProxyOptions {
  trust: true | string[];
}

const plain = (address: string): string => {
  let a = address.trim();
  if (a.startsWith("[")) {
    const end = a.indexOf("]");
    a = end < 0 ? a.slice(1) : a.slice(1, end);
  } else if (a.indexOf(".") >= 0 && a.lastIndexOf(":") > a.lastIndexOf(".")) a = a.slice(0, a.lastIndexOf(":"));
  if (a.startsWith("::ffff:") && a.indexOf(".") >= 0) a = a.slice(7);
  if (a.startsWith("\"") && a.endsWith("\"")) a = a.slice(1, -1);
  return a.toLowerCase();
};

const ipv4 = (address: string): number => {
  const parts = address.split(".");
  if (parts.length !== 4) return -1;
  let out = 0;
  for (const part of parts) {
    const n = Number(part);
    if (part === "" || !Number.isInteger(n) || n < 0 || n > 255) return -1;
    out = out * 256 + n;
  }
  return out;
};

class Range {
  readonly exact: string;
  readonly base: number;
  readonly size: number;

  constructor(spec: string) {
    const slash = spec.indexOf("/");
    if (slash < 0) {
      this.exact = plain(spec);
      this.base = -1;
      this.size = 0;
      return;
    }
    const base = ipv4(spec.slice(0, slash));
    const bits = Number(spec.slice(slash + 1));
    if (base < 0 || !Number.isInteger(bits) || bits < 0 || bits > 32) throw new Error("proxy trust: \"" + spec + "\" is not an address or an IPv4 range");
    this.exact = "";
    this.size = 2 ** (32 - bits);
    this.base = base - (base % this.size);
  }

  has(address: string): boolean {
    if (this.base < 0) return this.exact === address;
    const n = ipv4(address);
    return n >= this.base && n < this.base + this.size;
  }
}

class Forwarded {
  proto = "";
  host = "";
  chain: string[] = [];
}

const unquote = (value: string): string => (value.startsWith("\"") && value.endsWith("\"") ? value.slice(1, -1) : value);

const parseForwarded = (header: string, out: Forwarded): void => {
  for (const element of header.split(",")) {
    for (const pair of element.split(";")) {
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const key = pair.slice(0, eq).trim().toLowerCase();
      const value = unquote(pair.slice(eq + 1).trim());
      if (key === "for") out.chain.push(plain(value));
      else if (key === "proto" && out.proto === "") out.proto = value.toLowerCase();
      else if (key === "host" && out.host === "") out.host = value;
    }
  }
};

const first = (header: string | null): string => {
  if (header === null) return "";
  const comma = header.indexOf(",");
  return (comma < 0 ? header : header.slice(0, comma)).trim();
};

export class TrustProxy extends Plugin {
  private readonly all: boolean;
  private readonly ranges: Range[] = [];

  constructor(options: ProxyOptions) {
    super("proxy", []);
    const trust = options.trust;
    if (trust === true) this.all = true;
    else {
      this.all = false;
      for (const spec of trust) this.ranges.push(new Range(spec));
    }
  }

  trusted(address: string): boolean {
    if (this.all) return true;
    const a = plain(address);
    for (const r of this.ranges) if (r.has(a)) return true;
    return false;
  }

  /** What the proxies forwarded for `c`, written onto it; nothing when its peer is not trusted. */
  apply(c: Context): void {
    const peer = c.incoming.remoteAddress();
    if (!this.trusted(peer)) return;
    const f = new Forwarded();
    const standard = c.header("forwarded");
    if (standard !== null) parseForwarded(standard, f);
    else {
      f.proto = first(c.header("x-forwarded-proto")).toLowerCase();
      f.host = first(c.header("x-forwarded-host"));
      const xff = c.header("x-forwarded-for");
      if (xff !== null) for (const part of xff.split(",")) if (part.trim() !== "") f.chain.push(plain(part));
    }
    f.chain.push(plain(peer));
    let client = "";
    for (let i = f.chain.length - 1; i >= 0; i--) {
      client = f.chain[i]!;
      if (!this.trusted(client)) break;
    }
    const proto = f.proto === "http" || f.proto === "https" ? f.proto : "";
    c.forwarded(proto, f.host, client === plain(peer) ? "" : client);
  }

  setup(app: App): void {
    app.onRequest((c: Context): Reply | null => {
      this.apply(c);
      return null;
    });
  }
}
