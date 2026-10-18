interface Item {
  price: number;
  quantity: number;
}

function total(items: Item[]): number {
  let sum = 0;
  for (const item of items) sum += item.price * item.quantity;
  return sum;
}

const items: Item[] = [];
for (let i = 0; i < 1000; i++) items.push({ price: i % 10, quantity: 2 });

const start = performance.now();
let result = 0;
for (let round = 0; round < 10_000; round++) result += total(items);
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
