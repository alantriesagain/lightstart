import { defineApp } from "@lightstart/app";

export default defineApp({ name: "fixture-locale", title: "Fixture Locale", host: "web", url: "https://fixture.example", locale: "en", locales: ["en", "pt", "es"], stores: { main: { adapter: "memory" } } });
