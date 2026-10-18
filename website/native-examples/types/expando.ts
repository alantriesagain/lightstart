interface Item {
  name: string;
}

function tag(item: Item, index: number): void {
  (item as unknown as Record<string, unknown>)["slot" + (index % 4)] = index;
}

const items: Item[] = [];
for (let i = 0; i < 1000; i++) items.push({ name: `item ${i}` });

const start = performance.now();
for (let round = 0; round < 1000; round++) for (let i = 0; i < items.length; i++) tag(items[i]!, i + round);
console.log(Object.keys(items[0]!).join(","), (items[0] as unknown as Record<string, unknown>)["slot0"]);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
