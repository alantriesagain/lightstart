import { html } from "/app/__light-runtime__.js";

export default {
  description: "A QR code for a string, drawn at whatever size it is given.",
  preview: () => html`<qr-code value="https://bootstrapp.ai" size="88"></qr-code>`,
  examples: [
    {
      title: "A link",
      render: () => html`
        <qr-code value="https://bootstrapp.ai" label="bootstrapp.ai"></qr-code>
      `,
    },
    {
      title: "Sizes",
      render: () => html`
        <lc-flex align="center" gap="lg">
          <qr-code value="https://bootstrapp.ai" size="96"></qr-code>
          <qr-code value="https://bootstrapp.ai" size="160"></qr-code>
        </lc-flex>
      `,
    },
  ],
};
