/**
 * @file Probe AG: the shapes a terminal custom element needs. A subclass
 * declares props through a generic `prop(name, initial)` of its base that
 * stores a `Signal<unknown>` and answers it as `Signal<T>`; a prop set by
 * name from a string takes the prop's type; an effect on a prop sees the
 * set; a registry Map of class instances holding a factory makes an
 * instance by tag, whose class survives a base-typed and an unknown return.
 */
import { effect } from "../../signals/index.ts";
import { Def, Other, Sub, make, makeUnknown, registerDef } from "./p-ag-prop-signal.view.ts";

registerDef(new Def("x-sub", () => new Sub()));
registerDef(new Def("x-other", () => new Other()));

const made = make("x-sub");
if (made === null) throw new Error("x-sub not made");
const sub = made instanceof Sub ? made : null;
if (sub === null) throw new Error("x-sub is not a Sub through the base-typed return");
console.log("fresh:", sub.describe());

let seen = -1;
effect(() => {
  seen = sub.limit.value;
});
console.log("effect saw the initial value:", seen);

console.log("rows taken:", sub.$setProp("rows", ["a", "b"]), "limit from a string:", sub.$setProp("limit", "3"));
console.log("set:", sub.describe(), typeof sub.limit.value, "effect saw:", seen);
sub.$setProp("compact", true);
sub.$setProp("label", true);
console.log("bare attributes:", sub.describe());
sub.$setProp("compact", "false");
sub.$setProp("limit", 7);
console.log("typed again:", sub.describe());
console.log("undeclared:", sub.$setProp("missing", 1), "same value notifies nothing:", (sub.$setProp("limit", 7), seen));
console.log("the view writes its own prop:", sub.bump(), "effect saw:", seen, "rows typed:", sub.rows.value.length, sub.rows.peek()[0]);

const other = makeUnknown("x-other");
console.log("through unknown:", other instanceof Other, other instanceof Sub, make("x-none") === null, makeUnknown("x-none") === null);
const again = make("x-sub");
console.log("a second instance has its own props:", again !== null && again instanceof Sub && again.describe());
let threw = "";
try {
  sub.prop("limit", 1);
} catch (error) {
  threw = error instanceof Error ? error.message : String(error);
}
console.log("declared twice:", threw);
