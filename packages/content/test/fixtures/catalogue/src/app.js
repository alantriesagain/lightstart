import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "catalogue",
  host: "web",
  stores: {
    main: { adapter: "memory" },
    catalogue: { adapter: "content" },
  },
});
