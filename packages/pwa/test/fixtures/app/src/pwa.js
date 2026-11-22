import { definePwa } from "@lightstart/pwa";

export default definePwa({
  short_name: "PWA",
  description: "A PWA fixture",
  theme_color: "#123456",
  icons: [{ src: "/icon.svg", sizes: "192x192", type: "image/svg+xml" }],
});
