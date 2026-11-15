@import "../node_modules/@lightstart/light/theme/theme.css";
@import "../node_modules/@lightstart/components/display/icon.css";
@import "../node_modules/@lightstart/components/display/link.css";
@import "../node_modules/@lightstart/components/display/button.css";
@import "../node_modules/@lightstart/components/display/text.css";
@import "../node_modules/@lightstart/components/layout/card.css";

body {
  margin: 0;
  padding: var(--spacing-lg, 1.5rem);
  background: var(--canvas-background);
  color: var(--text-color);
}

.page {
  max-width: 36rem;
  margin: 0 auto;
  display: grid;
  gap: var(--spacing-lg, 1.5rem);
}
