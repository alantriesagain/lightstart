/** One entry of a preset's `settingArray`: the value it will shoot at. */
export interface PresetSetting {
  id: number;
  value: number;
}

/** `titleId` is a number on older firmware and a `PRESET_TITLE_*` enum on newer. */
export interface Preset {
  id: number;
  titleId?: number | string;
  settingArray?: PresetSetting[];
}

export interface PresetGroup {
  id: string;
  presetArray?: Preset[];
}

export interface PresetTree {
  presetGroupArray?: PresetGroup[];
}

/** One file in the camera media list reply, as the firmware spells it. */
export interface MediaListFile {
  n?: string;
  s?: string | number;
  cre?: string | number;
  mod?: string | number;
  dur?: string | number;
}

export interface MediaListDir {
  d?: string;
  fs?: MediaListFile[];
}

/** The `/gp/gpMediaList` reply. */
export interface MediaListReply {
  media?: MediaListDir[];
}


