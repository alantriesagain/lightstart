/**
 * @file The fixture tool's page under `/admin/tool`.
 */

import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class ToolPage extends View {
  render() {
    return html`<lc-text level="2">Tool page</lc-text><lc-text>Filled by the fixture tool extension.</lc-text>`;
  }
}

View.register("tool-page", ToolPage);
