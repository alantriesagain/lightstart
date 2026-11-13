/**
 * @file The api `light build` opens to extensions: the ordered step list, the resolved options, the
 * mode steps read and the data they share. It widens `Extensions`, as hooks widen `Hooks`.
 */
import type {} from "@lightstart/cli";
import type { BuildStep } from "./types.ts";

/** The resolved options a build runs with; an extension may change them during setup. */
export type BuildExtensionOptions = {
  root: string;
  page: string;
  outDir: string;
  minify: boolean;
  keep: number;
};

const throwUnknown = (name: string, names: readonly string[]): never => {
  throw new Error(`Unknown build step "${name}"; known steps: ${names.join(", ")}`);
};

/** The ordered steps of one build, named so an extension can insert, replace and remove them. */
export class BuildSteps {
  private steps: BuildStep[];

  constructor(steps: readonly BuildStep[]) {
    this.steps = [...steps];
  }

  /** Add a step before `write`, the last thing a build does. */
  add(step: BuildStep): void {
    const write = this.steps.findIndex((entry) => entry.name === "write");
    if (write === -1) this.steps.push(step);
    else this.steps.splice(write, 0, step);
  }

  /** Add a step just before the named one. */
  before(name: string, step: BuildStep): void {
    this.steps.splice(this.indexOf(name), 0, step);
  }

  /** Add a step just after the named one. */
  after(name: string, step: BuildStep): void {
    this.steps.splice(this.indexOf(name) + 1, 0, step);
  }

  /** Replace the named step, keeping its place in the list. */
  replace(name: string, step: BuildStep): void {
    this.steps[this.indexOf(name)] = step;
  }

  /** Remove the named step. */
  remove(name: string): void {
    this.steps.splice(this.indexOf(name), 1);
  }

  /** Every step name, in order. */
  names(): string[] {
    return this.steps.map((step) => step.name);
  }

  /** The steps in order, for the runner. */
  list(): readonly BuildStep[] {
    return [...this.steps];
  }

  private indexOf(name: string): number {
    const index = this.steps.findIndex((step) => step.name === name);
    if (index === -1) throwUnknown(name, this.names());
    return index;
  }
}

/** What `light build` hands an extension. */
export type BuildExtension = {
  steps: BuildSteps;
  options: BuildExtensionOptions;
  mode: string;
  data: Map<string, unknown>;
};

declare module "@lightstart/cli" {
  interface Extensions {
    build: BuildExtension;
  }
}
