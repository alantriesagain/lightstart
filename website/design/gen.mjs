import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const OUT = new URL("./frames/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const MANIFEST = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).bootstrapp.components.lc;
const COMPONENTS = Object.entries(MANIFEST).reduce((acc, [name, file]) => { (acc[file.split("/").at(-2)] ??= []).push(name); return acc; }, {});
const TOTAL = Object.keys(MANIFEST).length;
const humanize = (name) => name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const LIGHT = { canvas: "#f6f4ef", surface: "#ffffff", surfaceLight: "#f9fafb", surfaceDark: "#eef0f2", hover: "#f3f4f6", border: "#e2e8f0",
  text: "#1a1a1a", secondary: "#454e5c", muted: "#64748b", disabled: "#9ca3af", primary: "#0f766e", primaryLight: "#2dd4bf", primaryDark: "#115e59",
  focus: "#14b8a6", link: "#0f766e", btnBg: "#ffffff", btnBorder: "#d6d3cb", btnHover: "#f3f1ec", inverse: "#ffffff",
  shadowSm: "0 1px 2px rgba(0, 0, 0, 0.06)", shadowMd: "0 2px 8px rgba(0, 0, 0, 0.08)", shadowField: "0 1px 2px rgba(26, 26, 26, 0.06)",
  tokTag: "#0f766e", tokAttr: "#b45309", tokStr: "#1d4ed8", codeBg: "#f9fafb" };
const DARK = { canvas: "#151813", surface: "#1e221c", surfaceLight: "#242822", surfaceDark: "#181b16", hover: "#262a24", border: "#32362f",
  text: "#ece9e2", secondary: "#b8bdb2", muted: "#8b9086", disabled: "#5c6157", primary: "#2dd4bf", primaryLight: "#5eead4", primaryDark: "#14b8a6",
  focus: "#2dd4bf", link: "#5eead4", btnBg: "#242822", btnBorder: "#3a3f37", btnHover: "#2c3129", inverse: "#151813",
  shadowSm: "0 1px 2px rgba(0, 0, 0, 0.4)", shadowMd: "0 2px 8px rgba(0, 0, 0, 0.5)", shadowField: "0 1px 2px rgba(0, 0, 0, 0.4)",
  tokTag: "#2dd4bf", tokAttr: "#fbbf24", tokStr: "#93c5fd", codeBg: "#181b16" };

const LOOKS = {
  current: { name: "Current", fontUI: "'Manrope', system-ui, -apple-system, sans-serif", fontDisplay: "'Manrope', system-ui, sans-serif", fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    google: "family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700", rField: "8px", rSelector: "8px", rBox: "8px", displayWeight: "800", displayTracking: "-0.025em", displayScale: "1", controlWeight: "600",
    light: {}, dark: {}, stage: {} },
  editorial: { name: "Editorial", fontUI: "'IBM Plex Sans', system-ui, sans-serif", fontDisplay: "'Fraunces', Georgia, serif", fontMono: "'IBM Plex Mono', ui-monospace, monospace",
    google: "family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500", rField: "4px", rSelector: "3px", rBox: "6px", displayWeight: "600", displayTracking: "-0.015em", displayScale: "1", controlWeight: "500",
    light: { canvas: "#f6f3ec", surface: "#fffdf8", surfaceLight: "#faf8f2", surfaceDark: "#ece8de", hover: "#f0ece3", border: "#d8d2c4", text: "#1c1a16", secondary: "#4b463d", muted: "#7a7368", disabled: "#a8a196", primary: "#1f5a3c", primaryLight: "#2f7d55", primaryDark: "#163f2a", focus: "#2f7d55", link: "#1f5a3c", btnBg: "#fffdf8", btnBorder: "#c9c2b2", btnHover: "#f3efe6", inverse: "#fffdf8", shadowSm: "none", shadowMd: "0 8px 24px rgba(28, 26, 22, 0.12)", shadowField: "none", codeBg: "#f3efe6", tokTag: "#1f5a3c", tokAttr: "#b45309", tokStr: "#1d4ed8" },
    dark: { canvas: "#171512", surface: "#1f1c18", surfaceLight: "#26231e", surfaceDark: "#1a1814", hover: "#2a2722", border: "#36322b", text: "#ece6d9", secondary: "#b9b2a4", muted: "#8b8477", disabled: "#5e584e", primary: "#6fbf94", primaryLight: "#8fd6ae", primaryDark: "#4fa377", focus: "#6fbf94", link: "#8fd6ae", btnBg: "#26231e", btnBorder: "#3f3a32", btnHover: "#2f2b25", inverse: "#171512", shadowSm: "none", shadowMd: "0 8px 24px rgba(0, 0, 0, 0.5)", shadowField: "none", codeBg: "#1a1814", tokTag: "#6fbf94", tokAttr: "#f0b35b", tokStr: "#93c5fd" },
    stage: { primary: "#1f5a3c", onPrimary: "#fffdf8", secondary: "#b45309", onSecondary: "#fffdf8", success: "#2f7d55", danger: "#b91c1c", surface: "#fffdf8", canvas: "#f6f3ec", surfaceDark: "#ece8de", text: "#1c1a16", muted: "#7a7368", border: "#d8d2c4", btnBorder: "#c9c2b2", shField: "none",
      dark: { primary: "#6fbf94", onPrimary: "#171512", surface: "#1f1c18", canvas: "#171512", surfaceDark: "#1a1814", text: "#ece6d9", muted: "#8b8477", border: "#36322b", btnBorder: "#3f3a32" } } },
  signal: { name: "Signal", fontUI: "'Onest', system-ui, sans-serif", fontDisplay: "'Bricolage Grotesque', system-ui, sans-serif", fontMono: "'JetBrains Mono', ui-monospace, monospace",
    google: "family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Onest:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500", rField: "2px", rSelector: "2px", rBox: "4px", displayWeight: "800", displayTracking: "-0.03em", displayScale: "1.02", controlWeight: "600",
    light: { canvas: "#f3f4f2", surface: "#ffffff", surfaceLight: "#f8f9f7", surfaceDark: "#e8eae6", hover: "#eceeea", border: "#d2d5d0", text: "#101210", secondary: "#3f443f", muted: "#6b716b", disabled: "#a3a8a3", primary: "#101210", primaryLight: "#2a2e2a", primaryDark: "#000000", focus: "#e4572e", link: "#c2410c", btnBg: "#ffffff", btnBorder: "#c9cdc8", btnHover: "#f0f2ef", inverse: "#ffffff", shadowSm: "none", shadowMd: "0 8px 24px rgba(16, 18, 16, 0.14)", shadowField: "none", codeBg: "#f8f9f7", tokTag: "#c2410c", tokAttr: "#1d4ed8", tokStr: "#15803d" },
    dark: { canvas: "#0f110f", surface: "#171a17", surfaceLight: "#1d201d", surfaceDark: "#131513", hover: "#222522", border: "#2c302c", text: "#e9ebe8", secondary: "#b3b8b2", muted: "#7f857e", disabled: "#555a54", primary: "#e9ebe8", primaryLight: "#ffffff", primaryDark: "#cfd2ce", focus: "#ff6a3d", link: "#ff6a3d", btnBg: "#1d201d", btnBorder: "#363a36", btnHover: "#262926", inverse: "#0f110f", shadowSm: "none", shadowMd: "0 8px 24px rgba(0, 0, 0, 0.6)", shadowField: "none", codeBg: "#131513", tokTag: "#ff8a5b", tokAttr: "#8ab4ff", tokStr: "#7ad38f" },
    stage: { primary: "#101210", onPrimary: "#ffffff", secondary: "#e4572e", onSecondary: "#ffffff", success: "#15803d", danger: "#dc2626", surface: "#ffffff", canvas: "#f3f4f2", surfaceDark: "#e8eae6", text: "#101210", muted: "#6b716b", border: "#d2d5d0", btnBorder: "#c9cdc8", shField: "none",
      dark: { primary: "#e9ebe8", onPrimary: "#0f110f", surface: "#171a17", canvas: "#0f110f", surfaceDark: "#131513", text: "#e9ebe8", muted: "#7f857e", border: "#2c302c", btnBorder: "#363a36" } } },
  native: { name: "Native", fontUI: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontDisplay: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    google: "family=Manrope:wght@400", rField: "10px", rSelector: "6px", rBox: "12px", displayWeight: "700", displayTracking: "-0.02em", displayScale: "1", controlWeight: "600",
    light: { canvas: "#f2f2f5", surface: "#ffffff", surfaceLight: "#f7f7f9", surfaceDark: "#e6e6eb", hover: "#ebebf0", border: "#d9d9e0", text: "#1c1c1e", secondary: "#48484c", muted: "#7c7c85", disabled: "#aeaeb5", primary: "#0f4c81", primaryLight: "#2f6ea8", primaryDark: "#0a355c", focus: "#2f6ea8", link: "#0f4c81", btnBg: "#ffffff", btnBorder: "#cfcfd6", btnHover: "#f2f2f5", inverse: "#ffffff", shadowSm: "none", shadowMd: "0 10px 30px rgba(28, 28, 30, 0.14)", shadowField: "none", codeBg: "#f7f7f9", tokTag: "#0f4c81", tokAttr: "#b45309", tokStr: "#15803d" },
    dark: { canvas: "#0c0c0e", surface: "#161618", surfaceLight: "#1c1c1f", surfaceDark: "#111113", hover: "#222226", border: "#2a2a2e", text: "#f2f2f2", secondary: "#b8b8bf", muted: "#8e8e93", disabled: "#5c5c63", primary: "#6ea8ff", primaryLight: "#8fbdff", primaryDark: "#4d8ff0", focus: "#6ea8ff", link: "#8fbdff", btnBg: "#1c1c1f", btnBorder: "#333338", btnHover: "#262629", inverse: "#0c0c0e", shadowSm: "none", shadowMd: "0 10px 30px rgba(0, 0, 0, 0.6)", shadowField: "none", codeBg: "#111113", tokTag: "#8fbdff", tokAttr: "#fbbf24", tokStr: "#86efac" },
    stage: { primary: "#0f4c81", onPrimary: "#ffffff", secondary: "#d97706", onSecondary: "#1c1c1e", success: "#15803d", danger: "#dc2626", surface: "#ffffff", canvas: "#f2f2f5", surfaceDark: "#e6e6eb", text: "#1c1c1e", muted: "#7c7c85", border: "#d9d9e0", btnBorder: "#cfcfd6", shField: "none",
      dark: { primary: "#6ea8ff", onPrimary: "#0c0c0e", surface: "#161618", canvas: "#0c0c0e", surfaceDark: "#111113", text: "#f2f2f2", muted: "#8e8e93", border: "#2a2a2e", btnBorder: "#333338" } } },
  marigold: { name: "Ink & Marigold", fontUI: "'Instrument Sans', system-ui, sans-serif", fontDisplay: "'Instrument Serif', Georgia, serif", fontMono: "'JetBrains Mono', ui-monospace, monospace",
    google: "family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500", rField: "6px", rSelector: "9999px", rBox: "10px", displayWeight: "400", displayTracking: "-0.01em", displayScale: "1.18", controlWeight: "600",
    light: { canvas: "#f5f2ea", surface: "#fffcf5", surfaceLight: "#faf7f0", surfaceDark: "#ebe6da", hover: "#f0ebe0", border: "#dcd5c6", text: "#1b1813", secondary: "#4d473d", muted: "#7b7466", disabled: "#aaa396", primary: "#1b1813", primaryLight: "#33302a", primaryDark: "#000000", focus: "#e0a526", link: "#9a6b12", btnBg: "#fffcf5", btnBorder: "#cdc6b6", btnHover: "#f2ede2", inverse: "#fffcf5", shadowSm: "0 1px 0 rgba(27, 24, 19, 0.08)", shadowMd: "0 8px 24px rgba(27, 24, 19, 0.14)", shadowField: "0 1px 0 rgba(27, 24, 19, 0.08)", codeBg: "#f3efe4", tokTag: "#9a6b12", tokAttr: "#1f5a3c", tokStr: "#1d4ed8" },
    dark: { canvas: "#151311", surface: "#1d1a16", surfaceLight: "#23201b", surfaceDark: "#181613", hover: "#29251f", border: "#363129", text: "#efe9dc", secondary: "#bdb5a5", muted: "#8d8577", disabled: "#5f5a50", primary: "#efe9dc", primaryLight: "#ffffff", primaryDark: "#d6cfbf", focus: "#e0a526", link: "#e0a526", btnBg: "#23201b", btnBorder: "#3d372e", btnHover: "#2c2823", inverse: "#151311", shadowSm: "0 1px 0 rgba(0, 0, 0, 0.4)", shadowMd: "0 8px 24px rgba(0, 0, 0, 0.55)", shadowField: "0 1px 0 rgba(0, 0, 0, 0.4)", codeBg: "#181613", tokTag: "#e0a526", tokAttr: "#8fd6ae", tokStr: "#93c5fd" },
    stage: { primary: "#1b1813", onPrimary: "#fffcf5", secondary: "#e0a526", onSecondary: "#1b1813", success: "#2f7d55", danger: "#c2410c", surface: "#fffcf5", canvas: "#f5f2ea", surfaceDark: "#ebe6da", text: "#1b1813", muted: "#7b7466", border: "#dcd5c6", btnBorder: "#cdc6b6", shField: "0 1px 0 rgba(27, 24, 19, 0.08)",
      dark: { primary: "#efe9dc", onPrimary: "#151311", surface: "#1d1a16", canvas: "#151311", surfaceDark: "#181613", text: "#efe9dc", muted: "#8d8577", border: "#363129", btnBorder: "#3d372e" } } },
};
LOOKS.chosen = { ...LOOKS.signal, name: "Signal, system fonts", fontUI: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontDisplay: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", google: "family=Inter:wght@400;500;600;700", displayWeight: "800", displayTracking: "-0.03em", displayScale: "1" };
const LOOK = LOOKS.chosen;
const chrome = (dark) => ({ ...(dark ? DARK : LIGHT), ...(dark ? LOOK.dark : LOOK.light), dark });

const SKINS = {
  default: { label: "Default", font: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", primary: "#0f766e", onPrimary: "#ffffff", secondary: "#f97316", success: "#22c55e", danger: "#ef4444",
    surface: "#ffffff", canvas: "#f6f4ef", surfaceDark: "#eef0f2", text: "#1a1a1a", muted: "#64748b", border: "#e2e8f0", borderW: "1px", btnBorder: "#d6d3cb",
    rField: "8px", rSelector: "8px", rBox: "8px", shField: "0 1px 2px rgba(26, 26, 26, 0.06)", shBox: "none", weight: "600", transform: "none", tracking: "0",
    dark: { surface: "#1e221c", canvas: "#151813", surfaceDark: "#181b16", text: "#ece9e2", muted: "#8b9086", border: "#32362f", primary: "#2dd4bf", onPrimary: "#151813", btnBorder: "#3a3f37" },
    roles: ["radius.field  0.125rem", "shadow.field  none", "control.weight  600", "border.width  1px"] },
  neobrutalist: { label: "Neobrutalist", font: "'Manrope', system-ui, sans-serif", primary: "#fabd2f", onPrimary: "#1a1a1a", secondary: "#ec4899", success: "#22c55e", danger: "#ef4444",
    surface: "#ffffff", canvas: "#faf5f0", surfaceDark: "#f5f0eb", text: "#1a1a1a", muted: "#6b7280", border: "#000000", borderW: "3px", btnBorder: "#000000",
    rField: "12px", rSelector: "6px", rBox: "16px", shField: "4px 4px 0px 0px #000000", shBox: "6px 6px 0px 0px #000000", weight: "900", transform: "uppercase", tracking: "0.05em",
    roles: ["border.width  3px", "shadow.field  4px 4px 0 0 #000", "shadow.box  6px 6px 0 0 #000", "control.weight  900", "control.transform  uppercase", "motion.press  2px 2px"] },
  "gruvbox-dark": { label: "Gruvbox Dark", font: "'Manrope', system-ui, sans-serif", primary: "#fabd2f", onPrimary: "#282828", secondary: "#83a598", onSecondary: "#282828", success: "#b8bb26", danger: "#fb4934",
    surface: "#3c3836", canvas: "#282828", surfaceDark: "#32302f", text: "#ebdbb2", muted: "#a89984", border: "#504945", borderW: "1px", btnBorder: "#504945",
    rField: "4px", rSelector: "4px", rBox: "6px", shField: "none", shBox: "none", weight: "600", transform: "none", tracking: "0",
    roles: ["radius.field  0.25rem", "shadow.field  none", "control.weight  600", "font.family  Manrope"] },
  daisy: { label: "Daisy", font: "system-ui, -apple-system, 'Segoe UI', sans-serif", primary: "#491eff", onPrimary: "#ffffff", secondary: "#ff41b4", success: "#00a96e", danger: "#ff5861",
    surface: "#ffffff", canvas: "#ffffff", surfaceDark: "#f2f2f2", text: "#1f2937", muted: "#6b7280", border: "rgba(31, 41, 55, 0.2)", borderW: "1px", btnBorder: "rgba(31, 41, 55, 0.2)",
    rField: "8px", rSelector: "9999px", rBox: "16px", shField: "0 3px 0 -1px rgba(0, 0, 0, 0.12), 0 1px 2px 0 rgba(0, 0, 0, 0.08)", shBox: "none", weight: "600", transform: "none", tracking: "0",
    roles: ["radius.selector  9999px", "radius.box  1rem", "shadow.field  0 3px 0 -1px rgba(0,0,0,.12)", "motion.press  0 1px", "control.weight  600"] },
};

const CAT_META = [
  ["form", "Form", "list-checks", "Controls that collect a value, and the form that draws them from a field list"],
  ["display", "Display", "eye", "Text, media, charts and tables: the components that show what the app knows"],
  ["layout", "Layout", "layout-grid", "Cards, grids and panes that arrange a screen"],
  ["navigation", "Navigation", "compass", "Menus, tabs, trees and breadcrumbs: how a reader moves between places"],
  ["overlay", "Overlay", "layers", "Modals, drawers, sheets and popovers, stacked and dismissed by one controller"],
  ["feedback", "Feedback", "loader", "What the app says while it works, succeeds, or has nothing to show"],
  ["app", "App shell", "smartphone", "The frame around a screen: headers, bottom navigation, scrollers and decks"],
  ["page", "Page sections", "file-text", "Marketing blocks a landing page is assembled from"],
  ["utility", "Utility", "pen-tool", "Dark mode, drag and drop, device facts and other behaviour without chrome"],
];
const CATS = CAT_META.map(([id, label, icon, desc]) => [id, label, icon, (COMPONENTS[id] ?? []).length, desc, (COMPONENTS[id] ?? []).sort().map(humanize)]);

const PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>', "chevron-right": '<path d="m9 18 6-6-6-6"/>', "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  "list-checks": '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.4-6.4 2.1 2.1-6.4z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  loader: '<path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9"/>',
  "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  "pen-tool": '<path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  "corner-down-left": '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.6-10-8.6z"/>',
  "toggle-right": '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="2"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2M8.5 2h7M7 16h10"/>',
};
const ic = (name, size = 16, extra = "") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;${extra}">${PATHS[name]}</svg>`;

const css = (c, phone = false) => `
body{margin:0;font-family:${LOOK.fontUI};background:${c.canvas};color:${c.text};-webkit-font-smoothing:antialiased;font-size:${phone ? 20 : 16}px}
a{color:${c.link};text-decoration:none}a:hover{color:${c.primaryDark}}
*,*::before,*::after{box-sizing:border-box}
.mono{font-family:${LOOK.fontMono}}
.eyebrow{font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${c.muted}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;height:2.25rem;padding:0 .875rem;border-radius:var(--r-field);border:1px solid ${c.btnBorder};background:${c.btnBg};color:${c.text};font:inherit;font-size:.875rem;font-weight:600;cursor:pointer;box-shadow:${c.shadowField};white-space:nowrap}
.btn.xs{height:1.75rem;padding:0 .5rem;font-size:.8125rem;gap:.375rem}
.btn.icon{width:2.25rem;padding:0}.btn.icon.xs{width:1.75rem}
.btn.primary{background:${c.primary};border-color:${c.primary};color:${c.inverse}}
.btn.ghost{background:transparent;border-color:transparent;box-shadow:none;color:${c.secondary}}
.btn:disabled{opacity:.5;cursor:not-allowed}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:1.375rem;height:1.375rem;padding:0 .375rem;border-radius:var(--r-selector);border:1px solid ${c.border};background:${c.surfaceLight};color:${c.muted};font-family:${LOOK.fontMono};font-size:.6875rem;font-weight:600;box-shadow:${c.shadowSm}}
.seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--r-field);background:${c.surfaceDark}}
.seg button{display:inline-flex;align-items:center;gap:.375rem;height:1.75rem;padding:0 .625rem;border:0;border-radius:calc(var(--r-field) - 2px);background:transparent;color:${c.secondary};font:inherit;font-size:.8125rem;font-weight:600;cursor:pointer}
.seg button[aria-pressed="true"]{background:${c.surface};color:${c.text};box-shadow:${c.shadowSm}}
.seg.dark button[aria-pressed="true"]{background:${c.text};color:${c.canvas}}
.seg button.icon{width:1.75rem;padding:0;justify-content:center}
.card{background:${c.surface};border:1px solid ${c.border};border-radius:var(--r-box)}
.nav-group{display:flex;flex-direction:column;gap:2px}
.nav-head{display:flex;align-items:center;gap:.5rem;height:2rem;padding:0 .75rem;border:0;background:transparent;color:${c.muted};font:inherit;cursor:pointer;width:100%;text-align:left}
.nav-head .count{margin-left:auto;font-size:.75rem;font-weight:600;color:${c.disabled}}
.nav-item{display:flex;align-items:center;height:2rem;padding:0 .75rem 0 2.25rem;border-radius:var(--r-field);color:${c.secondary};font-size:.875rem;font-weight:500}
.nav-item:hover{background:${c.hover};color:${c.text}}
.nav-item.active{background:color-mix(in srgb, ${c.primary} 12%, transparent);color:${c.primary};font-weight:700}
.nav-more{display:inline-flex;align-items:center;height:1.75rem;padding:0 .75rem 0 2.25rem;color:${c.muted};font-size:.8125rem;font-weight:600;background:transparent;border:0;font-family:inherit;cursor:pointer}
.toc a{display:block;padding:.25rem 0 .25rem .75rem;border-left:2px solid transparent;color:${c.muted};font-size:.8125rem;font-weight:500}
.toc a.sub{padding-left:1.5rem}.toc a.on{border-left-color:${c.primary};color:${c.text};font-weight:700}
.crumbs{display:flex;align-items:center;gap:.5rem;font-size:.8125rem;color:${c.muted}}.crumbs b{color:${c.text};font-weight:600}
.code{background:${c.codeBg};font-family:${LOOK.fontMono};font-size:.8125rem;line-height:1.6;color:${c.text}}
.tk-tag{color:${c.tokTag}}.tk-attr{color:${c.tokAttr}}.tk-str{color:${c.tokStr}}.tk-p{color:${c.muted}}.tk-kw{color:${c.tokTag};font-weight:600}
.ln{display:inline-block;width:2rem;color:${c.disabled};text-align:right;margin-right:1rem;user-select:none}
.stage{position:relative;padding:1.5rem;background-color:var(--s-canvas);background-image:radial-gradient(var(--s-dot) 1px, transparent 1px);background-size:18px 18px;font-family:var(--s-font);color:var(--s-text)}
.st-btn{display:inline-flex;align-items:center;justify-content:center;height:2.25rem;padding:0 1rem;border-radius:var(--s-rfield);border:var(--s-bw) solid var(--s-btn-border);background:var(--s-surface);color:var(--s-text);font:inherit;font-size:.875rem;font-weight:var(--s-weight);text-transform:var(--s-transform);letter-spacing:var(--s-tracking);box-shadow:var(--s-shfield);cursor:pointer;white-space:nowrap}
.st-btn.primary{background:var(--s-primary);border-color:var(--s-primary-border);color:var(--s-on-primary)}
.st-btn.secondary{background:var(--s-secondary);border-color:var(--s-secondary-border);color:var(--s-on-secondary)}
.st-btn.success{background:var(--s-success);border-color:var(--s-success-border);color:#fff}
.st-btn.danger{background:var(--s-danger);border-color:var(--s-danger-border);color:#fff}
.st-btn.outline{background:transparent;border-color:var(--s-primary);color:var(--s-primary)}
.st-btn.ghost{background:transparent;border-color:transparent;box-shadow:none}
.st-btn.disabled{opacity:.5}
.st-card{background:var(--s-surface);border:var(--s-bw) solid var(--s-border);border-radius:var(--s-rbox);box-shadow:var(--s-shbox)}
.st-input{display:flex;align-items:center;height:2.25rem;padding:0 .75rem;border-radius:var(--s-rfield);border:var(--s-bw) solid var(--s-border);background:var(--s-surface);color:var(--s-muted);font-size:.875rem;box-shadow:var(--s-shfield)}
.st-label{display:block;font-size:.8125rem;font-weight:var(--s-weight);text-transform:var(--s-transform);letter-spacing:var(--s-tracking);margin-bottom:.375rem}
.st-badge{display:inline-flex;align-items:center;height:1.375rem;padding:0 .5rem;border-radius:var(--s-rselector);font-size:.75rem;font-weight:var(--s-weight);text-transform:var(--s-transform);letter-spacing:var(--s-tracking);border:var(--s-bw) solid transparent}
.st-check{display:inline-flex;align-items:center;gap:.5rem;font-size:.875rem;font-weight:var(--s-weight);text-transform:var(--s-transform)}
.st-check i{display:inline-flex;align-items:center;justify-content:center;width:1.125rem;height:1.125rem;border-radius:var(--s-rselector);border:var(--s-bw) solid var(--s-border);background:var(--s-primary);color:var(--s-on-primary);box-shadow:var(--s-shfield)}
.st-switch{display:inline-flex;align-items:center;gap:.5rem;font-size:.875rem;font-weight:var(--s-weight);text-transform:var(--s-transform)}
.st-switch i{position:relative;display:inline-block;width:2.25rem;height:1.25rem;border-radius:9999px;background:var(--s-primary);border:var(--s-bw) solid var(--s-border);box-shadow:var(--s-shfield)}
.st-switch i::after{content:"";position:absolute;top:2px;right:2px;width:calc(1.25rem - 4px - 2 * var(--s-bw));height:calc(1.25rem - 4px - 2 * var(--s-bw));border-radius:9999px;background:#fff}
.st-stat b{display:block;font-size:1.75rem;font-weight:800;letter-spacing:-.02em;line-height:1}
.st-stat span{font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--s-muted)}
.st-progress{height:.5rem;border-radius:9999px;background:var(--s-surface-dark);border:var(--s-bw) solid var(--s-border);overflow:hidden}
.st-progress i{display:block;width:62%;height:100%;background:var(--s-primary)}
.gal{display:flex;flex-direction:column;overflow:hidden}
.gal .pv{display:flex;align-items:center;justify-content:center;height:100px;overflow:hidden}
.gal .nm{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .75rem;border-top:1px solid ${c.border};font-size:.875rem;font-weight:700}
.gal .nm code{font-size:.75rem;font-weight:500;color:${c.muted};font-family:${LOOK.fontMono}}
h1,h2,h3,p{margin:0}
h1,h2,h3{font-family:${LOOK.fontDisplay};font-weight:${LOOK.displayWeight};letter-spacing:${LOOK.displayTracking}}
:root{--r-field:${LOOK.rField};--r-box:${LOOK.rBox};--r-selector:${LOOK.rSelector};--display-scale:${LOOK.displayScale}}
`;

const skinVars = (name, dark = false) => {
  let s = SKINS[name];
  if (name === "default") s = { ...s, font: LOOK.fontUI, rField: LOOK.rField, rSelector: LOOK.rSelector, rBox: LOOK.rBox, weight: LOOK.controlWeight, ...LOOK.stage, dark: { ...s.dark, ...(LOOK.stage.dark ?? {}) } };
  const d = dark && s.dark ? { ...s, ...s.dark } : s;
  const dot = dark ? "rgba(255,255,255,0.12)" : (name === "neobrutalist" ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.12)");
  const border = (colour) => (name === "neobrutalist" ? "#000000" : colour);
  return `--s-font:${d.font};--s-primary:${d.primary};--s-on-primary:${d.onPrimary};--s-primary-border:${border(d.primary)};--s-secondary:${d.secondary};--s-on-secondary:${d.onSecondary ?? "#ffffff"};--s-secondary-border:${border(d.secondary)};--s-success:${d.success};--s-success-border:${border(d.success)};--s-danger:${d.danger};--s-danger-border:${border(d.danger)};--s-surface:${d.surface};--s-canvas:${d.canvas};--s-surface-dark:${d.surfaceDark};--s-text:${d.text};--s-muted:${d.muted};--s-border:${d.border};--s-bw:${d.borderW};--s-btn-border:${d.btnBorder};--s-rfield:${d.rField};--s-rselector:${d.rSelector};--s-rbox:${d.rBox};--s-shfield:${d.shField};--s-shbox:${d.shBox};--s-weight:${d.weight};--s-transform:${d.transform};--s-tracking:${d.tracking};--s-dot:${dot};`;
};

const brand = (c) => `<a href="Home.dc.html" style="display: flex; align-items: center; gap: 0.5rem; color: ${c.text};" aria-label="light home"><span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: ${c.primary}; color: ${c.inverse};">${ic("box", 14)}</span><b style="font-size: 1rem; font-weight: 800; letter-spacing: -0.01em;">light</b><span style="font-size: 0.75rem; color: ${c.muted};">0.1</span></a>`;

const PRESETS = [
  ["default", "Default", "Ink and one signal colour on cool grey, hairline edges", "#101210", "#e4572e"],
  ["neobrutalist", "Neobrutalist", "Thick black borders, hard offset shadows, uppercase controls", "#fabd2f", "#ec4899"],
  ["daisy", "Daisy", "Pill selectors, a soft depth under buttons", "#491eff", "#ff41b4"],
  ["gruvbox-dark", "Gruvbox Dark", "Warm retro groove palette on a dark canvas", "#fabd2f", "#83a598"],
  ["gruvbox-light", "Gruvbox Light", "Warm retro groove palette on a cream canvas", "#fbf1c7", "#f2e5bc"],
];
const dot = (colour, size = 10) => `<span style="display: inline-block; width: ${size}px; height: ${size}px; border-radius: 9999px; background: ${colour}; border: 1px solid rgba(0,0,0,0.14); flex-shrink: 0;"></span>`;
const skinSelect = (c, active, open = false) => {
  const current = PRESETS.find(([k]) => k === active).slice();
  if (active === "default") { current[3] = LOOK.stage.primary ?? current[3]; current[4] = LOOK.stage.secondary ?? current[4]; }
  return `<div style="position: relative;">
  <button type="button" class="btn" aria-haspopup="listbox" aria-expanded="${open}" aria-label="Skin: ${current[1]}" style="gap: 0.625rem; padding-right: 0.625rem; box-shadow: none;">${dot(current[3])}<span>${current[1]}</span>${ic("chevron-down", 14, " color: " + c.muted + ";")}</button>
  ${open ? `<div role="listbox" aria-label="Skin" class="card" style="position: absolute; top: calc(100% + 0.375rem); right: 0; width: 20rem; display: flex; flex-direction: column; padding: 0.375rem; box-shadow: ${c.shadowMd}; z-index: 20;">
    <span class="eyebrow" style="padding: 0.5rem 0.75rem 0.25rem;">Skin</span>
    ${PRESETS.map(([k, label, desc, pri, sec]) => [k, label, desc, k === "default" ? (LOOK.stage.primary ?? pri) : pri, k === "default" ? (LOOK.stage.secondary ?? sec) : sec]).map(([k, label, desc, pri, sec]) => `<div role="option" aria-selected="${k === active}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 6px; background: ${k === active ? c.surfaceDark : "transparent"}; cursor: pointer;"><span style="display: inline-flex; gap: 3px;">${dot(pri)}${dot(sec)}</span><span style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0;"><span style="font-size: 0.875rem; font-weight: ${k === active ? 700 : 600}; color: ${c.text};">${label}</span><span style="font-size: 0.75rem; color: ${c.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc}</span></span>${k === active ? ic("check", 14, " color: " + c.primary + ";") : ""}</div>`).join("")}
    <p style="padding: 0.5rem 0.75rem 0.375rem; border-top: 1px solid ${c.border}; margin-top: 0.25rem; font-size: 0.75rem; line-height: 1.4; color: ${c.muted};">Applied to the content only. The chrome keeps the project theme.</p>
  </div>` : ""}
</div>`;
};

const header = (c, { page = "components", skin = "default", dark = false, skinOpen = false }) => `
<header style="position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 0.75rem; height: 3.5rem; padding: 0 1.5rem; background: ${c.canvas}; border-bottom: 1px solid ${c.border};">
  ${brand(c)}
  <nav aria-label="Site" style="display: flex; align-items: center; gap: 0.25rem; margin-left: 1rem;">
    ${[["components", "Components"], ["theming", "Theming"], ["skins", "Skins"]].map(([id, label]) => `<a href="#${id}" style="display: inline-flex; align-items: center; height: 2rem; padding: 0 0.75rem; border-radius: 6px; font-size: 0.875rem; font-weight: 600; color: ${page === id ? c.text : c.secondary}; background: ${page === id ? c.surfaceDark : "transparent"};">${label}</a>`).join("")}
  </nav>
  <div style="flex-grow: 1;"></div>
  <button type="button" class="btn" aria-label="Search components" style="width: 260px; justify-content: flex-start; font-weight: 500; color: ${c.muted}; box-shadow: none;">${ic("search", 15)}<span style="flex-grow: 1; text-align: left;">Search components</span><span class="kbd">⌘</span><span class="kbd">K</span></button>
  ${skinSelect(c, skin, skinOpen)}
  <button type="button" class="btn icon" aria-label="${dark ? "Switch to light mode" : "Switch to dark mode"}" style="box-shadow: none; border-color: transparent; background: transparent;">${ic(dark ? "sun" : "moon", 16)}</button>
  <a href="#github" class="btn icon" aria-label="light on GitHub" style="box-shadow: none; border-color: transparent; background: transparent;">${ic("github", 16)}</a>
</header>`;

const rail = (c, { open = [], active = "", h = 900 }) => `
<nav aria-label="Components" style="position: sticky; top: 3.5rem; height: calc(${h}px - 3.5rem); overflow: hidden; display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem 1rem 1.5rem 1.5rem; border-right: 1px solid ${c.border};">
${CATS.map(([id, label, icon, count, , items]) => {
  const isOpen = open.includes(id);
  const shown = isOpen ? items.slice(0, 7) : [];
  return `<div class="nav-group"><button type="button" class="nav-head" aria-expanded="${isOpen}">${ic(icon, 14)}<span class="eyebrow" style="color: ${isOpen ? c.text : c.muted};">${label}</span><span class="count">${count}</span></button>${shown.map((n) => `<a href="#${id}-${n.toLowerCase().replace(/ /g, "-")}" class="nav-item${n === active ? " active" : ""}">${n}</a>`).join("")}${isOpen && count > 7 ? `<button type="button" class="nav-more">+${count - 7} more</button>` : ""}</div>`;
}).join("")}
</nav>`;

const toc = (c, items, on) => `<div class="toc" style="display: flex; flex-direction: column; gap: 0.75rem;"><span class="eyebrow">On this page</span><div style="display: flex; flex-direction: column; border-left: 1px solid ${c.border};">${items.map(([label, sub]) => `<a href="#${label.toLowerCase().replace(/ /g, "-")}" class="${sub ? "sub" : ""}${label === on ? " on" : ""}">${label}</a>`).join("")}</div></div>`;

const skinPanel = (c, active) => `<div class="card" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem;"><span class="eyebrow">Skin</span><div style="display: flex; flex-direction: column; gap: 2px;">${Object.entries(SKINS).map(([k, s]) => `<button type="button" aria-pressed="${k === active}" style="display: flex; align-items: center; gap: 0.5rem; height: 2rem; padding: 0 0.5rem; border: 0; border-radius: 6px; background: ${k === active ? c.surfaceDark : "transparent"}; color: ${c.text}; font: inherit; font-size: 0.8125rem; font-weight: ${k === active ? 700 : 500}; cursor: pointer; text-align: left;"><span style="display: inline-flex; gap: 2px;"><i style="width: 8px; height: 8px; border-radius: 9999px; background: ${s.primary};"></i><i style="width: 8px; height: 8px; border-radius: 9999px; background: ${s.secondary};"></i><i style="width: 8px; height: 8px; border-radius: 9999px; background: ${s.surfaceDark}; border: 1px solid ${c.border};"></i></span>${s.label}</button>`).join("")}</div><p style="font-size: 0.75rem; line-height: 1.4; color: ${c.muted};">Applied to the content only. The chrome keeps the project theme.</p></div>`;

const codeLines = (lines, numbered) => lines.map((l, i) => `<div>${numbered ? `<span class="ln">${i + 1}</span>` : ""}${l}</div>`).join("");
const T = (tag, attrs = "", inner = "") => `<span class="tk-p">&lt;</span><span class="tk-tag">${tag}</span>${attrs}<span class="tk-p">&gt;</span>${inner}<span class="tk-p">&lt;/</span><span class="tk-tag">${tag}</span><span class="tk-p">&gt;</span>`;
const A = (name, value) => ` <span class="tk-attr">${name}</span>${value ? `<span class="tk-p">=</span><span class="tk-str">"${value}"</span>` : ""}`;

const sink = (c, skin, dark = false) => `
<div class="stage" style="${skinVars(skin, dark)} display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.5rem; border: 1px solid ${c.border}; border-radius: 8px;">
  <div class="st-card" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1.25rem;">
    <b style="font-size: 1.125rem; font-weight: 800;">Sign in</b>
    <div><label class="st-label" for="e1">Email</label><div class="st-input" id="e1">you@example.com</div></div>
    <div><label class="st-label" for="p1">Password</label><div class="st-input" id="p1" style="letter-spacing: 0.2em;">••••••••</div></div>
    <button type="button" class="st-btn primary" style="width: 100%;">Sign in</button>
  </div>
  <div style="display: flex; flex-direction: column; gap: 0.875rem; justify-content: space-between;">
    <div style="display: flex; flex-wrap: wrap; gap: 0.375rem;"><span class="st-badge" style="background: var(--s-primary); color: var(--s-on-primary); border-color: var(--s-primary-border);">Primary</span><span class="st-badge" style="background: var(--s-success); color: #fff; border-color: var(--s-success-border);">Going</span><span class="st-badge" style="background: var(--s-surface-dark); color: var(--s-text); border-color: var(--s-border);">Free</span></div>
    <label class="st-check"><i>${ic("check", 12)}</i>Remember me</label>
    <label class="st-switch"><i></i>Notifications</label>
    <div class="st-card st-stat" style="padding: 0.75rem 1rem;"><span>Attending</span><b>1,337</b></div>
    <div style="display: flex; gap: 0.5rem;"><button type="button" class="st-btn">Cancel</button><button type="button" class="st-btn primary">Confirm</button></div>
    <div class="st-progress"><i></i></div>
  </div>
</div>`;

const galleryCards = (c, skin) => {
  const v = skinVars(skin);
  const card = (name, tag, preview) => `<div class="card gal"><div class="pv stage" style="${v} border-radius: 8px 8px 0 0; padding: 1rem;">${preview}</div><div class="nm"><span>${name}</span><code>${tag}</code></div></div>`;
  return [
    card("Input", "input", `<div class="st-input" style="width: 150px;">Search…</div>`),
    card("Checkbox", "checkbox", `<label class="st-check"><i>${ic("check", 12)}</i>Agree</label>`),
    card("Switch", "switch", `<label class="st-switch"><i></i>On</label>`),
    card("Select", "select", `<div class="st-input" style="width: 150px; justify-content: space-between; color: var(--s-text);">Brazil ${ic("chevron-down", 14)}</div>`),
    card("Segmented", "segmented", `<div style="display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--s-rfield); background: var(--s-surface-dark); border: var(--s-bw) solid var(--s-border);"><span class="st-btn primary" style="height: 1.75rem; padding: 0 0.625rem; font-size: 0.75rem; box-shadow: none;">Day</span><span class="st-btn ghost" style="height: 1.75rem; padding: 0 0.625rem; font-size: 0.75rem;">Week</span></div>`),
    card("Slider", "slider", `<div style="position: relative; width: 150px; height: 6px; border-radius: 9999px; background: var(--s-surface-dark); border: var(--s-bw) solid var(--s-border);"><i style="position: absolute; left: 0; top: 0; bottom: 0; width: 60%; background: var(--s-primary); border-radius: 9999px;"></i><i style="position: absolute; left: 60%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 9999px; background: var(--s-surface); border: var(--s-bw) solid var(--s-border); box-shadow: var(--s-shfield);"></i></div>`),
    card("Rating", "rating", `<div style="display: flex; gap: 2px; color: var(--s-primary);">${'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>'.repeat(4)}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true" style="opacity: 0.35;"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg></div>`),
    card("Number input", "number-input", `<div style="display: inline-flex; align-items: center; border-radius: var(--s-rfield); border: var(--s-bw) solid var(--s-border); background: var(--s-surface); box-shadow: var(--s-shfield); overflow: hidden;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2.25rem; border-right: var(--s-bw) solid var(--s-border); font-weight: 700;">−</span><span style="display: inline-flex; align-items: center; justify-content: center; width: 3rem; font-weight: 700;">2</span><span style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2.25rem; border-left: var(--s-bw) solid var(--s-border); font-weight: 700;">+</span></div>`),
  ].join("");
};

const overview = ({ skin = "default", dark = false, title, skinOpen = false }) => {
  const c = chrome(dark); CHROME = c;
  return shell({ c, title, header: header(c, { page: "components", skin, dark, skinOpen }), rail: rail(c, { open: ["form", "display"] }), aside: null, main: `
<section style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; margin-bottom: 3rem;">
  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    <h1 style="font-size: 3.5rem; line-height: 1.05; font-weight: 800; letter-spacing: -0.03em;">${TOTAL} components.</h1>
    <p style="font-size: 1.125rem; line-height: 1.55; color: ${c.secondary}; max-width: 34rem;">They all read the same theme tokens. Pick a skin in the bar above and the sink on the right follows.</p>
    <div style="display: flex; gap: 0.75rem;"><a href="#form" class="btn primary">Browse</a><a href="#theming" class="btn">Theming</a></div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    ${sink(c, skin, dark)}
    <p style="font-size: 0.8125rem; color: ${c.muted}; padding: 0 0.25rem;">Wearing <b style="color: ${c.text};">${SKINS[skin].label}</b></p>
  </div>
</section>
${CATS.slice(0, 2).map(([id, label, , count, desc]) => `
<section id="${id}" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 3rem;">
  <div style="display: flex; align-items: baseline; gap: 0.5rem;"><h2 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em;">${label}</h2><span style="font-size: 0.875rem; font-weight: 600; color: ${c.muted};">${count}</span><span style="margin-left: auto; font-size: 0.875rem; color: ${c.muted};">${desc}</span></div>
  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem;">${galleryCards(c, skin)}</div>
</section>`).join("")}` });
};

const componentPage = ({ dark = false, title, palette = false }) => {
  const c = chrome(dark); CHROME = c;
  const v = skinVars("default", dark);
  const exampleHead = (name, desc, view) => `<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid ${c.border};"><div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><h3 style="font-size: calc(1rem * var(--display-scale)); font-family: ${LOOK.fontUI}; font-weight: 700; letter-spacing: 0;">${name}</h3>${desc ? `<span style="font-size: 0.8125rem; color: ${c.muted};">${desc}</span>` : ""}</div><div class="seg"><button type="button" aria-pressed="${view === "preview"}">Preview</button><button type="button" aria-pressed="${view === "code"}">Code</button></div><div class="seg"><button type="button" class="icon" aria-pressed="true" aria-label="Desktop width">${ic("monitor", 14)}</button><button type="button" class="icon" aria-pressed="false" aria-label="Tablet width">${ic("tablet", 14)}</button><button type="button" class="icon" aria-pressed="false" aria-label="Phone width">${ic("smartphone", 14)}</button></div></div>`;
  const copyBtn = `<button type="button" class="btn xs" style="position: absolute; top: 0.5rem; right: 0.5rem;">${ic("copy", 13)}Copy</button>`;
  const main = `
<div class="crumbs"><a href="#components" style="color: ${c.muted};">Components</a><span>/</span><a href="#display" style="color: ${c.muted};">Display</a><span>/</span><b>Button</b></div>
<div style="display: flex; align-items: flex-start; gap: 1rem; margin-top: 1rem;">
  <div style="display: flex; flex-direction: column; gap: 0.5rem; flex-grow: 1;">
    <h1 style="font-size: calc(2.5rem * var(--display-scale)); line-height: 1.1;">Button</h1>
    <button type="button" class="btn xs mono" style="align-self: flex-start; font-weight: 500;">&lt;lc-button&gt;${ic("copy", 12)}</button>
  </div>
  <div style="display: flex; gap: 0.5rem;"><a href="#bar-chart" class="btn icon xs" aria-label="Previous: Bar chart" title="Bar chart">${ic("chevron-left", 14)}</a><a href="#calendar" class="btn icon xs" aria-label="Next: Calendar" title="Calendar">${ic("chevron-right", 14)}</a></div>
</div>
<p style="font-size: 1.125rem; line-height: 1.55; color: ${c.secondary}; max-width: 62ch; margin-top: 1rem;">A clickable action. Colour attributes map to the theme's roles, so <code class="mono" style="font-size: 0.9375rem; padding: 0.125rem 0.375rem; border-radius: 6px; background: ${c.surfaceDark};">primary</code> is whatever the theme says primary is, and a skin redresses every button at once.</p>
<section id="examples" style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 3rem;">
  <div style="display: flex; flex-direction: column; gap: 0.25rem;"><h2 style="font-size: calc(1.5rem * var(--display-scale));">Examples</h2><p style="font-size: 0.9375rem; color: ${c.secondary};">Each example is the component itself, in the skin picked above. Code shows the markup that produced it.</p></div>
  <article class="card" id="basic" style="overflow: hidden;">
    ${exampleHead("Basic", "", "code")}
    <div class="code" style="position: relative; padding: 1rem 1rem 1rem 0.75rem;">${copyBtn}${codeLines([T("lc-button", "", "Click me")], true)}</div>
  </article>
  <article class="card" id="variants" style="overflow: hidden;">
    ${exampleHead("Variants", "Different visual styles for various action types", "preview")}
    <div class="stage" style="${v} display: flex; align-items: center; justify-content: center; gap: 0.75rem; min-height: 7.5rem;">
      <button type="button" class="st-btn">Default</button><button type="button" class="st-btn primary">Primary</button><button type="button" class="st-btn secondary">Secondary</button><button type="button" class="st-btn success">Success</button><button type="button" class="st-btn danger">Danger</button>
    </div>
    <div class="code" style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; border-top: 1px solid ${c.border}; white-space: nowrap; overflow: hidden;"><span style="flex-grow: 1; overflow: hidden; text-overflow: ellipsis;">${T("lc-button", A("primary"), "Primary")} ${T("lc-button", A("secondary"), "Secondary")} ${T("lc-button", A("success"), "Success")} …</span><button type="button" class="btn xs">${ic("copy", 13)}Copy</button></div>
  </article>
  <article class="card" id="styles" style="overflow: hidden;">
    ${exampleHead("Styles", "Outline, ghost and disabled", "preview")}
    <div class="stage" style="${v} display: flex; align-items: center; justify-content: center; gap: 0.75rem; min-height: 7.5rem;">
      <button type="button" class="st-btn outline">Outline</button><button type="button" class="st-btn ghost">Ghost</button><button type="button" class="st-btn disabled" disabled>Disabled</button>
    </div>
  </article>
</section>`;
  const aside = toc(c, [["Examples"], ["Basic", 1], ["Variants", 1], ["Styles", 1], ["Sizes", 1], ["Disabled", 1], ["As link", 1], ["Playground"], ["API"], ["Props", 1], ["Slots", 1], ["Theme variables", 1]], "Basic");
  const overlay = palette ? paletteOverlay(c) : "";
  return shell({ c, title, header: header(c, { page: "components", skin: "default", dark }), rail: rail(c, { open: ["display"], active: "Button" }), aside, main, overlay });
};

const paletteOverlay = (c) => {
  const row = (icon, title, hint, on = false, k = "") => `<div style="display: flex; align-items: center; gap: 0.75rem; height: 2.5rem; padding: 0 0.75rem; border-radius: 6px; background: ${on ? c.surfaceDark : "transparent"}; color: ${c.text};">${ic(icon, 15)}<span style="font-size: 0.875rem; font-weight: ${on ? 700 : 500};">${title}</span><span style="font-size: 0.8125rem; color: ${c.muted};">${hint}</span><span style="flex-grow: 1;"></span>${k ? `<span class="kbd">${k}</span>` : ""}</div>`;
  const group = (label) => `<span class="eyebrow" style="padding: 0.75rem 0.75rem 0.25rem;">${label}</span>`;
  return `
<div style="position: absolute; inset: 0; background: rgba(21, 24, 19, 0.45); display: flex; justify-content: center; align-items: flex-start; padding-top: 15vh;">
  <div role="dialog" aria-label="Search components" class="card" style="width: 560px; display: flex; flex-direction: column; box-shadow: ${c.shadowMd}; overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 0.75rem; height: 3.25rem; padding: 0 1rem; border-bottom: 1px solid ${c.border};">${ic("search", 16)}<label for="pal" style="position: absolute; left: -9999px;">Search</label><input id="pal" type="text" value="sw" style="flex-grow: 1; border: 0; outline: 0; background: transparent; font: inherit; font-size: 1rem; color: ${c.text};"><span class="kbd">esc</span></div>
    <div style="display: flex; flex-direction: column; padding: 0.25rem 0.5rem 0.5rem;">
      ${group("Components")}${row("toggle-right", "Switch", "Form", true, "↵")}${row("layers", "Swipe deck", "App shell")}${row("search", "Search", "Form")}
      ${group("Pages")}${row("palette", "Skins", "The four presets, side by side")}
      ${group("Skins")}${row("palette", "Skin: Gruvbox Dark", "Warm retro groove palette on a dark canvas")}
    </div>
    <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; border-top: 1px solid ${c.border}; font-size: 0.75rem; color: ${c.muted};"><span><span class="kbd">↑</span> <span class="kbd">↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div>
  </div>
</div>`;
};

const skinsPage = ({ title }) => {
  const c = chrome(false); CHROME = c;
  const main = `
<div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem;"><h1 style="font-size: 2.5rem; font-weight: 800; letter-spacing: -0.025em; line-height: 1.1;">Skins</h1><p style="font-size: 1.125rem; line-height: 1.55; color: ${c.secondary}; max-width: 62ch;">A skin is a preset. The looks differ by a few theme lines: radius, shadow, motion, control weight.</p></div>
<div style="display: flex; flex-direction: column; gap: 1rem;">
${Object.entries(SKINS).map(([k, s]) => `
<section class="card" style="display: grid; grid-template-columns: 16rem minmax(0, 1fr); overflow: hidden;">
  <div style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1.25rem; border-right: 1px solid ${c.border};">
    <div style="display: flex; align-items: center; gap: 0.5rem;"><span style="display: inline-flex; gap: 2px;"><i style="width: 10px; height: 10px; border-radius: 9999px; background: ${s.primary};"></i><i style="width: 10px; height: 10px; border-radius: 9999px; background: ${s.secondary};"></i></span><h2 style="font-size: 1.125rem; font-weight: 800;">${s.label}</h2></div>
    <p style="font-size: 0.875rem; line-height: 1.5; color: ${c.secondary};">${{ default: "The framework's own look: ink and one signal colour on cool grey, hairline edges, the platform's type", neobrutalist: "Thick black borders, hard offset shadows, uppercase controls", "gruvbox-dark": "Warm retro groove palette on a dark canvas", daisy: "Pill selectors, a soft depth under buttons, base surfaces in three steps" }[k]}</p>
    <div class="mono" style="display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem; color: ${c.muted};">${s.roles.slice(0, 3).map((r) => `<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r}</span>`).join("")}</div>
  </div>
  <div class="stage" style="${skinVars(k)} display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;">
    <div class="st-card" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.875rem; width: 15rem;"><b style="font-size: 0.9375rem; font-weight: 800;">Sign in</b><div class="st-input">you@example.com</div><button type="button" class="st-btn primary">Sign in</button></div>
    <div style="display: flex; flex-direction: column; gap: 0.625rem;"><div style="display: flex; gap: 0.375rem;"><span class="st-badge" style="background: var(--s-primary); color: var(--s-on-primary); border-color: var(--s-primary-border);">Primary</span><span class="st-badge" style="background: var(--s-success); color: #fff; border-color: var(--s-success-border);">Going</span></div><label class="st-check"><i>${ic("check", 12)}</i>Remember me</label><label class="st-switch"><i></i>Notifications</label></div>
    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-left: auto;"><button type="button" class="st-btn">Cancel</button><button type="button" class="st-btn primary">Confirm</button></div>
  </div>
</section>`).join("")}
</div>`;
  return shell({ c, title, header: header(c, { page: "skins", skin: "default" }), rail: rail(c, { open: [], h: 1180 }), aside: null, main, h: 1180 });
};

const phone = ({ title }) => {
  const c = chrome(false); CHROME = c;
  return page({ title, w: 390, h: 844, phone: true, body: `
<div style="position: relative; width: 390px; height: 844px; overflow: hidden; background: ${c.canvas};">
  <header style="display: flex; align-items: center; gap: 0.5rem; height: 3.5rem; padding: 0 0.75rem; border-bottom: 1px solid ${c.border};">
    <button type="button" class="btn icon" aria-label="Open navigation" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("menu", 20)}</button>
    ${brand(c)}
    <span style="flex-grow: 1;"></span>
    <button type="button" class="btn icon" aria-label="Search components" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("search", 20)}</button>
    <button type="button" class="btn icon" aria-label="Switch to dark mode" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("moon", 20)}</button>
  </header>
  <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem 1rem;">
    <h1 style="font-size: 2.25rem; line-height: 1.05; font-weight: 800; letter-spacing: -0.03em;">${TOTAL} components.</h1>
    <p style="font-size: 0.9375rem; line-height: 1.5; color: ${c.secondary};">They all read the same theme tokens. Pick a skin and the sink follows.</p>
    <a href="#form" class="btn primary" style="align-self: flex-start;">Browse</a>
    ${sink(c, "default").replace("grid-template-columns: 1fr 1fr", "grid-template-columns: 1fr").replace("padding: 1.5rem;", "padding: 1rem;")}
  </div>
  <div style="position: absolute; inset: 0; background: rgba(21, 24, 19, 0.45);"></div>
  <aside aria-label="Navigation" style="position: absolute; top: 0; left: 0; bottom: 0; width: 280px; background: ${c.surface}; border-right: 1px solid ${c.border}; display: flex; flex-direction: column; overflow: hidden;">
    <div style="display: flex; align-items: center; height: 3.5rem; padding: 0 0.5rem 0 1rem; border-bottom: 1px solid ${c.border};">${brand(c)}<span style="flex-grow: 1;"></span><button type="button" class="btn icon" aria-label="Close navigation" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("x", 18)}</button></div>
    <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0.75rem;">
      <div style="display: flex; flex-direction: column; gap: 0.25rem;"><span class="eyebrow" style="padding: 0 0.75rem;">Skin</span>${Object.entries(SKINS).map(([k, s]) => `<button type="button" aria-pressed="${k === "default"}" style="display: flex; align-items: center; gap: 0.625rem; height: 2.25rem; padding: 0 0.75rem; border: 0; border-radius: 6px; background: ${k === "default" ? c.surfaceDark : "transparent"}; color: ${c.text}; font: inherit; font-size: 0.875rem; font-weight: ${k === "default" ? 700 : 500}; text-align: left;"><span style="width: 10px; height: 10px; border-radius: 9999px; background: ${s.primary};"></span>${s.label}</button>`).join("")}</div>
      ${CATS.slice(0, 5).map(([id, label, icon, count, , items]) => `<div class="nav-group"><button type="button" class="nav-head" aria-expanded="${id === "form"}">${ic(icon, 14)}<span class="eyebrow" style="color: ${id === "form" ? c.text : c.muted};">${label}</span><span class="count">${count}</span></button>${id === "form" ? items.slice(0, 5).map((n) => `<a href="#${id}-${n.toLowerCase()}" class="nav-item">${n}</a>`).join("") + `<button type="button" class="nav-more">+17 more</button>` : ""}</div>`).join("")}
    </div>
  </aside>
</div>` });
};

const shell = ({ c, title, header: h, rail: r, aside, main, overlay = "", h: H = 900 }) => page({ title, w: 1440, h: H, body: `
<div style="position: relative; width: 1440px; height: ${H}px; overflow: hidden; background: ${c.canvas};">
  ${h}
  <div style="display: grid; grid-template-columns: 16rem minmax(0, 1fr) ${aside ? "13.75rem" : "0"}; max-width: 90rem; margin: 0 auto;">
    ${r}
    <main style="padding: 2rem; ${aside ? "" : "padding-right: 2rem;"}"><div style="max-width: ${aside ? "53.75rem" : "none"};">${main}</div></main>
    ${aside ? `<aside style="position: sticky; top: 3.5rem; display: flex; flex-direction: column; gap: 1.5rem; padding: 2rem 1.5rem 2rem 0;">${aside}</aside>` : ""}
  </div>
  ${overlay}
</div>` });

let CHROME = LIGHT;
const page = ({ title, w, h, body, phone: ph = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${LOOK.google}&family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${css(CHROME, ph)}</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;

const KW = (w) => `<span class="tk-kw">${w}</span>`;
const S = (s) => `<span class="tk-str">${s}</span>`;
const P = (s) => `<span class="tk-p">${s}</span>`;
const TAG = (tag, attrs = "", inner = "", close = true) => `${P("&lt;")}<span class="tk-tag">${tag}</span>${attrs}${P("&gt;")}${inner}${close ? `${P("&lt;/")}<span class="tk-tag">${tag}</span>${P("&gt;")}` : ""}`;
const COPY = `<button type="button" class="btn xs" style="position: absolute; top: 0.625rem; right: 0.625rem;">${ic("copy", 13)}Copy</button>`;
const inlineCode = (c, text) => `<code class="mono" style="font-size: 0.9em; padding: 0.125rem 0.375rem; border-radius: var(--r-selector); background: ${c.surfaceDark}; color: ${c.text};">${text}</code>`;

const SNIPPETS = {
  counter: [
    `${KW("import")} View ${KW("from")} ${S('"@lightstart/light"')};`,
    `${KW("import")} { html } ${KW("from")} ${S('"@lightstart/light/html"')};`,
    ``,
    `View.define(${S('"my-counter"')}, { count: 0, label: ${S('"Clicks"')} }, (el) =&gt; html\``,
    `  ${TAG("button", ` ${A("@click", "").trim()}${P("=")}\${() =&gt; el.count++}`, "\${el.label}: \${el.count}")}`,
    `\`);`,
  ],
  attributes: [
    `View.define(${S('"my-counter"')}, { label: ${S('"Clicks"')}, count: 0, big: ${KW("false")} }, (el) =&gt; html\`...\`);`,
    ``,
    `${P("// in the page")}`,
    `${TAG("my-counter")}`,
    `${TAG("my-counter", `${A("label", "Taps")}${A("count", "7")}${A("big")}`)}`,
  ],
  templates: [
    `render() {`,
    `  ${KW("return")} html\``,
    `    ${TAG("ul", "", "\${this.items.map((item) =&gt; key(item.id, html`" + TAG("li", "", "\${item.text}") + "`))}")}`,
    `    \${this.items.length ? nothing : html\`${TAG("p", "", "Nothing yet")}\`}`,
    `    ${TAG("slot", A("name", "footer"))}`,
    `  \`;`,
    `}`,
  ],
  signals: [
    `${KW("import")} { signal, computed, effect } ${KW("from")} ${S('"@lightstart/light/signals"')};`,
    ``,
    `${KW("const")} qty = signal(2);`,
    `${KW("const")} price = signal(9.5);`,
    `${KW("const")} total = computed(() =&gt; qty() * price());`,
    ``,
    `effect(() =&gt; { output.textContent = total().toFixed(2); });`,
    `qty.set(3); ${P("// output reads 28.50")}`,
  ],
  theme: [
    `${KW("import")} { applyTheme, applyScopedTheme } ${KW("from")} ${S('"@lightstart/light/theme"')};`,
    `${KW("import")} { loadPreset } ${KW("from")} ${S('"@lightstart/light/theme/presets.js"')};`,
    ``,
    `applyTheme({`,
    `  color: { primary: ${S('"#101210"')}, accent: ${S('"#e4572e"')} },`,
    `  radius: { field: ${S('"0.125rem"')}, box: ${S('"0.25rem"')} },`,
    `});`,
    ``,
    `applyScopedTheme(${S('"[data-skin=neo]"')}, ${KW("await")} loadPreset(${S('"neobrutalist"')}));`,
  ],
  form: [
    `${TAG("lc-form", "", "", false)}`,
    `  <span class="tk-attr">.fields</span>${P("=")}\${[`,
    `    { name: ${S('"email"')}, label: ${S('"Email"')}, type: ${S('"email"')}, required: ${KW("true")} },`,
    `    { name: ${S('"plan"')}, label: ${S('"Plan"')}, type: ${S('"select"')}, options: [${S('"Free"')}, ${S('"Pro"')}] },`,
    `    { name: ${S('"news"')}, label: ${S('"Newsletter"')}, type: ${S('"checkbox"')} },`,
    `  ]}`,
    `  <span class="tk-attr">@form-submit</span>${P("=")}\${(e) =&gt; save(e.detail)}`,
    `${P("&gt;&lt;/")}<span class="tk-tag">lc-form</span>${P("&gt;")}`,
  ],
  env: [
    `${KW("import")} { env } ${KW("from")} ${S('"@lightstart/light/env"')};`,
    `${KW("import")} { configureNavigation } ${KW("from")} ${S('"@lightstart/light/navigation"')};`,
    ``,
    `env.subscribe(() =&gt; { label.textContent = \`\${env.width}×\${env.height} · \${env.breakpoint} · \${env.os}\`; });`,
    ``,
    `configureNavigation({ href: (path) =&gt; \`/app\${path}\`, go: router.go });`,
    `html\`${TAG("lc-link", A("href", "/components"), "Components")}\``,
  ],
  test: [
    `${KW("import")} assert ${KW("from")} ${S('"node:assert/strict"')};`,
    `${KW("import")} { it } ${KW("from")} ${S('"node:test"')};`,
    ``,
    `it(${S('"counts a click"')}, ${KW("async")} () =&gt; {`,
    `  ${KW("const")} el = document.createElement(${S('"my-counter"')});`,
    `  document.body.append(el);`,
    `  el.querySelector(${S('"button"')}).click();`,
    `  ${KW("await")} el.$requestUpdate();`,
    `  assert.equal(el.count, 1);`,
    `});`,
  ],
};

const stBtn = (label, extra = "") => `<button type="button" class="st-btn primary" style="${extra}">${label}</button>`;
const RESULTS = {
  counter: () => `<div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">${stBtn("Clicks: 3", "height: 3rem; padding: 0 1.5rem; font-size: 1rem;")}<span style="font-size: 0.8125rem; color: var(--s-muted);">&lt;my-counter&gt; after three clicks</span></div>`,
  attributes: () => `<div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">${stBtn("Clicks: 0")}${stBtn("Taps: 7", "height: 3.25rem; padding: 0 1.75rem; font-size: 1.125rem;")}<span style="font-size: 0.8125rem; color: var(--s-muted);">the second one read its three attributes</span></div>`,
  templates: () => `<div class="st-card" style="width: 16rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"><ul style="margin: 0; padding: 0 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem;"><li>Milk</li><li>Bread</li><li>Coffee</li></ul><div style="border-top: var(--s-bw) solid var(--s-border); padding-top: 0.5rem; font-size: 0.75rem; color: var(--s-muted);">3 items · slotted by the page</div></div>`,
  signals: () => `<div class="st-card" style="display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; font-size: 0.9375rem;"><span style="display: inline-flex; align-items: center; border-radius: var(--s-rfield); border: var(--s-bw) solid var(--s-border); overflow: hidden;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2.25rem; border-right: var(--s-bw) solid var(--s-border); font-weight: 700;">−</span><span style="display: inline-flex; align-items: center; justify-content: center; width: 2.5rem; font-weight: 700;">3</span><span style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2.25rem; border-left: var(--s-bw) solid var(--s-border); font-weight: 700;">+</span></span><span style="color: var(--s-muted);">× 9.50 =</span><b style="font-size: 1.5rem; font-weight: 800;">28.50</b></div>`,
  theme: (c, dark, phone) => `<div style="display: grid; grid-template-columns: ${phone ? "1fr" : "1fr 1fr"}; gap: 1rem; width: 100%;">${["default", "neobrutalist"].map((k) => `<div style="${skinVars(k, dark)} display: flex; flex-direction: column; gap: 0.5rem; font-family: var(--s-font); color: var(--s-text);"><div class="st-card" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.875rem;"><b style="font-size: 0.9375rem; font-weight: 800;">Sign in</b><div class="st-input">you@example.com</div>${stBtn("Sign in")}</div><span style="font-size: 0.75rem; color: ${c.muted}; font-family: ${LOOK.fontUI};">${k === "default" ? "applyTheme" : "applyScopedTheme, neobrutalist"}</span></div>`).join("")}</div>`,
  form: () => `<div class="st-card" style="width: 18rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;"><div><span class="st-label">Email</span><div class="st-input">you@example.com</div></div><div><span class="st-label">Plan</span><div class="st-input" style="justify-content: space-between; color: var(--s-text);">Free ${ic("chevron-down", 14)}</div></div><label class="st-check"><i>${ic("check", 12)}</i>Newsletter</label>${stBtn("Save", "width: 100%;")}</div>`,
  env: (c) => `<div class="st-card" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 1.25rem; min-width: 16rem;"><span class="mono" style="font-size: 0.875rem;">1440×900 · lg · linux · light</span><span style="font-size: 0.75rem; color: var(--s-muted);">env, updated on resize</span><a href="#components" style="display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.9375rem; font-weight: 600; color: var(--s-primary);">Components ${ic("chevron-right", 14)}</a><span style="font-size: 0.75rem; color: var(--s-muted);">lc-link, href rewritten to /app/components</span></div>`,
  test: (c) => `<div class="code" style="width: 100%; padding: 1rem 1.25rem; border-radius: var(--r-box); background: ${c.text}; color: ${c.canvas}; font-size: 0.8125rem; line-height: 1.7;"><div><span style="color: ${c.disabled};">$</span> light test counter.browser.test.js</div><div><span style="color: #4ade80;">✓</span> 1 passed <span style="color: ${c.disabled};">0 failed</span> counter.browser.test.js</div><div style="margin-top: 0.5rem; font-weight: 700;">1 passed, 1 total</div></div>`,
};

const PAIRS = [
  ["counter", "box", "View engine", "View.define, mixins, lifecycle hooks, $own for cleanup, plugins. One render per element per frame.", (c) => `A component is an object: its properties, its template, its hooks. Light makes it a custom element.`],
  ["templates", "code", "html", "Tagged templates with keyed lists, element bindings and slots in the light DOM. Prerendered markup is adopted, not replaced.", (c) => `Templates are tagged template literals. Lists stay keyed, children slot in, served markup is reused.`],
  ["signals", "activity", "Signals", "signal, computed, effect and batch. A component's state is a store of them.", (c) => `State is signals. A computed follows what it reads; an effect runs when that changes.`],
  ["attributes", "braces", "Properties", "A property is its default: a number, a string, a boolean, an array, an object. It reads and reflects its attribute; T.* adds an option.", (c) => `A property is its default, and reads its attribute. T.* is there when it needs an option.`],
  ["env", "compass", "env and navigation", "Viewport, breakpoint, OS and colour scheme. Links are plain anchors until a router is configured.", (c) => `The page's size, OS and colour scheme, and links that work with or without a router.`],
  ["theme", "palette", "Theme", "Tokens from a theme object, five presets, skins scoped to one element, dark mode, icons from any Iconify set.", (c) => `A theme is an object. Apply it to the page, or to one element as a skin.`],
  ["form", "layout-grid", `${TOTAL} components`, "Forms, tables, charts, overlays, navigation, app shells and page sections. Each one has a demo.", (c) => `Forms, tables, charts, overlays, navigation, app shells and page sections. Each one has a demo.`],
  ["test", "flask", "light test", "node:test and node:assert in the browser. The same test file runs under node or in Chromium.", (c) => `Tests are node:test files. light test runs them in a real browser.`],
];

const features = (c, { phone }) => `
<section style="display: flex; flex-direction: column; gap: 1.25rem; padding: ${phone ? "1.5rem 0" : "2.5rem 0"}; border-top: 1px solid ${c.border};">
  <div style="display: flex; flex-direction: column; gap: 0.375rem;"><span class="eyebrow">The package</span><h2 style="font-size: ${phone ? "1.5rem" : "2rem"}; line-height: 1.1;">What is in it</h2></div>
  <div style="display: grid; grid-template-columns: repeat(${phone ? 2 : 4}, minmax(0, 1fr)); gap: ${phone ? "0.75rem" : "1rem"};">
    ${PAIRS.map(([key, icon, title, card]) => `<a href="#${key}" class="card" style="display: flex; flex-direction: column; gap: 0.625rem; padding: ${phone ? "0.875rem" : "1.25rem"}; color: ${c.text};"><span style="display: inline-flex; width: 2.25rem; height: 2.25rem; align-items: center; justify-content: center; border-radius: var(--r-field); background: ${c.surfaceDark}; color: ${c.text};">${ic(icon, 18)}</span><b style="font-size: ${phone ? "0.875rem" : "1rem"}; font-weight: 700;">${title}</b><p style="font-size: ${phone ? "0.75rem" : "0.875rem"}; line-height: 1.5; color: ${c.secondary};">${card}</p></a>`).join("")}
  </div>
</section>`;

const pair = (c, { dark, phone }, [key, , title, , lede]) => {
  const code = `<div class="card code" style="position: relative; padding: 1.25rem 1.25rem 1.25rem 0.75rem; white-space: pre-wrap; overflow-wrap: anywhere; ${phone ? "font-size: 0.6875rem;" : ""}">${COPY}${codeLines(SNIPPETS[key], true)}</div>`;
  const result = `<div class="card stage" style="${skinVars("default", dark)} display: flex; align-items: center; justify-content: center; padding: 1.5rem; min-height: ${phone ? "12rem" : "14rem"};">${RESULTS[key](c, dark, phone)}</div>`;
  return `
<section id="${key}" style="display: flex; flex-direction: column; gap: 1rem; padding: ${phone ? "1.5rem 0" : "2.5rem 0"}; border-top: 1px solid ${c.border};">
  <div style="display: flex; flex-direction: column; gap: 0.375rem; max-width: 44rem;"><h2 style="font-size: ${phone ? "1.375rem" : "1.625rem"}; line-height: 1.15;">${title}</h2><p style="font-size: 0.9375rem; line-height: 1.55; color: ${c.secondary};">${lede(c)}</p></div>
  ${phone
    ? `<div class="seg" style="align-self: flex-start;"><button type="button" aria-pressed="false">Code</button><button type="button" aria-pressed="true">Result</button></div>${result}`
    : `<div style="display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1rem; align-items: stretch;">${code}${result}</div>`}
</section>`;
};

const hero = (c, { phone }) => `
<section style="display: flex; flex-direction: column; gap: 1.25rem; padding: ${phone ? "2rem 0 1.5rem" : "4rem 0 3rem"}; max-width: 46rem;">
  <h1 style="display: flex; flex-direction: column; gap: 0.25rem;"><span style="font-size: ${phone ? "3.5rem" : "5rem"}; line-height: 0.95; letter-spacing: -0.045em;">Light</span><span style="font-size: ${phone ? "1.5rem" : "2.25rem"}; line-height: 1.1; letter-spacing: -0.025em; color: ${c.secondary};">Web Components made simple.</span></h1>
  <p style="font-size: ${phone ? "1rem" : "1.125rem"}; line-height: 1.55; color: ${c.secondary};">Everything React does, on custom elements and event listeners instead of a virtual DOM. Signals, a theme engine and ${TOTAL} components come in the box.</p>
  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;"><a href="Components.dc.html" class="btn primary">Components</a><a href="#readme" class="btn">${ic("github", 15)}README</a><span class="mono card" style="display: inline-flex; align-items: center; gap: 0.75rem; height: 2.25rem; padding: 0 0.5rem 0 0.875rem; font-size: 0.8125rem; color: ${c.text};"><span><span style="color: ${c.muted};">$</span> npm i @lightstart/light</span><button type="button" class="btn icon xs" aria-label="Copy" style="box-shadow: none; border-color: transparent; background: transparent;">${ic("copy", 13)}</button></span></div>
</section>`;

const FACTS = [
  ["0", "dependencies", "Nothing under node_modules besides Light itself. What you install is what runs."],
  ["No", "build step", "ES modules served as they are. An importmap, or a bundler if you already have one."],
  ["JS", "with types", "Written in JavaScript with JSDoc. The .d.ts files ship in the package, so TypeScript reads every signature."],
];
const facts = (c, { phone }) => `
<section class="card" style="display: grid; grid-template-columns: repeat(${phone ? 1 : 3}, minmax(0, 1fr)); margin: ${phone ? "0 0 0.5rem" : "0 0 1rem"}; overflow: hidden;">
  ${FACTS.map(([value, label, line], i) => `<div style="display: flex; flex-direction: column; gap: 0.5rem; padding: ${phone ? "1.25rem 1rem" : "1.5rem 1.75rem"}; ${i ? (phone ? `border-top: 1px solid ${c.border};` : `border-left: 1px solid ${c.border};`) : ""}"><div style="display: flex; align-items: baseline; gap: 0.625rem;"><span style="font-family: ${LOOK.fontDisplay}; font-size: ${phone ? "2.25rem" : "2.75rem"}; font-weight: 800; letter-spacing: -0.04em; line-height: 1;">${value}</span><span class="eyebrow" style="color: ${c.text};">${label}</span></div><p style="font-size: 0.875rem; line-height: 1.5; color: ${c.secondary};">${line}</p></div>`).join("")}
</section>`;

const PRINCIPLES = [
  ["The name", "Light, as in light DOM.", "Web components come with the shadow DOM, and it makes them far more complicated than they need to be. Light turns it off. A component is a plain element in the page, with the page's CSS and the page's events, and that alone makes it a smaller and faster replacement for React."],
  ["The language", "JavaScript, typed.", "Light is plain JavaScript, so it runs as written, with no build step. Its types come from JSDoc, checked by TypeScript and shipped as .d.ts, so in a TypeScript project it is a typed package like any other."],
];
const principles = (c, { phone }) => `
<section style="display: grid; grid-template-columns: repeat(${phone ? 1 : 2}, minmax(0, 1fr)); gap: 1rem; padding: ${phone ? "1.5rem 0" : "2.5rem 0"}; border-top: 1px solid ${c.border};">
  ${PRINCIPLES.map(([eyebrow, title, text]) => `<div class="card" style="display: flex; flex-direction: column; gap: 0.625rem; padding: ${phone ? "1.25rem" : "1.75rem"};"><span class="eyebrow">${eyebrow}</span><h2 style="font-size: ${phone ? "1.375rem" : "1.625rem"}; line-height: 1.15;">${title}</h2><p style="font-size: ${phone ? "0.9375rem" : "1rem"}; line-height: 1.55; color: ${c.secondary};">${text}</p></div>`).join("")}
</section>`;

const cta = (c, { phone }) => `
<section style="display: flex; flex-direction: ${phone ? "column" : "row"}; align-items: ${phone ? "stretch" : "center"}; justify-content: space-between; gap: 2rem; margin: ${phone ? "1.5rem 0 2rem" : "3rem 0 4rem"}; padding: ${phone ? "2rem 1.5rem" : "3rem"}; border-radius: var(--r-box); background: ${c.text}; color: ${c.canvas};">
  <div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 36rem;"><h2 style="font-size: ${phone ? "1.75rem" : "2.25rem"}; line-height: 1.1; color: ${c.canvas};">See all ${TOTAL}.</h2><p style="font-size: 1rem; line-height: 1.5; color: ${c.canvas}; opacity: 0.75;">The catalogue draws each component from its demo file, with its props, its examples and a playground, in any skin.</p></div>
  <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;"><a href="Components.dc.html" class="btn" style="background: ${c.canvas}; color: ${c.text}; border-color: ${c.canvas}; box-shadow: none;">Components</a><a href="#theming" class="btn" style="background: transparent; color: ${c.canvas}; border-color: ${c.canvas}; box-shadow: none;">Theming</a></div>
</section>`;

const footer = (c, { phone }) => `
<footer style="border-top: 1px solid ${c.border}; background: ${c.surface};">
  <div style="max-width: 72rem; margin: 0 auto; padding: ${phone ? "2rem 1rem" : "3rem 2rem"}; display: grid; grid-template-columns: ${phone ? "1fr" : "2fr 1fr 1fr"}; gap: 2rem;">
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">${brand(c)}<p style="font-size: 0.875rem; line-height: 1.5; color: ${c.secondary}; max-width: 22rem;">Web Components made simple.</p></div>
    ${[["Site", ["Components", "Theming", "Skins"]], ["Source", ["GitHub", "npm", "README"]]].map(([title, links]) => `<div style="display: flex; flex-direction: column; gap: 0.625rem;"><span class="eyebrow">${title}</span>${links.map((l) => `<a href="#${l.toLowerCase()}" style="font-size: 0.875rem; font-weight: 500; color: ${c.secondary};">${l}</a>`).join("")}</div>`).join("")}
  </div>
  <div style="max-width: 72rem; margin: 0 auto; padding: 0 ${phone ? "1rem" : "2rem"} 1.5rem; font-size: 0.75rem; color: ${c.muted};">Alan Meira</div>
</footer>`;

const phoneHeader = (c) => `
<header style="position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 0.5rem; height: 3.5rem; padding: 0 0.75rem; background: ${c.canvas}; border-bottom: 1px solid ${c.border};">
  ${brand(c)}
  <span style="flex-grow: 1;"></span>
  <button type="button" class="btn icon" aria-label="Search components" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("search", 20)}</button>
  <button type="button" class="btn icon" aria-label="Switch to dark mode" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("moon", 20)}</button>
  <button type="button" class="btn icon" aria-label="Open menu" style="border-color: transparent; background: transparent; box-shadow: none;">${ic("menu", 20)}</button>
</header>`;

const home = ({ dark = false, phone = false, title, h }) => {
  const c = chrome(dark); CHROME = c;
  const o = { dark, phone };
  const w = phone ? 390 : 1440;
  return page({ title, w, h, phone, body: `
<div style="position: relative; width: ${w}px; min-height: ${h}px; background: ${c.canvas};">
  ${phone ? phoneHeader(c) : header(c, { page: "home", skin: "default", dark })}
  <main style="max-width: 72rem; margin: 0 auto; padding: 0 ${phone ? "1rem" : "2rem"}; display: flex; flex-direction: column;">
    ${hero(c, o)}${facts(c, o)}${principles(c, o)}${features(c, o)}${PAIRS.map((p) => pair(c, o, p)).join("")}${cta(c, o)}
  </main>
  ${footer(c, o)}
</div>` });
};

const boards = {
  "Home.dc.html": { html: home({ title: "Light - Web Components made simple", h: 5200 }), x: 0, y: 0, w: 1440, h: 5200, title: "Home" },
  "Home-dark.dc.html": { html: home({ dark: true, title: "Home, dark", h: 5200 }), x: 1520, y: 0, w: 1440, h: 5200, title: "Home, dark" },
  "Home-phone.dc.html": { html: home({ phone: true, title: "Home, phone", h: 7200 }), x: 3040, y: 0, w: 390, h: 7200, title: "Home, phone 390" },
  "Components.dc.html": { html: overview({ title: "Components" }), x: 0, y: 7700, w: 1440, h: 900, title: "Components" },
  "Overview-neobrutalist.dc.html": { html: overview({ skin: "neobrutalist", title: "Components, Neobrutalist skin", skinOpen: true }), x: 1520, y: 7700, w: 1440, h: 900, title: "Components, Neobrutalist skin, skin menu open" },
  "Component-code.dc.html": { html: componentPage({ title: "Button, code view" }), x: 3040, y: 7700, w: 1440, h: 900, title: "Component page, code open" },
  "Component-dark.dc.html": { html: componentPage({ dark: true, title: "Button, dark" }), x: 0, y: 8720, w: 1440, h: 900, title: "Component page, dark" },
  "Palette.dc.html": { html: componentPage({ title: "Command palette", palette: true }), x: 1520, y: 8720, w: 1440, h: 900, title: "Command palette" },
  "Skins.dc.html": { html: skinsPage({ title: "Skins" }), x: 3040, y: 8720, w: 1440, h: 1180, title: "Skins page" },
  "Phone-drawer.dc.html": { html: phone({ title: "Phone, navigation drawer" }), x: 0, y: 10020, w: 390, h: 844, title: "Phone, drawer open" },
};
const index = { v: 3, createdOnFiles: { v: 1, at: new Date().toISOString() }, title: "light", launch: { view: "canvas" }, pages: [], boards: {}, order: [], notes: {
  home: { x: 0, y: -300, text: "light: the home page, 1440 wide, in dark mode, and on a phone at 390", kind: "title1", maxW: 4480 },
  desktop: { x: 0, y: 7400, text: "The catalogue, desktop 1440×900", kind: "title1", maxW: 4480 },
  states: { x: 0, y: 8420, text: "Dark mode, ⌘K palette, the Skins page", kind: "title1", maxW: 4480 },
  phone: { x: 0, y: 9720, text: "Phone 390×844, rem drawn at 20px", kind: "title1", maxW: 1440 },
}, designSystems: [] };
for (const [name, b] of Object.entries(boards)) {
  writeFileSync(OUT + name, b.html);
  index.boards[name] = { x: b.x, y: b.y, w: b.w, h: b.h, title: b.title };
  index.order.push(name);
}
writeFileSync(OUT + "canvas.json", JSON.stringify(index, null, 1));
console.log("wrote", Object.keys(boards).length, "artboards");
