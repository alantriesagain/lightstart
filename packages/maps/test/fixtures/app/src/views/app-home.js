import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<maps-view .points=${[]}></maps-view>`;
  }
}

View.register("app-home", AppHome);
