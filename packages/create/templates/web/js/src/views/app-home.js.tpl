import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<p>This is the home route.</p>`;
  }
}

View.register("app-home", AppHome);
