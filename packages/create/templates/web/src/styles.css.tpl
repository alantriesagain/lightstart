@import "../node_modules/@lightstart/light/theme/theme.css";
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

.add {
  display: flex;
  gap: var(--spacing-sm, 0.5rem);
}

.add input {
  flex: 1;
  padding: var(--spacing-sm, 0.5rem);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--color-surface, transparent);
  color: var(--text-color);
}
