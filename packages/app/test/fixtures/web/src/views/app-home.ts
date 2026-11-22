import View from "@lightstart/light";
import T from "@lightstart/light/types";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  static props = { heading: T.string({ sync: "settings" }) };

  render() {
    return html`<p>Home</p><h2 class="synced px-4">${this.heading}</h2><lc-icon name="house" size="18"></lc-icon><a class="morph-link" href="/about">About</a>`;
  }
}

View.register("app-home", AppHome);
