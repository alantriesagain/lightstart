/**
 * @file Text as the views measure it: tabs stop on terminal cells (a wide character takes two),
 * wrapping moves words whole and breaks a word too long for the room, and clipping ends in "…".
 */
import { Run } from "@bootstrapp/light/native/tui/lines.ts";
import { clipText, expandTabs, wrap } from "../text.ts";
import { done, eq } from "@light/test/assert.ts";

const text = (lines: ReturnType<typeof wrap>): string => lines.map((l) => l.runs.map((r: Run) => r.text).join("").replace(/\s+$/, "")).join("|");

eq("tabs advance by terminal cells", expandTabs("猫\tx") + "|" + expandTabs("ab\tc"), "猫  x|ab  c");
eq("a word moves whole to the next line", text(wrap([new Run("one two three", "")], 7, [], [], "")), "one two|three");
eq("a word too long is broken by characters", text(wrap([new Run("abcdefgh", "")], 4, [], [], "")), "abcd|efgh");
eq("clipping ends with an ellipsis", clipText("abcdef", 4), "abc…");

done();
