/**
 * @file The demo page: a light component that connects to the backend, counts its ticks, adds
 * two numbers through the bridge, and can close the app.
 */
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { connect } from "@bootstrapp/light/native/desktop/client.js";

/** @import { DemoApi, DemoEvents } from "../contract.ts" */

/** @type {import("@bootstrapp/light/native/desktop/types.ts").Desktop<DemoApi, DemoEvents>} */
const desktop = connect();

View.define("demo-page", {
  props: { ticks: 0, sum: 0, pong: "" },
  async connected() {
    desktop.on("tick", (n) => {
      const first = this.ticks === 0;
      this.ticks = n;
      if (first) desktop.log("info", "first tick " + String(n));
    });
    await desktop.ready();
    this.pong = await desktop.call.ping();
    await desktop.log("info", "page is up, ping answered " + this.pong);
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
