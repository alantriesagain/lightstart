const input: unknown = JSON.parse('{"name":"light","stars":"many"}');
const config = input as { name: string; stars: number };
console.log(config.name.toUpperCase());
console.log(config.stars + 1);
