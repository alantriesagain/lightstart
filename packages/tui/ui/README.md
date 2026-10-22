# @light/ui

The pieces the views of the packages draw with. `palette.ts`: `Palette`, the colors by what they mean, and `palette`, the one instance the process draws with; the views read its fields when they render, and an app sets at start the fields it wants otherwise (the defaults are widecode's look); `colorOr` turns "" into light's "default". `duration.ts`: `span` (a call's time), `clock` (a running clock), `took` (a turn's footer) and `stamp` (a message's time and date, the date month first where the locale is the US). `text.ts`: word wrap over styled runs with a hanging indent, and `clipText`. `line-view.ts`: light's windowed `LineView` with the palette's scrollbar colors, and light's `Line`, `Run`, `LineSource`, `LinePress`, `LineCopy` and `lineTemplate` re-exported for the views. `clipboard.ts`: the clipboard through OSC 52 or a tool (xclip, xsel, wl-copy), chosen by a mode.

Tests: `test/clipboard.test.ts`, `test/scrollbar.test.ts` (`light-native test ui`).
