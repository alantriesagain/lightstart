import "./install.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { html } from "../html/core.ts";
import { signal } from "../signals/index.ts";
import View, { defineComponent } from "../dom/view.js";
import { renderToStringAsync } from "./index.js";

const count = signal("one");

class ChildView extends View {
  static props = { label: "" };

  render() {
    return html`<span class="child">${this.label}:${count.value}</span>`;
  }
}

View.register("x-test-child", ChildView);

View.define(
  defineComponent({
    tag: "x-test-card",
    props: { title: "" },
    render() {
      return html`<section><h2>${this.title}</h2><x-test-child .label=${"child"}></x-test-child></section>`;
    },
  }),
);

describe("renderToStringAsync with views", () => {
  it("renders a defined view and a nested registered view with the engine's markers", async () => {
    const out = await renderToStringAsync(html`<x-test-card title="A"></x-test-card>`);
    assert.match(out, /^<!--\$r--><x-test-card title="A" class="x-test-card"><!--\$r-->/);
    assert.ok(out.includes("<h2><!--$-->A<!--/--></h2>"));
    assert.ok(out.includes('<x-test-child label="child"><!--$r--><span class="child"><!--$-->child<!--/-->:<!--$-->one<!--/--></span><!--/r--></x-test-child>'));
    assert.ok(out.endsWith("<!--/r--></x-test-card><!--/r-->"));
  });

  it("reports a rejected async lifecycle hook through onError", async () => {
    View.define(
      defineComponent({
        tag: "x-test-rejecter",
        render() {
          return html`<p>kept</p>`;
        },
        async connected() {
          throw new Error("async hook failed");
        },
      }),
    );
    const errors = [];
    const out = await renderToStringAsync(html`<x-test-rejecter></x-test-rejecter>`, { onError: (error) => errors.push(error) });
    assert.ok(out.includes("<p>kept</p>"));
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /async hook failed/);
  });

  it("reports a throwing lifecycle hook without stopping the render", async () => {
    View.define(
      defineComponent({
        tag: "x-test-thrower",
        render() {
          return html`<p>kept</p>`;
        },
        updated() {
          throw new Error("no such DOM member");
        },
      }),
    );
    const errors = [];
    const out = await renderToStringAsync(html`<x-test-thrower></x-test-thrower>`, { onError: (error) => errors.push(error) });
    assert.ok(out.includes("<p>kept</p>"));
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /no such DOM member/);
  });
});
