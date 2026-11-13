/**
 * Which definitions `View.define` takes, held by the type checker:
 * `npm run typecheck` fails when a line below stops meaning what it says.
 */

import View, { defineComponent } from "../index.js";
import T from "../../types/index.js";

const label = defineComponent({
  tag: "fx-define-label",
  props: { text: T.string(), tone: T.string({ defaultValue: "plain", enum: ["plain", "loud"] }) },
  render() {
    return this.text;
  },
});

const counter = defineComponent({
  tag: "fx-define-counter",
  props: { count: 0, open: false },
  events: { change: T.object({ count: T.number() }) },
  render() {
    return String(this.count);
  },
});

for (const definition of [label, counter]) View.define(definition);

// @ts-expect-error a definition names its tag
View.define({ props: { count: 0 } });
