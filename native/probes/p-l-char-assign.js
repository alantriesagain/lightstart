/**
 * @file Probe L: a single character read by index out of a string, stored on an object field by
 * assignment, by `+=`, and by concatenation with an empty string, then read back after the loop.
 */

class Attr {
  constructor() {
    this.name = "";
    this.value = "";
    this.other = "";
  }
}

const q = "padding=2 x";
const a = new Attr();
for (let i = 0; i < q.length; i++) {
  const c = q[i];
  if (c === "=") {
    a.value = q[i + 1];
    a.other = "" + q[i + 1];
    break;
  }
  a.name += c;
}
let appended = "";
for (let i = 0; i < 3; i++) appended += q[i];
console.log(JSON.stringify(a.name), JSON.stringify(a.value), JSON.stringify(a.other), JSON.stringify(appended));

export {};
