import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppProfile extends View {
  render() {
    return html`<p>Profile</p>`;
  }
}

View.register("app-profile", AppProfile);
