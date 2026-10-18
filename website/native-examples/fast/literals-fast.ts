const ADD = 0;
const SUB = 1;
const MUL = 2;
type Op = typeof ADD | typeof SUB | typeof MUL;

function apply(op: Op, a: number, b: number): number {
  switch (op) {
    case ADD:
      return a + b;
    case SUB:
      return a - b;
    case MUL:
      return a * b;
  }
}

const ops: Op[] = [];
for (let i = 0; i < 1000; i++) ops.push(i % 3 === 0 ? ADD : i % 3 === 1 ? SUB : MUL);

const start = performance.now();
let acc = 0;
for (let round = 0; round < 10_000; round++) for (const op of ops) acc = apply(op, acc, 3) % 1000;
console.log(acc);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
