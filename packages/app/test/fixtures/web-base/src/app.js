import { defineApp } from "@lightstart/app";

export default defineApp({ name: "fixture-base", title: "Fixture Base", host: "web", url: "https://user.github.io/budget", stores: { main: { adapter: "memory" } } });
