/**
 * Neobrutalist
 * Thick black borders, hard offset shadows, uppercase controls
 */
const ink = "#1a1a1a";
const edge = "#000000";
/** @param {number} offset */
const hard = (offset) => `${offset}px ${offset}px 0px 0px ${edge}`;

export default {
  font: {
    family: "Manrope",
    heading: "Manrope",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    google: ["Manrope"],
    handwriting: '"Caveat", cursive',
    icon: { family: "lucide" },
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "900",
  },

  link: { color: ink },

  text: {
    color: ink,
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
    hero: "clamp(2.5rem, 6vw, 4rem)",
    section: "clamp(2rem, 4vw, 2.75rem)",
    subhead: "1.05rem",
    body: "0.9375rem",
    caption: "0.8125rem",
    eyebrow: "0.6875rem",
  },

  canvas: { background: "#faf5f0" },

  color: {
    primary: "#fabd2f",
    secondary: "#ec4899",
    accent: "#fabd2f",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f97316",
    info: "#3b82f6",
    surface: "#ffffff",
    "surface-light": "#faf5f0",
    "surface-dark": "#f5f0eb",
    "surface-inverse": ink,
    hover: "#f5f0eb",
    focus: edge,
    inverse: ink,
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
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
    field: "0.75rem",
    selector: "0.375rem",
    box: "1rem",
    card: "0.75rem",
    panel: "1rem",
    hero: "1.5rem",
  },

  shadow: {
    none: "none",
    sm: hard(2),
    md: hard(4),
    lg: hard(6),
    xl: hard(8),
    "2xl": hard(12),
    field: hard(4),
    box: hard(6),
    focus: hard(6),
    card: hard(4),
    "card-hover": hard(6),
    nav: hard(4),
  },

  border: { width: "3px", color: edge },

  motion: { lift: "-2px -2px", press: "2px 2px" },

  control: { weight: "900", transform: "uppercase", tracking: "0.05em" },

  lc: {
    button: {
      "border-color": edge,
      "hover-shadow": hard(2),
      "active-shadow": "none",
      "primary-color": ink,
      "warning-color": ink,
      "success-color": ink,
    },
    checkbox: {
      "border-color": edge,
      "checked-border-color": edge,
    },
    input: { "border-color": edge, "focus-border-color": edge },
    label: { "font-weight": "700" },
    table: { "header-font-weight": "900" },
  },

  dark: {
    link: { color: "#f5f0eb" },
    text: { color: "#f5f0eb", secondary: "#d1d5db", muted: "#9ca3af" },
    canvas: { background: "#1a1a1a" },
    color: {
      surface: "#262626",
      "surface-light": "#303030",
      "surface-dark": "#1f1f1f",
      "surface-inverse": "#f5f0eb",
      hover: "#303030",
      focus: "#f5f0eb",
      inverse: "#f5f0eb",
    },
    border: { color: "#f5f0eb" },
    shadow: {
      sm: "2px 2px 0px 0px #f5f0eb",
      md: "4px 4px 0px 0px #f5f0eb",
      lg: "6px 6px 0px 0px #f5f0eb",
      xl: "8px 8px 0px 0px #f5f0eb",
      "2xl": "12px 12px 0px 0px #f5f0eb",
      field: "4px 4px 0px 0px #f5f0eb",
      box: "6px 6px 0px 0px #f5f0eb",
      focus: "6px 6px 0px 0px #f5f0eb",
      card: "4px 4px 0px 0px #f5f0eb",
      "card-hover": "6px 6px 0px 0px #f5f0eb",
      nav: "4px 4px 0px 0px #f5f0eb",
    },
    lc: {
      button: { "border-color": "#f5f0eb", "hover-shadow": "2px 2px 0px 0px #f5f0eb" },
      checkbox: { "border-color": "#f5f0eb", "checked-border-color": "#f5f0eb" },
      input: { "border-color": "#f5f0eb", "focus-border-color": "#f5f0eb" },
    },
  },
};
