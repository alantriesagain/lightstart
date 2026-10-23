/**
 * @file Probe AD: envelopes as NDJSON over stdin and stdout, the transport a host offers without
 * a window. Run plain, the probe spawns itself with `--child` behind a printf and prints what the
 * child echoed; run with `--child`, it parses each stdin line and writes a reply line per object.
 */
import { spawn } from "node:child_process";
import { collect, lines } from "./p-ad-stdin-lines.read.ts";

if (process.argv.includes("--child"))
  lines((line) => {
    const parsed = JSON.parse(line);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      /** @type {unknown} */
      const reply = { echo: parsed };
      process.stdout.write(JSON.stringify(reply) + "\n");
    } else process.stdout.write("skip\n");
  }, () => {
    process.stdout.write("closed\n");
  });
 else {
  const script = process.argv[1];
  const self = script !== undefined && script.endsWith(".js") ? [process.execPath, script] : [process.execPath];
  const input = "{\"type\":\"NATIVE:INFO\",\"eventId\":\"c1\"}\\n[1]\\n{\"type\":\"POST\"}\\n";
  const child = spawn("sh", ["-c", "printf '" + input + "' | " + self.map((s) => "'" + s + "'").join(" ") + " --child"], { stdio: ["ignore", "pipe", "inherit"] });
  const stdout = child.stdout;
  if (stdout === null) throw new Error("no stdout");
  collect(stdout, (text) => {
    console.log(text.trim());
    console.log("done");
  });
}
