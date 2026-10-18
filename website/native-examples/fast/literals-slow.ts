type Op = "add" | "sub" | "mul";

function apply(op: Op, a: number, b: number): number {
  switch (op) {
    case "add":
      return a + b;
    case "sub":
      return a - b;
    case "mul":
      return a * b;
  }
}

const ops: Op[] = [];
for (let i = 0; i < 1000; i++) ops.push(i % 3 === 0 ? "add" : i % 3 === 1 ? "sub" : "mul");

const start = performance.now();
let acc = 0;
for (let round = 0; round < 10_000; round++) for (const op of ops) acc = apply(op, acc, 3) % 1000;
console.log(acc);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
