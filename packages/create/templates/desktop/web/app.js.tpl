/**
 * @file The page: a light view that connects to the backend, shows what it read from the
 * machine, adds through the typed bridge, counts the ticks the backend pushes and closes the
 * app. It imports a contract for its types only; nothing in it is fetched from `contract.ts`.
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { connect } from "@lightstart/light/native/desktop/client.js";

/** @import { Api, Events, PageEvents } from "../contract.ts" */

/** @type {import("@lightstart/light/native/desktop/types.ts").Desktop<Api, Events, PageEvents>} */
const desktop = connect();

View.define("app-page", {
  props: { ticks: 0, platform: "", home: "", sum: 0 },
  async connected() {
    desktop.on("tick", (n) => {
      this.ticks = n;
    });
    await desktop.ready();
    const info = await desktop.call.machine();
    this.platform = info.platform;
    this.home = info.home;
    await desktop.emit("hello", "from the page");
  },
  async add() {
    this.sum = await desktop.call.add(this.sum, 5);
  },
  render() {
    return html`
      <main class="page">
        <lc-text tag="h1" size="2xl" weight="bold">__TITLE__</lc-text>
        <lc-card padding="lg">
          <p>This page runs in the system's web view; the backend is a native binary with no JavaScript engine.</p>
          <p>platform: <output>${this.platform}</output></p>
          <p>home: <output>${this.home}</output></p>
          <p>ticks from the backend: <output>${this.ticks}</output></p>
          <p>
            <lc-button variant="primary" @click=${this.add}>add 5</lc-button>
            <output>${this.sum}</output>
          </p>
          <p><lc-button @click=${() => desktop.call.quit()}>quit</lc-button></p>
        </lc-card>
      </main>
    `;
  },
});
