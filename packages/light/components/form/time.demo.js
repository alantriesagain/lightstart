import { html } from "@bootstrapp/light/html";

const now = Date.now();

export default {
  description: "A time of day, in the reader's own clock format.",
  preview: () => html`
    <lc-flex gap="xs" align="center">
      <lc-icon name="clock" size="16"></lc-icon>
      <lc-time .timestamp=${new Date(2026, 0, 1, 9, 30).getTime()}></lc-time>
    </lc-flex>
  `,
  examples: [
    {
      title: "A timestamp",
      description: "Rendered in the reader's own clock format.",
      render: () => html`
        <lc-flex direction="column" gap="xs">
          <lc-time .timestamp=${now}></lc-time>
          <lc-time .timestamp=${now - 1000 * 60 * 90}></lc-time>
          <lc-time .timestamp=${now - 1000 * 60 * 60 * 30}></lc-time>
        </lc-flex>
      `,
    },
  ],
};
