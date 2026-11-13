/**
 * @file Render the global help, grouped by the source that contributed each command, and the help
 * of one command.
 */
import type { Registry } from "./registry.ts";

type HelpEntry = { name: string; description: string };

const optionLabel = (key: string, spec: unknown): string => {
  const value = spec as { flag?: boolean; positional?: boolean; rest?: boolean };
  if (value.flag) return `--${key}`;
  if (value.positional) return value.rest ? `<${key}...>` : `<${key}>`;
  return `--${key} <value>`;
};

/** The global help, or one command's when `commandName` is given. */
export const renderHelp = async (registry: Registry, name: string, commandName?: string): Promise<string> => {
  if (commandName) {
    const record = await registry.loadCommand(commandName);
    if (!record) return `Unknown command: ${commandName}`;
    const { command } = record;
    const lines = [
      `${commandName}: ${command.description}`,
      "",
      command.usage ? `Usage: ${command.usage}` : `Usage: ${name} ${commandName} [options]`,
    ];
    if (command.aliases && command.aliases.length) lines.push("", `Aliases: ${command.aliases.join(", ")}`);
    if (command.args && Object.keys(command.args).length) {
      lines.push("", "Options:");
      for (const [key, spec] of Object.entries(command.args)) {
        const desc = (spec as { description?: string }).description ?? "";
        lines.push(`  ${optionLabel(key, spec).padEnd(24)} ${desc}`);
      }
    }
    return lines.join("\n");
  }

  const grouped = new Map<string, HelpEntry[]>();
  for (const commandName of registry.listCommandNames()) {
    const record = await registry.loadCommand(commandName);
    if (!record || record.command.hidden) continue;
    if (record.command.aliases && record.command.aliases.includes(commandName)) continue;
    const group = record.source.name;
    const entries = grouped.get(group) ?? [];
    entries.push({ name: commandName, description: record.command.description });
    grouped.set(group, entries);
  }

  const lines = [`${name} CLI`, "", `Usage: ${name} <command> [args]`, ""];
  const groups: string[] = [];
  for (const group of grouped.keys()) groups.push(group);
  groups.sort();
  for (const group of groups) {
    lines.push(`${group}:`);
    const entries = grouped.get(group) ?? [];
    entries.sort((a: HelpEntry, b: HelpEntry): number => a.name.localeCompare(b.name));
    for (const { name: commandName, description } of entries) lines.push(`  ${commandName.padEnd(24)} ${description}`);
    lines.push("");
  }
  lines.push(`Run "${name} <command> --help" for command-specific help.`);
  return lines.join("\n");
};
