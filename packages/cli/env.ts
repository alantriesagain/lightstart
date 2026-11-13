/**
 * @file The project's `.env`, and the logical working directory the shell names.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

/**
 * Load `<projectDir>/.env` into `process.env`. A variable already set wins over the file; quotes
 * around a value are stripped; `#` lines are skipped.
 */
export const loadEnv = (projectDir: string): void => {
  const envPath = join(projectDir, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (key && !process.env[key]) process.env[key] = value;
  }
};

/**
 * The working directory as the shell names it. `process.cwd()` answers the realpath, which inside
 * a symlinked workspace member points outside it; the shell's `PWD` keeps the logical path.
 */
export const logicalCwd = (): string => {
  const pwd = process.env.PWD;
  try {
    if (pwd && realpathSync(pwd) === process.cwd()) return pwd;
  } catch {}
  return process.cwd();
};
