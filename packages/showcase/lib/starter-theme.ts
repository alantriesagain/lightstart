/**
 * The theme the editor and the generator start from when the page has none
 * applied: every token group a theme names, with the values of the gruvbox
 * palette, so a reader edits something rather than a blank form.
 */

type ThemeTokenMap = Record<string, Record<string, string>>;

export const STARTER_THEME: ThemeTokenMap = {
  text: { color: "#ebdbb2", xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem" },
  font: { family: "", heading: "", normal: "400", medium: "500", semibold: "600", bold: "700" },
  leading: { tight: "1.2", normal: "1.5", relaxed: "1.75" },
  color: {
    primary: "#fabd2f", secondary: "#83a598", success: "#b8bb26",
    danger: "#fb4934", warning: "#fe8019", info: "#83a598",
    surface: "#504945", inverse: "#282828",
  },
  spacing: { xs: "0.25rem", sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem", "2xl": "2rem", "3xl": "3rem" },
  radius: { none: "0", sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
  border: { width: "1px", color: "#e5e7eb" },
  shadow: {
    none: "none",
    sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  },
};
