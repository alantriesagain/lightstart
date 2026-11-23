// node-only
/**
 * @file The result target: the intent filters and BuildConfig paths a config
 * with `capture`, `pick`, both, or image-only types writes.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, ok } from "@lightstart/test/assert.ts";
import { resolveMobile } from "../node/config.ts";
import { writeAndroid } from "../node/template.ts";
import type { MobileResultTarget } from "../index.ts";

const write = (target: MobileResultTarget): string => {
  const project = mkdtempSync(join(tmpdir(), "light-mobile-result-"));
  writeAndroid(project, resolveMobile({ appId: "com.example.app", resultTarget: target }, { name: "app", base: "" }), 36, []);
  return project;
};

const read = (project: string, path: string): string => readFileSync(join(project, "mobile", "android", path), "utf8");

const main = (): void => {
  const capture = write({ capture: "/camera" });
  try {
    const manifest = read(capture, "app/src/main/AndroidManifest.xml");
    const gradle = read(capture, "app/build.gradle");
    ok("a capture target declares ResultActivity", manifest.includes("dev.lightstart.mobile.ResultActivity"));
    ok("a capture target filters IMAGE_CAPTURE", manifest.includes("android.media.action.IMAGE_CAPTURE"));
    ok("a capture target filters VIDEO_CAPTURE when video is allowed", manifest.includes("android.media.action.VIDEO_CAPTURE"));
    ok("a capture target does not filter GET_CONTENT", !manifest.includes("android.intent.action.GET_CONTENT"));
    ok("a capture target does not filter PICK", !manifest.includes("android.intent.action.PICK"));
    ok("the capture path reaches BuildConfig", gradle.includes('buildConfigField "String", "RESULT_CAPTURE", \'"/camera"\''));
    ok("no pick path is baked", gradle.includes('buildConfigField "String", "RESULT_PICK", \'""\''));
  } finally {
    rmSync(capture, { recursive: true, force: true });
  }

  const pick = write({ pick: "/pick" });
  try {
    const manifest = read(pick, "app/src/main/AndroidManifest.xml");
    const gradle = read(pick, "app/build.gradle");
    ok("a pick target filters GET_CONTENT", manifest.includes("android.intent.action.GET_CONTENT"));
    ok("a pick target filters PICK", manifest.includes("android.intent.action.PICK"));
    ok("GET_CONTENT carries the OPENABLE category", manifest.includes("android.intent.category.OPENABLE"));
    ok("a pick target has no capture action", !manifest.includes("android.media.action.IMAGE_CAPTURE") && !manifest.includes("android.media.action.VIDEO_CAPTURE"));
    ok("each default type is a data filter", manifest.includes('android:mimeType="image/*"') && manifest.includes('android:mimeType="video/*"'));
    ok("the pick path reaches BuildConfig", gradle.includes('buildConfigField "String", "RESULT_PICK", \'"/pick"\''));
    ok("no capture path is baked", gradle.includes('buildConfigField "String", "RESULT_CAPTURE", \'""\''));
  } finally {
    rmSync(pick, { recursive: true, force: true });
  }

  const both = write({ capture: "/camera", pick: "/pick" });
  try {
    const manifest = read(both, "app/src/main/AndroidManifest.xml");
    ok("both paths declare one ResultActivity", manifest.split("dev.lightstart.mobile.ResultActivity").length - 1 === 1);
    ok("both paths filter capture and pick", manifest.includes("android.media.action.IMAGE_CAPTURE") && manifest.includes("android.intent.action.GET_CONTENT"));
  } finally {
    rmSync(both, { recursive: true, force: true });
  }

  const images = write({ capture: "/camera", pick: "/pick", types: ["image/*", "image/jpeg"] });
  try {
    const manifest = read(images, "app/src/main/AndroidManifest.xml");
    ok("an images-only result target keeps IMAGE_CAPTURE", manifest.includes("android.media.action.IMAGE_CAPTURE"));
    ok("an images-only result target drops VIDEO_CAPTURE", !manifest.includes("android.media.action.VIDEO_CAPTURE"));
    ok("an images-only result target filters both image types", manifest.includes('android:mimeType="image/*"') && manifest.includes('android:mimeType="image/jpeg"'));
    ok("an images-only result target has no video type", !manifest.includes('android:mimeType="video/*"'));
  } finally {
    rmSync(images, { recursive: true, force: true });
  }

  const resultActivity = readFileSync(fileURLToPath(new URL("../templates/android/app/src/main/java/dev/lightstart/mobile/ResultActivity.kt", import.meta.url)), "utf8");
  ok("the ResultActivity source ships with the template", resultActivity.includes("class ResultActivity : MainActivity()"));
  done();
};

main();
