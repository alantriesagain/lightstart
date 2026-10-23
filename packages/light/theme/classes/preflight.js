/**
 * The minimal reset the utilities themselves rely on: everything else lives
 * in `@bootstrapp/light/theme`'s theme.css. The border reset is what makes a bare
 * `border` class mean "1px solid in the theme's border colour" without every
 * border utility re-stating style and colour.
 */

export const PREFLIGHT = `*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:var(--border-color,currentColor)}
::before,::after{--tw-content:''}`;
