/**
 * @lightstart/light/theme/tokens: the host-neutral half of the theme. The
 * color math that derives shades, readable "on" colors and a dark side, the
 * CSS variables a theme becomes, and a CSS color resolved to hex, with
 * nothing of a document in it, so a terminal reads the same tokens a page
 * does. `theme/index.js` applies them to a document; `theme/terminal.ts`
 * reads them for the terminal host.
 */
/** A theme: nested token groups (`color`, `spacing`, `font`, ...) whose leaves become `--group-key` variables, and an optional `dark` block of the same shape. */
                                                                                         

/** A font a theme names: a family string, or an object with the CSS family and the Google Fonts name to request (`google: false` requests none). */
                                                                              

                            
                     
                      
                         
 

/** How one shade derives from a base color: a lightness step, or a mix with white or black. */
                              
                     
               
                  
 

/** A color as hue (0 to 360), saturation and lightness (0 to 100). */
export class HSL {
  h        ;
  s        ;
  l        ;

  constructor(h        , s        , l        ) {
    this.h = h;
    this.s = s;
    this.l = l;
  }
}

/**
 * @param r 0-1
 * @param g 0-1
 * @param b 0-1
 */
export const rgbToHSL = (r        , g        , b        )      => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return new HSL(Math.round(h * 360), Math.round(s * 100), Math.round(l * 100));
};

export const hslToCSS = (hsl     )         => `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;

export const adjustLightness = (hsl     , delta        )      => new HSL(hsl.h, hsl.s, Math.max(0, Math.min(100, hsl.l + delta)));

/**
 * @param mixWith `"white"` or `"black"`
 * @param amount 0-1
 */
export const mixWithColor = (hsl     , mixWith        , amount        )      => {
  if (mixWith === "white") return new HSL(hsl.h, Math.round(hsl.s * (1 - amount * 0.5)), Math.round(hsl.l + (100 - hsl.l) * amount));
  if (mixWith === "black") return new HSL(hsl.h, Math.round(hsl.s * (1 - amount * 0.3)), Math.round(hsl.l * (1 - amount)));
  return hsl;
};

/** A hex, `rgb()` or `hsl()` color as HSL, or null for anything else. */
export const parseColor = (str         )             => {
  if (typeof str !== "string" || str.length === 0) return null;
  const s = str.trim();

  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return rgbToHSL(r, g, b);
  }

  if (s.startsWith("rgb")) {
    const match = s.match(/\d+/g);
    if (match === null || match.length < 3) return null;
    return rgbToHSL(Number(match[0]) / 255, Number(match[1]) / 255, Number(match[2]) / 255);
  }

  if (s.startsWith("hsl")) {
    const match = s.match(/[\d.]+/g);
    if (match === null || match.length < 3) return null;
    return new HSL(Math.round(parseFloat(match[0])), Math.round(parseFloat(match[1])), Math.round(parseFloat(match[2])));
  }

  return null;
};

export const generateShades = (baseHSL     , config                              = {})                         => {
  const defaultConfig                              = {
    lighter: { lightness: 20 },
    light: { lightness: 10 },
    dark: { lightness: -10 },
    darker: { lightness: -20 },
  };

  const shadeConfig                              = { ...defaultConfig, ...config };
  const shades                         = { DEFAULT: hslToCSS(baseHSL) };

  for (const [shadeName, shadeOpts] of Object.entries(shadeConfig)) {
    if (shadeName === "DEFAULT") continue;
    const mix = shadeOpts.mix;
    if (mix !== undefined) {
      const amount = shadeOpts.amount === undefined || shadeOpts.amount === 0 ? 0.3 : shadeOpts.amount;
      shades[shadeName] = hslToCSS(mixWithColor(baseHSL, mix, amount));
    } else if (shadeOpts.lightness !== undefined) shades[shadeName] = hslToCSS(adjustLightness(baseHSL, shadeOpts.lightness));
  }

  return shades;
};

const clamp = (n        , lo        , hi        ) => Math.max(lo, Math.min(hi, n));

const NEUTRAL_SATURATION = 12;

const transformColorToDark = (value        )         => {
  const hsl = parseColor(value);
  if (hsl === null) return value;
  if (hsl.s <= NEUTRAL_SATURATION) return hslToCSS(new HSL(hsl.h, hsl.s, clamp(100 - hsl.l, 6, 95)));
  const l = hsl.l < 45 ? hsl.l + 12 : hsl.l;
  return hslToCSS(new HSL(hsl.h, hsl.s, clamp(l, 42, 72)));
};

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

const recolorShadowToDark = (value        )         => value.replace(COLOR_TOKEN, (match) => transformColorToDark(match));

const transformLeafForDark = (value         )          => {
  if (typeof value !== "string") return value;
  if (parseColor(value) !== null) return transformColorToDark(value);
  if (/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/.test(value)) return recolorShadowToDark(value);
  return value;
};

const walkDark = (value         )          => {
  if (Array.isArray(value)) return value.map((item) => walkDark(item));
  if (value !== null && typeof value === "object") {
    const out                          = {};
    for (const [key, item] of Object.entries(value                           )) out[key] = walkDark(item);
    return out;
  }
  return transformLeafForDark(value);
};

/**
 * The dark side of a theme: neutrals invert, colors keep their hue and land in
 * a readable lightness band, shadows are recolored.
 */
export const generateDarkTheme = (themeObj           )            => walkDark(themeObj)             ;

/** Whether a theme is dark already, by its canvas or surface. */
export const isDarkBase = (themeObj           )          => {
  const theme = themeObj                                                                        ;
  const canvas = theme.canvas === undefined ? undefined : theme.canvas.background;
  const surface = theme.color === undefined ? undefined : theme.color.surface;
  for (const candidate of [canvas, surface]) {
    const hsl = parseColor(typeof candidate === "string" ? candidate : "");
    if (hsl !== null) return hsl.l < 50;
  }
  return false;
};

export const deepMerge = (base                         , override         )                          => {
  if (override === null || typeof override !== "object") return base;
  const out                          = { ...base };
  for (const [key, value] of Object.entries(override                           )) {
    const had = out[key];
    out[key] = value !== null && typeof value === "object" && !Array.isArray(value) && had !== undefined && had !== null && typeof had === "object" ? deepMerge(had                           , value) : value;
  }
  return out;
};

const isTranslucent = (value        )          => {
  const s = value.trim();
  return /^(rgba|hsla)\(/.test(s) || /^#[0-9a-f]{4}$|^#[0-9a-f]{8}$/i.test(s);
};

const srgbToLinear = (channel        ) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

/** A hex or `rgb()` color as 0-1 channels, or null if unreadable. */
const toRGB = (value        )                  => {
  const s = value.trim();
  if (s.startsWith("#")) {
    const hex = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1, 7);
    if (hex.length !== 6) return null;
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  if (s.startsWith("rgb")) {
    const parts = s.match(/[\d.]+/g);
    if (parts === null || parts.length < 3) return null;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255];
  }
  return null;
};

/**
 * Black or white, whichever can be read on the given colour. A `var()`
 * reference or a translucent fill cannot be judged from here and gets neither.
 */
export const readableOn = (value        )                => {
  if (isTranslucent(value)) return null;
  const rgb = toRGB(value);
  if (rgb === null) return null;
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
};

export const SHADE_SUFFIXES = ["lighter", "light", "dark", "darker"];

/**
 * The CSS variables a theme becomes: `{ color: { primary } }` gives
 * `--color-primary`, plus derived shades and readable `on-` colors for every
 * opaque palette color the theme does not spell out.
 */
export const generateThemeVariables = (themeObj                         , prefix = "-")                         => {
  const variables                         = {};

  const traverse = (obj                         , currentKey        ) => {
    for (const [key, value] of Object.entries(obj)) {
      const newKey = currentKey.length > 0 ? `${currentKey}-${key}` : `${prefix}-${key}`;
      const isColorBlock = currentKey === `${prefix}-color`;

      if (typeof value === "object" && value !== null) traverse(value                           , newKey);
      else {
        variables[newKey] = value          ;

        if (isColorBlock && typeof value === "string") {
          const isVariant = SHADE_SUFFIXES.some((suffix) => key.endsWith(`-${suffix}`));
          if (!isVariant && !isTranslucent(value)) {
            const baseHSL = parseColor(value);
            if (baseHSL !== null) {
              const generatedShades = generateShades(baseHSL);
              for (const shade of SHADE_SUFFIXES) if (obj[`${key}-${shade}`] === undefined) variables[`${newKey}-${shade}`] = generatedShades[shade];
            }
          }

          if (!isVariant && !key.startsWith("on-") && obj[`on-${key}`] === undefined) {
            const readable = readableOn(value);
            if (readable !== null) variables[`${currentKey}-on-${key}`] = readable;
          }
        }
      }
    }
  };

  traverse(themeObj, "");
  return variables;
};

/** 0-1 channels for an HSL color. */
export const hslToRGB = (hsl     )           => {
  const h = (((hsl.h % 360) + 360) % 360) / 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t        ) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
};

/** `#rrggbb` for 0-1 channels. */
export const rgbToHex = (r        , g        , b        )         => {
  const hex = (c        ) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, "0");
  return "#" + hex(r) + hex(g) + hex(b);
};

