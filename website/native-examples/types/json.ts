interface Order {
  id: number;
  items: { sku: string; qty: number }[];
}

const text = JSON.stringify({ id: 7, items: [{ sku: "a", qty: 2 }, { sku: "b", qty: 3 }] });

function quantity(json: string): number {
  const order = JSON.parse(json) as Order;
  let qty = 0;
  for (const item of order.items) qty += item.qty;
  return qty;
}

const start = performance.now();
let total = 0;
for (let i = 0; i < 100_000; i++) total += quantity(text);
console.log(total, JSON.stringify(JSON.parse(text) as Order));
console.error(`${(performance.now() - start).toFixed(1)} ms`);
