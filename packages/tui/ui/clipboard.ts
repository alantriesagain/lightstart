/**
 * @file The system clipboard, as a terminal program reaches it. OSC 52 asks the terminal to set it
 * (kitty, WezTerm, Alacritty, foot, iTerm2, Windows Terminal; over SSH too); a clipboard tool
 * (xclip, xsel, wl-copy) sets it where the terminal does not take OSC 52, as VTE's terminals do
 * not (Guake, GNOME Terminal, Tilix: they set VTE_VERSION). config.json's "clipboard" says how:
 * "auto" (OSC 52, or the tool under VTE), "osc52", or "xclip" (a tool, whichever is installed).
 * Until the entry configures it the clipboard does nothing, so tests never reach the real one.
 *
 * In auto mode a copy goes by OSC 52 where the terminal takes it, and by the tool under VTE (OSC 52
 * when there is no tool).
 */
import { spawn } from "node:child_process";
import { errorMessage } from "@light/lib/json.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** A clipboard tool: its command and arguments, reading the text on stdin. */
export class ClipboardTool {
  readonly command: string;
  readonly args: string[];

  constructor(command: string, args: string[]) {
    this.command = command;
    this.args = args;
  }
}

/** The OSC 52 sequence that sets the clipboard to `text`. */
export const osc52 = (text: string): string => "\x1b]52;c;" + Buffer.from(text, "utf8").toString("base64") + "\x07";

/** The first clipboard tool on `path` for the display there is (X11: xclip, xsel; Wayland: wl-copy); null for none. */
export const findTool = (path: string, x11: boolean, wayland: boolean): ClipboardTool | null => {
  const has = (name: string): boolean => {
    for (const dir of path.split(":")) if (dir.length > 0 && existsSync(join(dir, name))) return true;
    return false;
  };
  if (wayland && has("wl-copy")) return new ClipboardTool("wl-copy", []);
  if (x11 && has("xclip")) return new ClipboardTool("xclip", ["-selection", "clipboard"]);
  if (x11 && has("xsel")) return new ClipboardTool("xsel", ["--clipboard", "--input"]);
  return null;
};

/** How a copy goes for `mode` ("auto", "osc52", "xclip"): "osc52", "tool", or "" when it cannot. */
export const wayFor = (mode: string, vte: boolean, tool: boolean): string => {
  if (mode === "osc52") return "osc52";
  if (mode === "xclip") return tool ? "tool" : "";
  return vte && tool ? "tool" : "osc52";
};

export class Clipboard {
  /** "auto", "osc52", "xclip", or "off" (the default until the entry configures it). */
  mode = "off";
  /** Writes OSC 52 to the terminal (the entry sets it). */
  onWrite: ((text: string) => void) | null = null;
  private tool: ClipboardTool | null = null;
  private vte = false;

  /** Copy as config.json's `mode` says, in the environment the process runs in. */
  configure(mode: string): void {
    this.mode = mode === "osc52" || mode === "xclip" ? mode : "auto";
    const env = process.env;
    this.vte = (env.VTE_VERSION ?? "").length > 0;
    this.tool = findTool(env.PATH ?? "", (env.DISPLAY ?? "").length > 0, (env.WAYLAND_DISPLAY ?? "").length > 0);
  }

  /** Put `text` on the clipboard; "" when it went, else why not. */
  copy(text: string): string {
    if (this.mode === "off") return "";
    const way = wayFor(this.mode, this.vte, this.tool !== null);
    const tool = this.tool;
    if (way === "tool" && tool !== null) return this.run(tool, text);
    const fn = this.onWrite;
    if (way === "osc52" && fn !== null) {
      fn(osc52(text));
      return "";
    }
    return this.mode === "xclip" ? "no clipboard tool found (install xclip, xsel or wl-copy)" : "nowhere to copy to";
  }

  /** Feed `text` to the tool. Its output is not piped: xclip forks a server that would hold the pipes open. */
  private run(tool: ClipboardTool, text: string): string {
    try {
      const child = spawn(tool.command, tool.args, { stdio: ["pipe", "ignore", "ignore"] });
      child.on("error", (_e: Error) => {});
      child.stdin!.on("error", (_e: Error) => {});
      child.stdin!.write(text);
      child.stdin!.end();
      return "";
    } catch (err) {
      return tool.command + ": " + (errorMessage(err, "cannot start"));
    }
  }
}
