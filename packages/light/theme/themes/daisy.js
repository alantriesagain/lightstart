/**
 * Daisy
 * Pill selectors, a soft depth under buttons, base surfaces in three steps
 */
const base = {
  100: "#ffffff",
  200: "#f2f2f2",
  300: "#e5e6e6",
  content: "#1f2937",
};

export default {
  font: {
    family: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    heading: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    google: [],
    handwriting: '"Caveat", cursive',
    icon: { family: "lucide" },
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "800",
  },

  link: { color: "#491eff" },

  text: {
    color: base.content,
    secondary: "#4b5563",
    muted: "#6b7280",
    disabled: "#9ca3af",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.5rem",
    hero: "clamp(2.25rem, 5vw, 3.5rem)",
    section: "clamp(1.75rem, 3.5vw, 2.5rem)",
    subhead: "1.0625rem",
    body: "0.9375rem",
    caption: "0.8125rem",
    eyebrow: "0.6875rem",
  },

  canvas: { background: base[100] },

  color: {
    primary: "#491eff",
    secondary: "#ff41b4",
    accent: "#00cfbd",
    success: "#00a96e",
    danger: "#ff5861",
    warning: "#ffbe00",
    info: "#00b6ff",
    surface: base[100],
    "surface-light": base[100],
    "surface-dark": base[200],
    "surface-darker": base[300],
    "surface-inverse": "#2b3440",
    hover: base[200],
    focus: "#491eff",
    inverse: "#2b3440",
    "on-primary": "#ffffff",
    "on-secondary": "#ffffff",
    "on-accent": "#07312d",
    "on-success": "#003320",
    "on-warning": "#382800",
    "on-danger": "#4d0002",
  },

  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
    "3xl": "3rem",
    "4xl": "5rem",
  },

  leading: { tight: "1.2", normal: "1.5", relaxed: "1.75" },

  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
    field: "0.5rem",
    selector: "9999px",
    box: "1rem",
    card: "1rem",
    panel: "1rem",
    hero: "1.5rem",
  },

  shadow: {
    none: "none",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    field: "0 3px 0 -1px rgb(0 0 0 / 0.12), 0 1px 2px 0 rgb(0 0 0 / 0.08)",
    box: "none",
    focus: "0 0 0 2px var(--color-surface, #fff), 0 0 0 4px var(--color-focus, #491eff)",
    card: "none",
    "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    nav: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },

  border: { width: "1px", color: "rgba(31, 41, 55, 0.2)" },

  motion: { lift: "0 0", press: "0 1px" },

  control: { weight: "600", transform: "none", tracking: "normal" },

  lc: {
    input: { shadow: "none" },
    checkbox: {
      "border-color": "rgba(31, 41, 55, 0.2)",
      "checked-background-color": "#491eff",
      "border-radius": "0.25rem",
    },
    card: { "border-color": "rgba(31, 41, 55, 0.12)" },
    modal: { shadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)" },
    textarea: {
      shadow: "none",
    },
  },

  dark: {
    link: { color: "#7b92ff" },
    text: { color: "#e8eaed", secondary: "#c2c7cf", muted: "#9aa1ab", disabled: "#6b7280" },
    canvas: { background: "#1d232a" },
    color: {
      primary: "#7b92ff",
      surface: "#1d232a",
      "surface-light": "#1d232a",
      "surface-dark": "#191e24",
      "surface-darker": "#15191e",
      "surface-inverse": "#e8eaed",
      hover: "#191e24",
      inverse: "#e8eaed",
      "on-primary": "#12182b",
    },
    border: { color: "rgba(232, 234, 237, 0.2)" },
    lc: {
      checkbox: { "border-color": "rgba(232, 234, 237, 0.2)" },
      card: { "border-color": "rgba(232, 234, 237, 0.12)" },
    },
  },
};