/**
 * A CSS color as `#rrggbb`, its alpha dropped: hex of 3, 4, 6 or 8 digits,
 * `rgb()`/`rgba()`, `hsl()`/`hsla()`. Null for anything else (a keyword, a
 * `var()`, a gradient).
 */
export const cssColorToHex = (value        )                => {
  const s = value.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split("").map((c) => c + c).join("");
    else if (hex.length === 8) hex = hex.slice(0, 6);
    if (hex.length !== 6 || Number.isNaN(Number.parseInt(hex, 16))) return null;
    return "#" + hex.toLowerCase();
  }
  if (s.startsWith("rgb")) {
    const rgb = toRGB(s);
    return rgb === null ? null : rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  if (s.startsWith("hsl")) {
    const hsl = parseColor(s);
    if (hsl === null) return null;
    const rgb = hslToRGB(hsl);
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  return null;
};

/** The theme without its `dark` block. */
export const lightSideOf = (theme           )            => {
  const out                          = {};
  for (const [key, value] of Object.entries(theme)) if (key !== "dark") out[key] = value;
  return out             ;
};

/**
 * The dark side a light theme and its explicit `dark` block give: the light
 * side itself for a theme that is dark already and spells no dark block out,
 * else the derived dark theme with the explicit block laid over it.
 */
export const darkFrom = (light           , explicitDark                       )            => {
  const hasExplicit = explicitDark !== undefined && Object.keys(explicitDark).length > 0;
  if (!hasExplicit && isDarkBase(light)) return light;
  const auto = generateDarkTheme(light)                           ;
  return (hasExplicit ? deepMerge(auto, explicitDark) : auto)             ;
};

/** The dark side of a whole theme, `dark` block included. */
export const darkSideOf = (theme           )            => darkFrom(lightSideOf(theme), theme.dark);

/** The variables of one side of a theme: `"dark"` for the dark side, anything else for the light one. */
export const variablesFor = (theme           , scheme        )                         => generateThemeVariables(scheme === "dark" ? darkSideOf(theme) : lightSideOf(theme));
