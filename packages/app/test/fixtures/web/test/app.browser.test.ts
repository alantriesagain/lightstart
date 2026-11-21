import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineApp } from "@lightstart/app";
import type { AppManifest } from "@lightstart/app/manifest.ts";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("openPage", () => {
  it("mounts the root view at a path and adds a note through its controller", async () => {
    const page = await openPage(manifest, { path: "/about" });
    try {
      assert.equal(page.root.tagName.toLowerCase(), "app-root");
      assert.ok((await page.shows("About")).includes("About"), "the about route is drawn");

      const button = await page.find("app-root button");
      button.click();
      assert.ok((await page.shows("note 1")).includes("note 1"), "the note is listed");
    } finally {
      await page.stop();
    }
  });

  it("takes its arguments from the test and goes to another route", async () => {
    const withArgs = defineApp({ name: "fixture-web", host: "web", args: { greeting: { default: "hi" } } });
    const page = await openPage({ ...manifest, app: withArgs } as AppManifest, { args: { greeting: "hello" } });
    try {
      assert.equal(page.run.app.args.string("greeting"), "hello");
      await page.navigate("/");
      assert.ok((await page.shows("Home")).includes("Home"), "the home route is drawn");
      await page.navigate("/about");
      assert.ok((await page.shows("About")).includes("About"), "and the about route again");
    } finally {
      await page.stop();
    }
  });

  it("pins the page dark from defineApp and restores it when it stops", async () => {
    const light = await openPage(manifest);
    const lightCanvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas-background").trim();
    await light.stop();

    const dark = { ...manifest, app: defineApp({ name: "fixture-web", host: "web", scheme: "dark" }) } as AppManifest;
    const html = document.documentElement;
    const page = await openPage(dark);
    try {
      assert.equal(html.classList.contains("dark"), true, "the dark class is on <html>");
      assert.equal(html.style.colorScheme, "dark");
      assert.notEqual(getComputedStyle(html).getPropertyValue("--canvas-background").trim(), lightCanvas, "the dark side is in effect");
    } finally {
      await page.stop();
    }
    assert.equal(html.classList.contains("dark"), false, "the class is gone after stop");
  });

  it("removes the root element when it stops", async () => {
    const page = await openPage(manifest);
    const root = page.root;
    await page.stop();
    assert.equal(root.isConnected, false);
    assert.equal(document.querySelector("app-root"), null);
  });
});

interface TransitionDocument {
  startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void> };
}

const stubTransitions = () => {
  const doc = document as unknown as TransitionDocument;
  const hadOwn = Object.prototype.hasOwnProperty.call(doc, "startViewTransition");
  const original = doc.startViewTransition;
  let calls = 0;
  doc.startViewTransition = (callback) => {
    calls += 1;
    let finish: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Promise.resolve(callback()).then(() => {
      finish();
    });
    return { finished };
  };
  return {
    calls: (): number => calls,
    restore: (): void => {
      if (hadOwn) doc.startViewTransition = original;
      else delete doc.startViewTransition;
    },
  };
};

const transitionsManifest = (): AppManifest =>
  ({ ...manifest, app: defineApp({ name: "fixture-web", host: "web", url: "https://fixture.example", transitions: true }) }) as AppManifest;

describe("navigation focus and page head", () => {
  it("moves focus to the new view's heading and announces the title", async () => {
    const page = await openPage(manifest);
    try {
      await page.navigate("/about");
      assert.equal(document.title, "About | fixture-web");
      const heading = document.querySelector("app-about h1");
      assert.ok(heading instanceof HTMLElement, "the about view has a heading");
      assert.equal(document.activeElement, heading, "focus moves to the heading");
      const region = document.querySelector("[data-light-live-region]");
      assert.ok(region instanceof HTMLElement, "the page has a live region");
      assert.equal(region.textContent, "About | fixture-web");
    } finally {
      await page.stop();
    }
  });

  it("leaves focus where it was when focusOnNavigate is false", async () => {
    const still = defineApp({ name: "fixture-web", host: "web", url: "https://fixture.example", focusOnNavigate: false });
    const page = await openPage({ ...manifest, app: still } as AppManifest);
    try {
      const before = document.activeElement;
      await page.navigate("/about");
      assert.equal(document.activeElement, before, "focus did not move");
      assert.equal(document.title, "About | fixture-web");
    } finally {
      await page.stop();
    }
  });
});

describe("view transitions", () => {
  it("runs a route change inside document.startViewTransition when the app asks", async () => {
    const stub = stubTransitions();
    const page = await openPage(transitionsManifest());
    try {
      await page.navigate("/about");
      assert.equal(stub.calls(), 1, "one transition wraps the navigation");
      assert.ok((await page.shows("About")).includes("About"), "the next view is drawn");
    } finally {
      await page.stop();
      stub.restore();
    }
  });

  it("skips the transition for a call that asks to", async () => {
    const stub = stubTransitions();
    const page = await openPage(transitionsManifest());
    try {
      await page.navigate("/about", { transition: false });
      assert.equal(stub.calls(), 0, "no transition wraps the navigation");
      assert.ok((await page.shows("About")).includes("About"), "the next view is still drawn");
    } finally {
      await page.stop();
      stub.restore();
    }
  });

  it("navigates plainly where the browser has no view transition", async () => {
    const doc = document as unknown as TransitionDocument;
    const hadOwn = Object.prototype.hasOwnProperty.call(doc, "startViewTransition");
    const original = doc.startViewTransition;
    doc.startViewTransition = undefined;
    const page = await openPage(transitionsManifest());
    try {
      await page.navigate("/about");
      assert.ok((await page.shows("About")).includes("About"), "the navigation still lands");
    } finally {
      await page.stop();
      if (hadOwn) doc.startViewTransition = original;
      else delete doc.startViewTransition;
    }
  });

  it("draws the next view inside the browser's own view transition, without waiting on a frame", async () => {
    const doc = document as unknown as TransitionDocument;
    if (typeof doc.startViewTransition !== "function") return;
    const page = await openPage(transitionsManifest());
    try {
      await page.navigate("/about");
      // A transition pauses rendering until its callback settles; a callback waiting on a frame would time out after seconds.
      assert.ok((await page.shows("About", { timeout: 1000 })).includes("About"), "the next view is on the page right away");
    } finally {
      await page.stop();
    }
  });

  it("uses the app's choice unless one call overrides it", async () => {
    const stub = stubTransitions();
    const page = await openPage(manifest);
    try {
      await page.navigate("/about");
      assert.equal(stub.calls(), 0, "an app without transitions runs plainly");
      await page.navigate("/", { transition: true });
      assert.equal(stub.calls(), 1, "one call can ask for a transition");
      assert.ok((await page.shows("Home")).includes("Home"), "the next view is drawn");
    } finally {
      await page.stop();
      stub.restore();
    }
  });
});

