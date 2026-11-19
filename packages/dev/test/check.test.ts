// node-only
/**
 * @file `light serve --watch` runs light's check after a change and prints only the findings
 * it added or cleared, and stays quiet when the project (or the flag) turns it off.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { done, ok } from "@lightstart/test/assert.ts";

const repoRoot = resolve(join(process.cwd(), "..", ".."));
const cliPath = join(repoRoot, "packages", "cli", "bin", "light.js");
const lightModules = join(repoRoot, "node_modules", "@lightstart");

const clean = `import View from "@lightstart/light";

class Home extends View {
  render() {
    return null;
  }
}

View.register("home", Home);
`;

const broken = `import View from "@lightstart/light";
import note from "../models/note.js";

class Home extends View {
  render() {
    note.add({ text: "from a view" });
    return null;
  }
}

View.register("home", Home);
`;

const freePort = (): Promise<number> =>
  new Promise((settle: (port: number) => void, reject: (error: Error) => void) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => settle(port));
    });
  });

const sleep = (ms: number): Promise<void> => new Promise((settle) => setTimeout(settle, ms));

const until = async (check: () => boolean, ms = 15000): Promise<boolean> => {
  const start = Date.now();
  while (!check() && Date.now() - start < ms) await sleep(50);
  return check();
};

const exited = (child: ChildProcess): Promise<void> =>
  new Promise((settle) => {
    if (child.exitCode !== null || child.signalCode !== null) settle();
    else child.once("exit", () => settle());
  });

const project = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "dev-check-"));
  mkdirSync(join(dir, "node_modules"));
  symlinkSync(lightModules, join(dir, "node_modules", "@lightstart"), "dir");
  mkdirSync(join(dir, "src", "views"), { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "check-fixture", version: "0.0.0", type: "module", dependencies: { "@lightstart/app": "workspace:*", "@lightstart/light": "workspace:*" } }, null, 2),
  );
  writeFileSync(join(dir, "src", "views", "home.js"), clean);
  return dir;
};

type Served = {
  child: ChildProcess;
  output: () => string;
  stop: () => Promise<void>;
};

const serve = async (dir: string): Promise<Served> => {
  const port = await freePort();
  const child = spawn(process.execPath, ["--no-warnings", cliPath, "serve", dir, "--watch", "--ephemeral", "--port", String(port)], {
    cwd: repoRoot,
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let text = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    text += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    text += chunk.toString("utf8");
  });
  return {
    child,
    output: () => text,
    stop: async () => {
      child.kill("SIGTERM");
      await exited(child);
    },
  };
};

const main = async (): Promise<void> => {
  const dir = project();
  const file = join(dir, "src", "views", "home.js");
  const served = await serve(dir);
  try {
    ok("the watched server listens", await until(() => served.output().includes("Dev server running at")));
    await sleep(1000);
    writeFileSync(file, broken);
    ok("a broken view is a new finding", await until(() => served.output().includes("check: +1 new") && served.output().includes("view-writes-no-model")));
    writeFileSync(file, clean);
    ok("fixing it clears the finding", await until(() => served.output().includes("check: −1 cleared") && served.output().includes("view-writes-no-model")));
  } finally {
    await served.stop();
    rmSync(dir, { recursive: true, force: true });
  }

  const quiet = project();
  const quietFile = join(quiet, "src", "views", "home.js");
  writeFileSync(
    join(quiet, "package.json"),
    JSON.stringify(
      { name: "check-fixture", version: "0.0.0", type: "module", dependencies: { "@lightstart/app": "workspace:*", "@lightstart/light": "workspace:*" }, light: { dev: { check: false } } },
      null,
      2,
    ),
  );
  const off = await serve(quiet);
  try {
    ok("the opt-out server listens", await until(() => off.output().includes("Dev server running at")));
    writeFileSync(quietFile, broken);
    await sleep(1200);
    ok("light.dev.check false prints no check output", !off.output().includes("check:"));
  } finally {
    await off.stop();
    rmSync(quiet, { recursive: true, force: true });
  }
  done();
};

await main();
