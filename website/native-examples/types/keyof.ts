interface Settings {
  width: number;
  height: number;
  depth: number;
}

function bump(settings: Settings, key: keyof Settings): void {
  settings[key] = settings[key] + 1;
}

const keys: (keyof Settings)[] = ["width", "height", "depth"];
const settings: Settings = { width: 0, height: 0, depth: 0 };

const start = performance.now();
for (let i = 0; i < 10_000_000; i++) bump(settings, keys[i % 3]!);
console.log(settings.width + settings.height + settings.depth);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
