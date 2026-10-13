/**
 * @file The demo page: a light component that connects to the backend, counts its ticks, adds
 * two numbers through the bridge, and can close the app.
 */
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { connect } from "@bootstrapp/light/native/desktop/client.js";

/** @import { DemoApi, DemoEvents, DemoPageEvents } from "../contract.ts" */

/** @type {import("@bootstrapp/light/native/desktop/types.ts").Desktop<DemoApi, DemoEvents, DemoPageEvents>} */
const desktop = connect();

View.define("demo-page", {
  props: { ticks: 0, sum: 0, pong: "" },
  async connected() {
    desktop.on("tick", (n) => {
      this.ticks = n;
    });
    desktop.once("tick", (n) => desktop.log("info", "first tick " + String(n)));
    await desktop.ready();
    this.pong = await desktop.call.ping();
    await desktop.emit("hello", "from the page");
    await this.windowRoundTrip();
    const first = await desktop.call.add(1, 2);
    const second = await desktop.call.add(10, 20);
    await desktop.log("info", "adds " + String(first) + " " + String(second));
    await desktop.log("info", "page is up, ping answered " + this.pong);
  },
  async windowRoundTrip() {
    const host = /** @type {{ __desktopWindow?: import("@bootstrapp/light/env/types.ts").WindowHost }} */ (/** @type {unknown} */ (globalThis)).__desktopWindow;
    if (host === undefined) return;
    /** @param {boolean} wanted */
    const until = (wanted) => new Promise((resolve) => {
      if (host.maximized === wanted) return void resolve(true);
      const stop = host.subscribe((h) => {
        if (h.maximized !== wanted) return;
        stop();
        resolve(true);
      });
      setTimeout(() => {
        stop();
        resolve(false);
      }, 3000);
    });
    host.toggleMaximize();
    const maximized = await until(true);
    host.toggleMaximize();
    const restored = await until(false);
    await desktop.log("info", maximized && restored ? "window maximize round trip" : "window maximize round trip failed");
  },
  async add() {
    this.sum = await desktop.call.add(this.ticks, 100);
  },
  render() {
    return html`
      <h1>light desktop</h1>
      <p>The page runs in the system's web view; the backend is a native binary with no JavaScript engine.</p>
      <p>ticks from the backend: <output>${this.ticks}</output></p>
      <p>ping: <output>${this.pong}</output></p>
      <p>
        <button @click=${this.add}>add ticks + 100</button>
        <button @click=${() => desktop.call.quit()}>quit</button>
        <output>${this.sum}</output>
      </p>`;
  },
});
