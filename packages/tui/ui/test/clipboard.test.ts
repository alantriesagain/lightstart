/**
 * @file The clipboard's way: OSC 52 unless the terminal is VTE (Guake, GNOME Terminal) with a tool there,
 * "osc52" and "xclip" as config.json says; the OSC 52 text (base64 of UTF-8); the tool found on
 * PATH for the display there is (wl-copy under Wayland, xclip then xsel under X11); a clipboard not
 * configured copies nothing.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clipboard, findTool, osc52, wayFor } from "../clipboard.ts";
import { done, eq, ok } from "@light/test/assert.ts";

eq("auto: OSC 52, the tool under VTE, OSC 52 under VTE without one", [wayFor("auto", false, true), wayFor("auto", true, true), wayFor("auto", true, false)].join(" "), "osc52 tool osc52");
eq("osc52 and xclip as set; xclip without a tool cannot", [wayFor("osc52", true, true), wayFor("xclip", false, true), "[" + wayFor("xclip", false, false) + "]"].join(" "), "osc52 tool []");
eq("OSC 52: base64 of the UTF-8 text", JSON.stringify(osc52("olá ✓")), JSON.stringify("\u001b]52;c;b2zDoSDinJM=\u0007"));

const bin = mkdtempSync(join(tmpdir(), "light-clip-"));
const tool = (name: string): void => {
  writeFileSync(join(bin, name), "#!/bin/sh\ncat > /dev/null\n");
  chmodSync(join(bin, name), 0o755);
};
eq("no tool on PATH", findTool("/nonexistent:" + bin, true, true) === null ? "none" : "some", "none");
tool("xsel");
eq("xsel under X11", findTool("/nonexistent:" + bin, true, false)?.command ?? "", "xsel");
tool("xclip");
const xclip = findTool(bin, true, false);
eq("xclip before xsel, for the clipboard selection", (xclip?.command ?? "") + " " + (xclip?.args.join(" ") ?? ""), "xclip -selection clipboard");
tool("wl-copy");
eq("wl-copy under Wayland; none without a display", (findTool(bin, true, true)?.command ?? "") + " " + (findTool(bin, false, false) === null ? "none" : "some"), "wl-copy none");
rmSync(bin, { recursive: true, force: true });

const c = new Clipboard();
const written: string[] = [];
c.onWrite = (text: string) => written.push(text);
eq("not configured: nothing copied, nothing said", c.copy("x") + "|" + String(written.length), "|0");
c.mode = "osc52";
ok("osc52: written to the terminal", c.copy("hi") === "" && written.length === 1 && written[0] === osc52("hi"));
done();
