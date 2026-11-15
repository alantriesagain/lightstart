@import "./light/theme/theme.css";
@import "./components/display/button.css";
@import "./components/display/text.css";
@import "./components/layout/card.css";
@import "./components/app/title-bar.css";

html,
body {
  height: 100%;
}

body {
  margin: 0;
  display: flex;
  flex-direction: column;
  font: 16px system-ui, sans-serif;
  background: var(--canvas-background, #f7f7fb);
  color: var(--text-color, #1a1a2e);
}

app-page {
  display: block;
  flex: 1;
  overflow: auto;
}

.page {
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--spacing-lg, 1.5rem);
  display: grid;
  gap: var(--spacing-lg, 1.5rem);
}

output {
  font-variant-numeric: tabular-nums;
}
