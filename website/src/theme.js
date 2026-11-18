/**
 * Default theme
 * The framework's own look: ink and one signal colour on cool grey, hairline
 * edges, the platform's own type
 */
const fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default {
  font: {
    family: fontFamily,
    heading: fontFamily,
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    google: [],
    handwriting: "'Caveat', cursive",
    icon: { family: "lucide" },
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "800",
  },

  link: { color: "#c2410c" },

  text: {
    color: "#101210",
    secondary: "#3f443f",
    muted: "#6b716b",
    disabled: "#a3a8a3",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.5rem",
    display: "clamp(3.5rem, 7vw, 5rem)",
    hero: "clamp(2.25rem, 5vw, 3.5rem)",
    section: "clamp(1.75rem, 3.5vw, 2.5rem)",
    subhead: "1.0625rem",
    body: "0.9375rem",
    caption: "0.8125rem",
    eyebrow: "0.6875rem",
  },

  canvas: { background: "#f3f4f2", "font-size": "16px" },

  color: {
    primary: "#101210",
    "primary-light": "#2a2e2a",
    "primary-dark": "#000000",
    accent: "#e4572e",
    secondary: "#e4572e",
    "secondary-light": "#ff6a3d",
    "secondary-dark": "#c2410c",
    success: "#15803d",
    "success-light": "#22c55e",
    "success-dark": "#166534",
    danger: "#dc2626",
    "danger-light": "#ef4444",
    "danger-dark": "#b91c1c",
    warning: "#d97706",
    "warning-light": "#f59e0b",
    info: "#1d4ed8",
    "info-light": "#3b82f6",
    surface: "#ffffff",
    "surface-light": "#f8f9f7",
    "surface-dark": "#e8eae6",
    "surface-inverse": "#101210",
    hover: "#eceeea",
    focus: "#e4572e",
    inverse: "#ffffff",
    "inverse-dark": "#101210",
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

  leading: {
    tight: "1.1",
    normal: "1.5",
    relaxed: "1.75",
  },

  radius: {
    none: "0",
    sm: "0.125rem",
    md: "0.25rem",
    lg: "0.375rem",
    xl: "0.5rem",
    card: "0.25rem",
    panel: "0.375rem",
    hero: "0.5rem",
    full: "9999px",
    field: "0.125rem",
    selector: "0.125rem",
    box: "0.25rem",
  },

  shadow: {
    none: "none",
    sm: "none",
    md: "0 8px 24px rgba(16, 18, 16, 0.14)",
    lg: "0 16px 40px rgba(16, 18, 16, 0.18)",
    xl: "0 24px 56px rgba(16, 18, 16, 0.2)",
    "2xl": "0 32px 72px rgba(16, 18, 16, 0.24)",
    card: "none",
    "card-hover": "0 8px 24px rgba(16, 18, 16, 0.14)",
    nav: "none",
    field: "none",
    box: "none",
    focus: "0 0 0 2px #e4572e",
  },

  control: {
    weight: "600",
    transform: "none",
    tracking: "normal",
  },

  border: {
    width: "1px",
    color: "#d2d5d0",
  },

  lc: {
    button: {
      background: "#ffffff",
      "border-color": "#c9cdc8",
      "default-hover-background": "#f0f2ef",
    },
  },

  dark: {
    link: { color: "#ff6a3d" },

    text: {
      color: "#e9ebe8",
      secondary: "#b3b8b2",
      muted: "#7f857e",
      disabled: "#555a54",
    },

    canvas: { background: "#0f110f" },

    color: {
      primary: "#e9ebe8",
      "primary-light": "#ffffff",
      "primary-dark": "#cfd2ce",
      secondary: "#ff6a3d",
      "secondary-light": "#ff8a5b",
      "secondary-dark": "#e4572e",
      surface: "#171a17",
      "surface-light": "#1d201d",
      "surface-dark": "#131513",
      "surface-inverse": "#e9ebe8",
      hover: "#222522",
      focus: "#ff6a3d",
      inverse: "#0f110f",
      "inverse-dark": "#e9ebe8",
    },

    shadow: {
      md: "0 8px 24px rgba(0, 0, 0, 0.6)",
      lg: "0 16px 40px rgba(0, 0, 0, 0.65)",
      "card-hover": "0 8px 24px rgba(0, 0, 0, 0.6)",
      focus: "0 0 0 2px #ff6a3d",
    },

    border: { color: "#2c302c" },

    lc: {
      button: {
        background: "#1d201d",
        "border-color": "#363a36",
        "default-hover-background": "#262926",
      },
    },
  },
};
