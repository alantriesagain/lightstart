import { html } from "@bootstrapp/light/html";

export default {
  description: "The shape of content while it loads.",
  preview: () => html`
    <div class="flex gap-3 items-center" style="width: 180px">
      <lc-skeleton variant="circle" width="40px" height="40px"></lc-skeleton>
      <div class="flex-1"><lc-skeleton count="2"></lc-skeleton></div>
    </div>
  `,
  examples: [
    {
      title: "Text",
      render: () => html`
        <lc-skeleton></lc-skeleton>
      `,
    },
    {
      title: "Multiple text lines",
      render: () => html`
        <lc-skeleton count="3"></lc-skeleton>
      `,
    },
    {
      title: "Circle",
      render: () => html`
        <lc-skeleton variant="circle" width="40px" height="40px"></lc-skeleton>
      `,
    },
    {
      title: "Rectangle",
      render: () => html`
        <lc-skeleton variant="rect" width="200px" height="150px"></lc-skeleton>
      `,
    },
    {
      title: "Rounded rectangle",
      render: () => html`
        <lc-skeleton variant="rounded" width="300px" height="200px"></lc-skeleton>
      `,
    },
    {
      title: "Without animation",
      render: () => html`
        <lc-skeleton animated="false"></lc-skeleton>
      `,
    },
    {
      title: "Loading card",
      render: () => html`
        <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
          <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
            <lc-skeleton variant="circle" width="48px" height="48px"></lc-skeleton>
            <div style="flex: 1;">
              <lc-skeleton width="40%" height="16px"></lc-skeleton>
              <lc-skeleton width="60%" height="12px"></lc-skeleton>
            </div>
          </div>
          <lc-skeleton variant="rounded" width="100%" height="200px"></lc-skeleton>
          <lc-skeleton count="3" height="12px"></lc-skeleton>
        </div>
      `,
    },
    {
      title: "Loading profile",
      render: () => html`
        <div style="text-align: center; padding: 2rem;">
          <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
            <lc-skeleton variant="circle" width="120px" height="120px"></lc-skeleton>
          </div>
          <lc-skeleton width="200px" height="24px" style="margin: 0 auto 0.5rem;"></lc-skeleton>
          <lc-skeleton width="150px" height="16px" style="margin: 0 auto;"></lc-skeleton>
          <div style="margin-top: 2rem;">
            <lc-skeleton count="4" height="14px"></lc-skeleton>
          </div>
        </div>
      `,
    },
    {
      title: "Custom sizing",
      render: () => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <lc-skeleton width="100%" height="20px"></lc-skeleton>
          <lc-skeleton width="90%" height="16px"></lc-skeleton>
          <lc-skeleton width="75%" height="16px"></lc-skeleton>
          <lc-skeleton width="85%" height="16px"></lc-skeleton>
        </div>
      `,
    },
  ],
};
