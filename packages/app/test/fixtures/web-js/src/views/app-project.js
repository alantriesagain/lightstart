import { pageHead } from "@lightstart/app";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppProject extends View {
  static props = { slug: "" };

  render() {
    pageHead({ image: "/images/project.png" });
    return html`<h1>${this.slug}</h1>`;
  }
}

View.register("app-project", AppProject);
