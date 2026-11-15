/**
 * @file Cloudflare tunnels for `light serve --tunnel`: a quick tunnel by default whose
 * trycloudflare.com origin is read from cloudflared's output, or the named tunnel the project's
 * `light.dev.tunnel` declares, with its ingress passing only the paths it lists when it lists
 * any. Both answer a stop() that kills the child; when cloudflared is missing or the tunnel does
 * not come up, one warning says so and the server keeps running.
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** A named tunnel: the hostname it answers on, and the only paths it passes (all of them when empty). */
export type DevTunnel = { hostname: string; paths: string[] };

/** A running tunnel: its public origin, the only paths it passes, and how to stop it. */
export type Tunnel = { origin: string; paths: string[]; stop: () => void };

/** What the tunnel logs through. */
export type TunnelLog = { log: (message: string) => void; warn: (message: string) => void };

const TUNNEL_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const CONNECTED_RE = /Registered tunnel connection/;
const HOSTNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const STARTUP_TIMEOUT_MS = 20000;
const NOT_FOUND = "cloudflared not found; install it (https://developers.cloudflare.com/cloudflared/) or use --host 0.0.0.0";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** `light.dev.tunnel` as a tunnel: a hostname, or `{ hostname, paths }` with each path starting at `/`. */
export const tunnelOf = (value: unknown): DevTunnel | null => {
  if (typeof value === "string") return value ? { hostname: value, paths: [] } : null;
  if (!isRecord(value) || typeof value["hostname"] !== "string" || !value["hostname"]) return null;
  const paths = Array.isArray(value["paths"]) ? value["paths"].filter((path): path is string => typeof path === "string" && path.startsWith("/")) : [];
  return { hostname: value["hostname"], paths };
};

const lastLine = (text: string): string => text.trim().split("\n").at(-1) ?? "";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The cloudflared config for a named tunnel: one ingress rule per path (the whole host when none), then a 404 for anything else. */
export const ingressConfig = (tunnel: DevTunnel, port: number): string => {
  const service = JSON.stringify(`http://localhost:${port}`);
  const host = JSON.stringify(tunnel.hostname);
  const rules = tunnel.paths.length
    ? tunnel.paths.map((path) => `  - hostname: ${host}\n    path: ${JSON.stringify(`^${escapeRegExp(path)}$`)}\n    service: ${service}`)
    : [`  - hostname: ${host}\n    service: ${service}`];
  return ["ingress:", ...rules, "  - service: http_status:404", ""].join("\n");
};

/** The name a hostname's tunnel goes by on the Cloudflare account. */
export const tunnelName = (hostname: string): string => `light-${hostname.replace(/\./g, "-")}`;

/** The arguments for a quick tunnel to `port`. */
export const quickTunnelArgs = (port: number): string[] => ["tunnel", "--url", `http://localhost:${port}`];

/** The arguments for running a named tunnel from its ingress config. */
export const namedTunnelRunArgs = (configPath: string, name: string): string[] => ["tunnel", "--config", configPath, "run", name];

const cloudflared = (args: string[]): Promise<{ ok: boolean; missing: boolean; stdout: string; output: string }> =>
  new Promise((resolve) => {
    execFile("cloudflared", args, { timeout: STARTUP_TIMEOUT_MS }, (error, stdout, stderr) =>
      resolve({
        ok: !error,
        missing: (error as NodeJS.ErrnoException | null)?.code === "ENOENT",
        stdout,
        output: `${stdout}\n${stderr}`,
      }),
    );
  });

const listsTunnel = (stdout: string): boolean => {
  try {
    const list: unknown = JSON.parse(stdout);
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
};

const runUntil = (args: string[], ready: RegExp, origin: (match: RegExpMatchArray) => string, paths: string[], log: TunnelLog): Promise<Tunnel | null> => {
  const { promise, resolve } = Promise.withResolvers<Tunnel | null>();
  const child = spawn("cloudflared", args, { stdio: ["ignore", "pipe", "pipe"] });
  const stop = (): void => {
    try {
      child.kill("SIGTERM");
    } catch {}
  };
  let settled = false;
  const settle = (value: Tunnel | null, warning?: string): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (warning !== undefined) log.warn(warning);
    resolve(value);
  };
  const timer = setTimeout(() => {
    settle(null, `cloudflared did not report a tunnel within ${STARTUP_TIMEOUT_MS / 1000}s; continuing without it`);
    stop();
  }, STARTUP_TIMEOUT_MS);

  let buffer = "";
  const scan = (chunk: Buffer): void => {
    buffer += String(chunk);
    const match = buffer.match(ready);
    if (match) settle({ origin: origin(match), paths, stop });
  };
  child.stdout?.on("data", scan);
  child.stderr?.on("data", scan);
  child.on("error", () => settle(null, NOT_FOUND));
  child.on("exit", (code) => settle(null, `cloudflared exited early (code ${String(code)}): ${lastLine(buffer)}; continuing without a tunnel`));
  return promise;
};

const startNamedTunnel = async (port: number, projectDir: string, tunnel: DevTunnel, log: TunnelLog): Promise<Tunnel | null> => {
  const skip = (reason: string): null => {
    log.warn(`--tunnel ${tunnel.hostname}: ${reason}; continuing without a tunnel`);
    return null;
  };
  if (!HOSTNAME_RE.test(tunnel.hostname)) return skip("light.dev.tunnel is not a host name");
  const cert = process.env["TUNNEL_ORIGIN_CERT"] ?? join(homedir(), ".cloudflared", "cert.pem");
  if (!existsSync(cert)) return skip("run `cloudflared tunnel login` once and pick the hostname's zone");
  const name = tunnelName(tunnel.hostname);
  const listed = await cloudflared(["tunnel", "list", "--name", name, "--output", "json"]);
  if (listed.missing) return skip(NOT_FOUND);
  if (!listsTunnel(listed.stdout)) {
    const created = await cloudflared(["tunnel", "create", name]);
    if (!created.ok && !/already exists/i.test(created.output)) return skip(`cloudflared could not create ${name}: ${lastLine(created.output)}`);
    if (created.ok) log.log(`Created the Cloudflare tunnel ${name}`);
  }
  const routed = await cloudflared(["tunnel", "route", "dns", name, tunnel.hostname]);
  if (!routed.ok) return skip(`cloudflared could not point ${tunnel.hostname} at ${name}: ${lastLine(routed.output)}`);
  const config = join(projectDir, ".light", "tunnel.yml");
  mkdirSync(dirname(config), { recursive: true });
  writeFileSync(config, ingressConfig(tunnel, port));
  return runUntil(namedTunnelRunArgs(config, name), CONNECTED_RE, () => `https://${tunnel.hostname}`, tunnel.paths, log);
};

/**
 * Start the tunnel `--tunnel` asks for: the named one `light.dev.tunnel` declares, else a quick
 * one. Answers null, with the reason logged, when cloudflared is missing or the tunnel does not
 * come up.
 */
export const startTunnel = (options: { port: number; projectDir: string; named: DevTunnel | null }, log: TunnelLog): Promise<Tunnel | null> =>
  options.named
    ? startNamedTunnel(options.port, options.projectDir, options.named, log)
    : runUntil(quickTunnelArgs(options.port), TUNNEL_URL_RE, (match) => match[0], [], log);
