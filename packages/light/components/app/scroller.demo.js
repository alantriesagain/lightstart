import { html } from "@bootstrapp/light/html";

export default {
  description: "A horizontal strip that scrolls, with its own snap points and scrollbar.",
  preview: () => html`
    <lc-scroller gap="0.5rem" chevrons="never" style="width: 200px">
      <lc-tag class="shrink-0">Design</lc-tag>
      <lc-tag class="shrink-0">Frontend</lc-tag>
      <lc-tag class="shrink-0">Backend</lc-tag>
      <lc-tag class="shrink-0">DevOps</lc-tag>
      <lc-tag class="shrink-0">Mobile</lc-tag>
    </lc-scroller>
  `,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-scroller gap="0.75rem">
          <button class="shrink-0">…</button>
          <button class="shrink-0">…</button>
        </lc-scroller>
      `,
    },
  ],
};
