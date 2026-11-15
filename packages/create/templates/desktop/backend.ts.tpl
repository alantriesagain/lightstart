/**
 * @file The native side: scriptc compiles this file into an executable with no JavaScript engine.
 * It opens the window, serves the page in `web/` itself, answers the page's calls over the bridge,
 * and pushes a tick every second. Never run under node: that is what `test/` covers.
 */
import { DesktopApp, num } from "@lightstart/light/native/desktop";
import { machine } from "./system.ts";

const app = new DesktopApp({ title: "__TITLE__", width: 820, height: 560 });

let ticks = 0;

app.handle("machine", () => {
  const info: unknown = machine();
  return Promise.resolve(info);
});
app.handle("add", (args) => Promise.resolve(num(args, 0) + num(args, 1)));
app.handle("quit", () => {
  setTimeout(() => app.quit(), 0);
  return Promise.resolve(null);
});
app.on("hello", (value) => {
  if (typeof value === "string") console.log("the page says " + value);
});
app.onConnect = () => {
  const beat = () => {
    if (!app.running) return;
    ticks += 1;
    app.emit("tick", ticks);
    setTimeout(beat, 1000);
  };
  beat();
};
app.start();