const morphLabels = (): string[] => {
  const labels: string[] = [];
  for (const element of document.querySelectorAll("body *")) {
    if (!(element instanceof HTMLElement) || element.style.viewTransitionName !== "morph") continue;
    if (element.matches("app-home .morph-link")) labels.push("home-link");
    else if (element.matches("app-about [data-morph]")) labels.push("about-morph");
    else labels.push(element.tagName.toLowerCase());
  }
  return labels;
};

interface MorphRun {
  before: string[];
  after: string[];
}

const stubMorph = () => {
  const doc = document as unknown as TransitionDocument;
  const hadOwn = Object.prototype.hasOwnProperty.call(doc, "startViewTransition");
  const original = doc.startViewTransition;
  const runs: MorphRun[] = [];
  doc.startViewTransition = (callback) => {
    const before = morphLabels();
    let finish: () => void = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Promise.resolve(callback()).then(() => {
      runs.push({ before, after: morphLabels() });
      finish();
    });
    return { finished };
  };
  return {
    runs,
    restore: (): void => {
      if (hadOwn) doc.startViewTransition = original;
      else delete doc.startViewTransition;
    },
  };
};

describe("morphing view transitions", () => {
  it("names the clicked link, then the next view's data-morph element, and clears both", async () => {
    const stub = stubMorph();
    const page = await openPage(transitionsManifest());
    try {
      const link = await page.find("app-home .morph-link");
      link.click();
      assert.ok((await page.shows("About")).includes("About"), "the next view is drawn");
      await page.settle();
      assert.equal(stub.runs.length, 1, "one transition ran");
      assert.deepEqual(stub.runs[0]?.before, ["home-link"], "the clicked link carries the name before the update");
      assert.deepEqual(stub.runs[0]?.after, ["about-morph"], "the next view's data-morph element carries it after");
      await page.settle();
      assert.deepEqual(morphLabels(), [], "no element keeps the name once the transition settles");
    } finally {
      await page.stop();
      stub.restore();
    }
  });

  it("morphs from the element navigate names", async () => {
    const stub = stubMorph();
    const page = await openPage(transitionsManifest());
    try {
      const link = await page.find("app-home .morph-link");
      await page.navigate("/about", { from: link });
      assert.ok((await page.shows("About")).includes("About"), "the next view is drawn");
      assert.equal(stub.runs.length, 1, "one transition ran");
      assert.deepEqual(stub.runs[0]?.before, ["home-link"], "the named element carries the name before the update");
      assert.deepEqual(stub.runs[0]?.after, ["about-morph"], "the next view's data-morph element carries it after");
      await page.settle();
      assert.deepEqual(morphLabels(), [], "no element keeps the name once the transition settles");
    } finally {
      await page.stop();
      stub.restore();
    }
  });

  it("sets no morph name under prefers-reduced-motion", async () => {
    const stub = stubMorph();
    const win = globalThis as unknown as { matchMedia: (query: string) => MediaQueryList };
    const original = win.matchMedia;
    win.matchMedia = (query: string) => ({ ...original.call(globalThis, query), matches: query.includes("prefers-reduced-motion"), media: query } as MediaQueryList);
    const page = await openPage(transitionsManifest());
    try {
      const link = await page.find("app-home .morph-link");
      link.click();
      assert.ok((await page.shows("About")).includes("About"), "the next view is drawn");
      await page.settle();
      assert.equal(stub.runs.length, 1, "the route change still runs a transition");
      assert.deepEqual(stub.runs[0]?.before, [], "nothing is named before the update");
      assert.deepEqual(stub.runs[0]?.after, [], "nothing is named after the update");
    } finally {
      await page.stop();
      stub.restore();
      win.matchMedia = original;
    }
  });
});

describe("a hash in the path", () => {
  it("scrolls to and focuses the element the hash names after a navigation", async () => {
    const proto = Element.prototype as unknown as { scrollIntoView: (this: Element) => void };
    const original = proto.scrollIntoView;
    const scrolled: string[] = [];
    proto.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    const page = await openPage(manifest);
    try {
      await page.navigate("/about#more");
      await page.shows("More");
      assert.ok(scrolled.includes("more"), `the named element was scrolled to: ${JSON.stringify(scrolled)}`);
      assert.equal(document.activeElement?.id, "more", "and it has the focus");
    } finally {
      await page.stop();
      proto.scrollIntoView = original;
    }
  });
});
