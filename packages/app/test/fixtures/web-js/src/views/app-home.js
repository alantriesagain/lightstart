import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<lc-card><lc-text>Home</lc-text></lc-card>`;
  }
}

View.register("app-home", AppHome);
