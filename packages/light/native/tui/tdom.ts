/**
 * @bootstrapp/light/native/tui: the terminal host of the renderer, as one import.
 */
export { ATTR_BOLD, ATTR_DIM, ATTR_INVERSE, ATTR_ITALIC, ATTR_STRIKE, ATTR_UNDERLINE, COLOR_DEFAULT, DEFAULT_STYLE, Style, TRUECOLOR_FLAG, colorName } from "./style.ts";
export { colorDepth, colorDepthOf, colorSgr, parseColor, setColorDepth, to256 } from "./color.ts";
export type { ColorDepth } from "./color.ts";
export { ChangeEvent, CustomEvent, FocusEvent, KeyEvent, MouseEvent, SubmitEvent, UIEvent, WheelEvent } from "./events.ts";
export { focusables, hitTest, isFocusable, nextFocusable, scrollBoxOf } from "./focus.ts";
export { FLUSH_AFTER, FLUSH_RENDER, FLUSH_VIEWS, FrameScheduler, frames } from "./scheduler.ts";
export { HandlerEntry, TAnchor, TBox, TElement, TFragment, TInput, TNode, TRoot, TRun, TSpan, TText, asBool, asEnum, asNumber, asNumberOrNull, asString, childNodes, find } from "./node.ts";
export { EVENT_NAMES, TagDefinition, createElement, isDefinedTag, isKnownProp, isKnownTag, kindOf, registerTag } from "./tags.ts";
export { dumpTree, textOf } from "./dump.ts";
export { codePointWidth, graphemeWidth, graphemes, stringWidth } from "./width.ts";
export { Cell, InlineRun, WrappedLine, lineText, wrapRuns } from "./wrap.ts";
export { ScrollState, Size, TextLayout, arrange, forgetLayout, inlineRuns, inputRows, layout, measure, scrollBy, scrollStateOf, textLayoutOf } from "./layout.ts";
export { Caret, Clip, inputCaretCell, inputVisualRows, paint } from "./paint.ts";
export { Screen, diffScreens } from "./screen.ts";
export { ALT_SCREEN_OFF, ALT_SCREEN_ON, CLEAR, CSI, CURSOR_HIDE, CURSOR_SHOW, ESC, HOME, MOUSE_OFF, MOUSE_ON, PASTE_OFF, PASTE_ON, RESET, SYNC_END, SYNC_START, cup, sgrTransition } from "./ansi.ts";
export { InputDecoder } from "./input.ts";
export { backspace, clearInput, del, deleteWord, editorHandleKey, insertText, killToEnd, killToStart, lineEnd, lineStart, moveLeft, moveRight, moveRow, newline, setValue, submit, wordLeft, wordRight } from "./editor.ts";
export { Terminal } from "./terminal.ts";
export { Renderer } from "./renderer.ts";
export { TermHost, TermPrepared } from "./host.ts";
export { ClassProp, ClassStyler, STATE_FOCUS, STATE_FOCUS_WITHIN, applyClassProps, classStyler, configureClasses, propBit, reapplyClasses, setStates } from "./classes.ts";
export { TSlotPart, projectSlots, rootStart } from "./slots.ts";
export { Prop, View, define, mount, unmount } from "./view.ts";
export { Line, LineSource, Run } from "./lines.ts";
export { LineCopy, LinePress, LineView, lineTemplate } from "./line-view.ts";
export { copyRows, rowText, selectRuns, sliceCells } from "./selection.ts";
export { Thumb, barCell, thumbOf, topAt } from "./scrollbar.ts";
export { SPINNER, TICK_MS, onTick, spinnerAt } from "./ticks.ts";
