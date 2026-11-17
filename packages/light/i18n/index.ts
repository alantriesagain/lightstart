/**
 * @file @lightstart/light/i18n: the translation a host's components read, as
 * `@lightstart/light/navigation` is the router they read. A component asks for
 * the sentence a key has, the language the reader is in and the languages on
 * offer, and may change the language; whatever library holds the sentences
 * plugs in with `configureTranslation`. Without one, a component keeps its own
 * words and the language is the document's. A render that asks for a sentence
 * or the language draws again when the language changes.
 */
import { signal } from "../signals/index.ts";

/** What a translation library answers the engine. */
export interface Translation {
  /** The sentence for `key` in the current language, or undefined when there is none (the component keeps its own). */
  translate(key: string, params?: Record<string, unknown>): string | undefined;
  /** The language the reader is in: a tag such as `en` or `pt-BR`. */
  language(): string;
  /** The languages on offer, the current one among them. */
  languages(): string[];
  /** Change the language; the library calls its subscribers once it has. */
  setLanguage(language: string): void | Promise<unknown>;
  /** Called after every change of language; answers the unsubscribe. */
  subscribe(fn: () => void): () => void;
}

const documentLanguage = (): string => {
  const lang = (globalThis as { document?: { documentElement?: { lang?: unknown } } }).document?.documentElement?.lang;
  return typeof lang === "string" && lang.length > 0 ? lang : "en";
};

class Plain implements Translation {
  translate(_key: string, _params?: Record<string, unknown>): string | undefined {
    return undefined;
  }

  language(): string {
    return documentLanguage();
  }

  languages(): string[] {
    return [documentLanguage()];
  }

  setLanguage(_language: string): void {
    return;
  }

  subscribe(_fn: () => void): () => void {
    return () => {};
  }
}

/** A provider's members, the plain ones where it has none. */
class Provided implements Translation {
  private readonly provider: Partial<Translation>;

  constructor(provider: Partial<Translation>) {
    this.provider = provider;
  }

  translate(key: string, params?: Record<string, unknown>): string | undefined {
    return this.provider.translate !== undefined ? this.provider.translate(key, params) : undefined;
  }

  language(): string {
    return this.provider.language !== undefined ? this.provider.language() : documentLanguage();
  }

  languages(): string[] {
    return this.provider.languages !== undefined ? this.provider.languages() : [this.language()];
  }

  setLanguage(language: string): void | Promise<unknown> {
    if (this.provider.setLanguage !== undefined) return this.provider.setLanguage(language);
  }

  subscribe(fn: () => void): () => void {
    return this.provider.subscribe !== undefined ? this.provider.subscribe(fn) : () => {};
  }
}

let host: Translation = new Plain();
let unsubscribe: () => void = () => {};
/** Bumped on every change of language, so a render that read the translation follows it. */
const changes = signal(0);

const changed = (): void => {
  changes.value = changes.peek() + 1;
};

/**
 * Hand the engine a translation library: a plain object or a class instance
 * whose members live on its prototype. Missing members keep the plain
 * behaviour. Its changes of language draw the renders that read it again.
 */
export const configureTranslation = (provider: Partial<Translation>): void => {
  unsubscribe();
  host = new Provided(provider);
  unsubscribe = host.subscribe(changed);
  changed();
};

/** The translation as components read it: each read follows the changes of language. */
class Reading implements Translation {
  translate(key: string, params?: Record<string, unknown>): string | undefined {
    void changes.value;
    return host.translate(key, params);
  }

  language(): string {
    void changes.value;
    return host.language();
  }

  languages(): string[] {
    void changes.value;
    return host.languages();
  }

  setLanguage(language: string): void | Promise<unknown> {
    return host.setLanguage(language);
  }

  subscribe(fn: () => void): () => void {
    return host.subscribe(fn);
  }
}

/** The translation components read. */
export const translation: Translation = new Reading();
