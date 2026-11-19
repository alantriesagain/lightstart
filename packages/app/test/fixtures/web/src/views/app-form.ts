import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

const FIELDS = [
  { name: "title", label: "Title", type: "text" },
  { name: "live", label: "Live", type: "checkbox" },
];

class AppForm extends View {
  render() {
    return html`
      <h1>Form</h1>
      <lc-form .fields=${FIELDS}></lc-form>
    `;
  }
}

View.register("app-form", AppForm);
