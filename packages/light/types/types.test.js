import assert from "node:assert/strict";
import { describe, it } from "node:test";
import T, { cloneDefault, isDescriptor, isReactive, normalizeProperties, normalizeProperty, parse, parsers } from "./index.js";

describe("light/types: descriptors", () => {
  it("reads attributes for scalars, not for arrays, objects and functions", () => {
    for (const type of ["string", "number", "boolean", "any"]) assert.equal(T[type]().attribute, true, type);
    for (const type of ["array", "object", "function"]) assert.equal(T[type]().attribute, false, type);
  });

  it("takes an options object or a bare default", () => {
    assert.deepEqual(T.string("hi"), { $type: "string", persist: true, attribute: true, defaultValue: "hi" });
    assert.deepEqual(T.array([1]), { $type: "array", persist: true, attribute: false, defaultValue: [1] });
    assert.equal(T.number({ defaultValue: 3, sync: "local" }).sync, "local");
  });

  it("makes reactive: false a plain field without an attribute, and refuses accessors on it", () => {
    const field = T.object({ reactive: false });
    assert.equal(field.attribute, false);
    assert.equal(isReactive(field), false);
    assert.equal(isReactive(T.object()), true);
    assert.throws(() => T.string({ reactive: false, getter: () => "x" }), /reactive:false/);
  });

  it("clones an object default and calls a factory default per field", () => {
    const shared = { a: 1 };
    assert.notEqual(cloneDefault({ defaultValue: shared }), shared);
    assert.deepEqual(cloneDefault({ defaultValue: () => [1] }), [1]);
    assert.equal(cloneDefault({ defaultValue: 2 }), 2);
  });
});

describe("light/types: the shorthand", () => {
  it("tells a descriptor by $type, so a plain object is a default", () => {
    assert.equal(isDescriptor(T.string()), true);
    assert.equal(isDescriptor({ $type: "color" }), true);
    assert.equal(isDescriptor({ type: "x", defaultValue: 1 }), false);
    assert.equal(isDescriptor(null), false);
    assert.equal(isDescriptor(3), false);
  });

  it("reads the type off a bare default", () => {
    assert.deepEqual(normalizeProperty(0), T.number(0));
    assert.deepEqual(normalizeProperty("Clicks"), T.string("Clicks"));
    assert.deepEqual(normalizeProperty(false), T.boolean(false));
    assert.deepEqual(normalizeProperty([1, 2]), T.array({ defaultValue: [1, 2] }));
    assert.deepEqual(normalizeProperty({ a: 1 }), T.object({ defaultValue: { a: 1 } }));
    assert.deepEqual(normalizeProperty(null), T.any({ defaultValue: null }));
    assert.deepEqual(normalizeProperty(undefined), T.any({ defaultValue: undefined }));
    const fn = () => 1;
    assert.deepEqual(normalizeProperty(fn), T.function({ defaultValue: fn }));
  });

  it("keeps a descriptor as it is, nested blocks normalised", () => {
    const plain = T.number({ defaultValue: 1, sync: "local" });
    assert.equal(normalizeProperty(plain), plain);
    const nested = normalizeProperty(T.object({ props: { count: 0, inner: T.string("x") } }));
    assert.deepEqual(nested.props, { count: T.number(0), inner: T.string("x") });
    const items = normalizeProperty(T.array({ itemType: { id: 0, label: "" } }));
    assert.deepEqual(items.itemType, { id: T.number(0), label: T.string("") });
    const single = normalizeProperty(T.array({ itemType: T.number() }));
    assert.deepEqual(single.itemType, T.number());
  });

  it("normalises a whole block", () => {
    assert.deepEqual(normalizeProperties({ count: 0, open: T.boolean() }), { count: T.number(0), open: T.boolean() });
  });
});

describe("light/types: parse", () => {
  it("coerces attribute strings to the declared type", () => {
    assert.equal(parse("", T.boolean()), true);
    assert.equal(parse("false", T.boolean()), false);
    assert.equal(parse("4", T.number()), 4);
    assert.equal(parse("null", T.string()), null);
    assert.deepEqual(parse("[1,2]", T.array()), [1, 2]);
    assert.deepEqual(parse("nope", T.array()), []);
    assert.deepEqual(parse('{"a":1}', T.object({ props: { b: T.number(2) } })), { a: 1, b: 2 });
  });

  it("fills an object input's missing nested defaults on the object itself, a key it has staying as it is", () => {
    const prop = T.object({ props: { b: T.number(2), c: T.string("x") } });
    const input = { a: 1, c: undefined };
    const parsed = parse(input, prop);
    assert.equal(parsed, input);
    assert.deepEqual(Object.keys(input), ["a", "c", "b"]);
    assert.equal(input.b, 2);
    assert.equal(input.c, undefined);
  });

  it("coerces an array's object items by their declared keys", () => {
    const prop = normalizeProperty(T.array({ itemType: { n: T.number(), s: T.string() } }));
    assert.deepEqual(parse('[{"n":"4","s":"x"}]', prop), [{ n: 4, s: "x" }]);
  });

  it("passes a type without a parser through, and takes a host's parsers", () => {
    assert.equal(parse("x", T.createType("color")), "x");
    parsers.color = (value) => String(value).toUpperCase();
    try {
      assert.equal(parse("x", T.createType("color")), "X");
    } finally {
      delete parsers.color;
    }
  });
});
