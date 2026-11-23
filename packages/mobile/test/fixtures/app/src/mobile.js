import { defineMobile } from "@lightstart/mobile";

export default defineMobile({
  appId: "com.example.mobilefixture",
  name: "Mobile Fixture",
  version: { name: "1.0.0", code: 1 },
  orientation: "portrait",
  minSdk: 26,
  shareTarget: { path: "/capture", types: ["image/*", "video/*", "text/plain"] },
  resultTarget: { capture: "/camera", pick: "/pick" },
  cameraApp: "com.example.camera",
});
