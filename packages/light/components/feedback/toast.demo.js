import { html } from "@bootstrapp/light/html";
import { toasts } from "./toasts.js";

export default {
  description: "A message that appears, says one thing and leaves.",
  slot: () => "Toast notification",
  preview: () => html`
    <lc-alert variant="success">Saved. Your changes are live.</lc-alert>
  `,
  examples: [
    {
      title: "One that opens what it is about",
      render: () => html`
        <lc-toast position="top-center"></lc-toast>
        <lc-button @click=${() => toasts.show({
          title: "Ana asked to join",
          message: "Sunset at Arpoador, until 19:30",
          icon: "user-round-plus",
          duration: 6000,
          onTap: () => toasts.info("Opened the line"),
        })}>Show</lc-button>
      `,
    },
    {
      title: "Different positions",
      render: () => html`
        <lc-toast position="top-left"></lc-toast>
        <lc-toast position="top-center"></lc-toast>
        <lc-toast position="top-right"></lc-toast>
        <lc-toast position="bottom-left"></lc-toast>
        <lc-toast position="bottom-center"></lc-toast>
        <lc-toast position="bottom-right"></lc-toast>
      `,
    },
  ],
};
