// Build a JSON string just past 4 MiB: the builder's buffer grows its string from a
// 2-chunk run to a 3-chunk one in a move that scriptc's allocator must survive.
const lines = [];
for (let i = 0; i < 1760; i++) lines.push("x".repeat(2400));
const text = JSON.stringify(lines);
console.log(String(text.length));
console.log(text.slice(0, 8));
