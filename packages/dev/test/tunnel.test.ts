// node-only
/**
 * @file The tunnel's pure pieces: `light.dev.tunnel` reading, its ingress config, the name and
 * the cloudflared arguments; and the one warning a missing cloudflared leaves behind.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ingressConfig,
  namedTunnelRunArgs,
  quickTunnelArgs,
  startTunnel,
  tunnelName,
  tunnelOf,
} from "../node/tunnel.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

const main = async (): Promise<void> => {
  eq("a hostname string is a tunnel with no paths", JSON.stringify(tunnelOf("dev.example.com")), JSON.stringify({ hostname: "dev.example.com", paths: [] }));
  eq(
    "an object keeps the paths that start at a slash",
    JSON.stringify(tunnelOf({ hostname: "dev.example.com", paths: ["/api", "nope", 2, "/ws"] })),
    JSON.stringify({ hostname: "dev.example.com", paths: ["/api", "/ws"] }),
  );
  ok("an empty hostname is no tunnel", tunnelOf("") === null);
  ok("an object without a hostname is no tunnel", tunnelOf({ paths: ["/api"] }) === null);
  ok("a non-tunnel is no tunnel", tunnelOf(42) === null);

  const whole = ingressConfig({ hostname: "dev.example.com", paths: [] }, 3456);
  ok("a whole-host tunnel names the hostname", whole.includes('hostname: "dev.example.com"'));
  ok("and points at the port", whole.includes('service: "http://localhost:3456"'));
  ok("and answers anything else with a 404", whole.includes("service: http_status:404"));
  ok("with one rule", whole.trim().split("\n").filter((line) => line.startsWith("  - hostname:")).length === 1);

  const paths = ingressConfig({ hostname: "dev.example.com", paths: ["/api", "/a.b"] }, 3456);
  ok("a path tunnel anchors each path", paths.includes('path: "^/api$"') && paths.includes('path: "^/a\\\\.b$"'));
  eq("with a rule per path", String(paths.trim().split("\n").filter((line) => line.startsWith("  - hostname:")).length), "2");

  eq("the tunnel name is derived from the hostname", tunnelName("dev.example.com"), "light-dev-example-com");
  eq("a quick tunnel points cloudflared at the port", JSON.stringify(quickTunnelArgs(3456)), JSON.stringify(["tunnel", "--url", "http://localhost:3456"]));
  eq(
    "a named tunnel runs from its config",
    JSON.stringify(namedTunnelRunArgs("/p/.light/tunnel.yml", "light-dev-example-com")),
    JSON.stringify(["tunnel", "--config", "/p/.light/tunnel.yml", "run", "light-dev-example-com"]),
  );

  const dir = mkdtempSync(join(tmpdir(), "dev-tunnel-"));
  const originalPath = process.env["PATH"];
  const warnings: string[] = [];
  try {
    process.env["PATH"] = dir;
    const tunnel = await startTunnel({ port: 3456, projectDir: dir, named: null }, { log() {}, warn: (message) => warnings.push(message) });
    ok("a missing cloudflared leaves no tunnel", tunnel === null);
    eq("and logs one warning", String(warnings.length), "1");
    ok("that names cloudflared", warnings[0]?.includes("cloudflared not found") === true);
  } finally {
    if (originalPath === undefined) delete process.env["PATH"];
    else process.env["PATH"] = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
  done();
};

await main();
