/**
 * @file The demo's backend: a window showing the page in demo/web, three methods, a tick every
 * second, a listener for the page's "hello" event. With --smoke it quits on its own once the
 * page connected, called a method, emitted hello, called add twice with the right answers, and
 * acknowledged the first tick through the log, printing "smoke ok"; that is the gate
 * native/desktop/smoke.js runs.
 */
import { DesktopApp, num } from "../host.js";

const smoke = process.argv.includes("--smoke");
const app = new DesktopApp({ title: "light desktop demo", width: 640, height: 400 });
let ticks = 0;
let pinged = false;
let ticked = false;
let greeted = false;
let added = false;

const check = () => {
  if (smoke && pinged && ticked && greeted && added) {
    console.log("smoke ok");
    app.quit();
  }
};

app.handle("add", (args) => Promise.resolve(num(args, 0) + num(args, 1)));
app.handle("ping", () => {
  pinged = true;
  setTimeout(check, 0);
  return Promise.resolve("pong");
});
app.handle("quit", () => {
  setTimeout(() => app.quit(), 0);
  return Promise.resolve(null);
});
app.on("hello", (value) => {
  if (typeof value === "string") {
    process.stderr.write("[demo] the page says hello " + value + "\n");
    greeted = true;
    check();
  }
});
app.onLog = (/** @type {string} */ level, /** @type {string} */ text) => {
  process.stderr.write("[page " + level + "] " + text + "\n");
  if (text.startsWith("first tick")) ticked = true;
  if (text === "adds 3 30") added = true;
  check();
};
app.onConnect = () => {
  const beat = () => {
    if (!app.running) return;
    ticks++;
    app.emit("tick", ticks);
    setTimeout(beat, 1000);
  };
  beat();
};
app.onClose = () => {
  process.stderr.write("[demo] window closed after " + String(ticks) + " ticks\n");
};
if (smoke)
  setTimeout(() => {
    console.log("smoke timed out: pinged=" + String(pinged) + " ticked=" + String(ticked) + " greeted=" + String(greeted) + " added=" + String(added));
    process.exit(1);
  }, 15000);
app.start();
