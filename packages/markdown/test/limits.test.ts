/**
 * @file Limits: an adversarial inline or a deep document must parse in bounded time and without
 * overflowing the stack. Each case is built at 100,000 characters (or the line/level count its
 * shape needs) and must answer within a second; the quote tree must stop at MAX_NESTING containers.
 */
import { Block, List, Quote, parse } from "../index.ts";
import { budget, done, ok } from "@light/test/assert.ts";

const repeated = (part: string, size: number): string => {
  const parts: string[] = [];
  const count = Math.ceil(size / part.length);
  for (let i = 0; i < count; i++) parts.push(part);
  return parts.join("");
};

const run = (name: string, input: string): void => {
  const t0 = Date.now();
  let threw = false;
  try {
    parse(input);
  } catch {
    threw = true;
  }
  const ms = Date.now() - t0;
  ok(name, !threw && ms < budget(1000));
};

const containerDepth = (blocks: Block[], level: number): number => {
  let deepest = level;
  for (const block of blocks) {
    if (block instanceof Quote) {
      const d = containerDepth(block.blocks, level + 1);
      if (d > deepest) deepest = d;
    } else if (block instanceof List) {
      for (const item of block.items) {
        const d = containerDepth(item.blocks, level + 1);
        if (d > deepest) deepest = d;
      }
    }
  }
  return deepest;
};

run("[a]( repeated", repeated("[a](", 100000));
run("[[ repeated", repeated("[[", 100000));
run("[ repeated", repeated("[", 100000));
run("] repeated", repeated("]", 100000));
run("![a]( repeated", repeated("![a](", 100000));
run("[a](<b repeated: an angle destination never closed", repeated("[a](<b ", 100000));
run("[a](b ( repeated: a title in parentheses never closed", repeated("[a](b (", 100000));
run("[a]( ( repeated: parentheses in a destination never closed", repeated("[a](((", 100000));
run("*a repeated", repeated("*a ", 100000));
run("**a repeated", repeated("**a ", 100000));
run("_a repeated", repeated("_a ", 100000));
run("` repeated", repeated("`", 100000));
run("`a`` repeated", repeated("`a``", 100000));
run("<a repeated", repeated("<a ", 100000));
run("< repeated", repeated("<", 100000));
run("~~a repeated", repeated("~~a ", 100000));
run("\\ repeated", repeated("\\", 100000));
run("[a][ repeated", repeated("[a][", 100000));
run("[a]: /u lines", repeated("[a]: /u\n", 100000));
run("quotes then text", repeated(">", 100000) + " a");

// A level costs its own indent, so 100,000 characters hold about 300 levels, three times the cap.
const listLines: string[] = [];
for (let i = 0, size = 0; size < 100000; i++) {
  listLines.push(" ".repeat(i * 2) + "- a");
  size += i * 2 + 4;
}
run("nested list levels", listLines.join("\n"));

const quoteLines: string[] = [];
for (let i = 1, size = 0; size < 100000; i++) {
  quoteLines.push("> ".repeat(i) + "a");
  size += i * 2 + 2;
}
const quoteTree = parse(quoteLines.join("\n"));
run("nested quote levels", quoteLines.join("\n"));
ok("the quote tree stops at the nesting cap", containerDepth(quoteTree, 0) <= 100);
ok("the list tree stops at the nesting cap", containerDepth(parse(listLines.join("\n")), 0) <= 100);

run("- on one line", repeated("- ", 50000));
run("1. on one line", repeated("1. ", 25000));

const cells: string[] = [];
const rules: string[] = [];
for (let i = 0; i < 2000; i++) {
  cells.push("c" + String(i));
  rules.push("---");
}
const row = "| " + cells.join(" | ") + " |";
const rule = "| " + rules.join(" | ") + " |";
const rows: string[] = [row, rule];
for (let i = 0; i < 100; i++) rows.push(row);
run("a 2000-column table", rows.join("\n"));

done();
