/**
 * @file The demo page: light's title bar on the frameless window, and a light component that
 * connects to the backend, counts its ticks, adds 100 to a running total through the bridge on
 * each click, maximizes and restores the window through its host, reports where the title bar's
 * controls are (for frameless-check.js), and can close the app.
 */
import View from "@bootstrapp/light";
import titleBar from "@bootstrapp/light/components/app/title-bar.js";
import { env } from "@bootstrapp/light/env";
import { html } from "@bootstrapp/light/html";
import { connect } from "@bootstrapp/light/native/desktop/client.js";

View.define("lc-title-bar", titleBar);

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
    await this.reportControls();
    const first = await desktop.call.add(1, 2);
    const second = await desktop.call.add(10, 20);
    await desktop.log("info", "adds " + String(first) + " " + String(second));
    await desktop.log("info", "page is up, ping answered " + this.pong);
  },
  async windowRoundTrip() {
    const host = env.window;
    if (host === null) return;
    await desktop.log("info", "window " + host.platform + " frameless=" + String(host.frameless));
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
  async reportControls() {
    /** @param {string} part */
    const at = (part) => {
      const button = document.querySelector(`lc-title-bar [part~=lc-title-bar-${part}]`);
      if (button === null) return "none";
      const r = button.getBoundingClientRect();
      return `${Math.round(r.left + r.width / 2)},${Math.round(r.top + r.height / 2)}`;
    };
    await desktop.log("info", `controls width=${String(env.width)} minimize=${at("minimize")} maximize=${at("maximize")} close=${at("close")}`);
  },
  async add() {
    this.sum = await desktop.call.add(this.sum, 100);
  },
  render() {
    return html`
      <h1>light desktop</h1>
      <p>The page runs in the system's web view; the backend is a native binary with no JavaScript engine.</p>
      <p>ticks from the backend: <output>${this.ticks}</output></p>
      <p>ping: <output>${this.pong}</output></p>
      <p>
        <button @click=${this.add}>add 100</button>
        <button @click=${() => desktop.call.quit()}>quit</button>
        <output>${this.sum}</output>
      </p>`;
  },
});
