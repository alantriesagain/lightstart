/**
 * @file The shell `light desktop dev` builds when a desktop extension names no
 * host: one window that loads the dev server's origin, given as the first
 * argument, and ends with the window.
 */
import { DesktopWindow } from "../window.js";

const origin = process.argv[2] ?? "";

const shell = new DesktopWindow({ title: "light dev", width: 1280, height: 820 });

/** @type {(id: string, _req: string) => void} */
const onRequest = (id, _req) => {
  shell.answer(id, "null");
};

/** @type {() => void} */
const onClose = () => {
  process.exit(0);
};

shell.onRequest = onRequest;
shell.onClose = onClose;
shell.open();
shell.navigate(origin);
