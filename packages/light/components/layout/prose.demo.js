import { html } from "@bootstrapp/light/html";

export default {
  description: "Long-form text with the spacing and measure of a document.",
  slot: () => html`
    <h2>A heading</h2>
    <p>A paragraph of long-form text, set at a comfortable measure.</p>
  `,
  preview: () => html`
    <lc-prose>
      <h2>What the library is for</h2>
      <p>Every component reads the same tokens, so a theme decides how the whole app looks rather than how one screen does.</p>
      <ul><li>No import step</li><li>No registration call</li></ul>
    </lc-prose>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Long-form",
      render: () => html`
        <lc-prose>
          <h2>What the library is for</h2>
          <p>
            Every component reads the same tokens, so a theme decides how the whole
            app looks rather than how one screen does.
          </p>
          <ul>
            <li>No import step</li>
            <li>No registration call</li>
          </ul>
        </lc-prose>
      `,
    },
    {
      title: "Wide",
      render: () => html`
        <lc-prose wide>
          <p>A wider measure, for a page that is mostly text.</p>
        </lc-prose>
      `,
    },
  ],
};
