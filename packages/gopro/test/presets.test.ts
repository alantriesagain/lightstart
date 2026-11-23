/**
 * @file The camera's own named presets, crossed with our resolution and frame-rate names.
 */

import { done, eq as rawEq } from "@lightstart/test/assert.ts";
import { buildPresetControl, presetLabel, presetTitle } from "../lib/presets.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const tree = {
  presetGroupArray: [
    {
      id: "PRESET_GROUP_ID_VIDEO",
      presetArray: [
        { id: 0, titleId: 1, settingArray: [{ id: 2, value: 9 }, { id: 3, value: 5 }] },
        { id: 1, titleId: "PRESET_TITLE_TIME_WARP", settingArray: [{ id: 2, value: 100 }] },
        { id: 2, titleId: 999, settingArray: [] },
      ],
    },
    { id: "PRESET_GROUP_ID_PHOTO", presetArray: [{ id: 65536, titleId: 3 }] },
  ],
};

eq("a preset is labelled with what it will shoot", presetLabel(tree.presetGroupArray[0].presetArray[0]), "Standard · 1080p60");
eq("a preset without a frame rate is labelled with its resolution", presetLabel(tree.presetGroupArray[0].presetArray[1]), "Time Warp · 5.3K");
eq("a ratio resolution does not run into the frame rate", presetLabel({ id: 0, titleId: 1, settingArray: [{ id: 2, value: 26 }, { id: 3, value: 8 }] }), "Standard · 5.3K 4:3 30");

eq("presetTitle reads an enum name", presetTitle({ id: 0, titleId: "PRESET_TITLE_NIGHT_LAPSE" }), "Night Lapse");
eq("presetTitle reads a numeric title", presetTitle({ id: 0, titleId: 1 }), "Standard");
eq("presetTitle falls back to the number", presetTitle({ id: 0, titleId: 999 }), "Preset 999");
eq("presetTitle without a title", presetTitle({ id: 0 }), "Preset");

const video = buildPresetControl(tree, "video", 1);
deep("buildPresetControl lists the current mode's presets", video?.options.map((o) => o.value), [0, 1, 2]);
eq("buildPresetControl marks the active preset", video?.value, 1);
const photo = buildPresetControl(tree, "photo", 1);
deep("buildPresetControl lists the photo preset", photo?.options.map((o) => o.label), ["Photo"]);
eq("an id from another group must not read as selected", photo?.value, null);

eq("buildPresetControl without a tree", buildPresetControl(null, "video", null), null);
eq("buildPresetControl with no groups", buildPresetControl({ presetGroupArray: [] }, "video", null), null);

done();
