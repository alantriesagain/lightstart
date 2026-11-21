import { defineApp } from "@lightstart/app";

export default defineApp({ name: "fixture-web-js", title: "Fixture Web", host: "web", url: "https://fixture.example", transitions: true, stores: { main: { kind: "memory" } } });
