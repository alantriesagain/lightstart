export const SERVICE_CONTROL = "0000fea6-0000-1000-8000-00805f9b34fb";
export const SERVICE_WIFI = "b5f90001-aa8d-11e3-9046-0002a5d5c51b";

export const CHAR_COMMAND = "b5f90072-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_COMMAND_RESP = "b5f90073-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_SETTING = "b5f90074-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_SETTING_RESP = "b5f90075-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_QUERY = "b5f90076-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_QUERY_RESP = "b5f90077-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_WIFI_SSID = "b5f90002-aa8d-11e3-9046-0002a5d5c51b";
export const CHAR_WIFI_PASS = "b5f90003-aa8d-11e3-9046-0002a5d5c51b";

export const CMD_SHUTTER = 0x01;
export const CMD_SLEEP = 0x05;
export const CMD_AP_CONTROL = 0x17;
export const CMD_LOAD_PRESET_GROUP = 0x3e;
export const CMD_LOAD_PRESET = 0x40;

export const QUERY_GET_STATUS = 0x13;
export const QUERY_REGISTER_STATUS = 0x53;
export const QUERY_GET_SETTINGS = 0x12;
export const QUERY_GET_CAPABILITIES = 0x32;
export const QUERY_REGISTER_SETTINGS = 0x52;
export const QUERY_REGISTER_CAPABILITIES = 0x62;

/**
 * Request ids the camera echoes on its own pushes. They share the response
 * characteristic with status pushes, so the driver has to tell them apart by
 * this byte or it will read a settings reply as a status.
 */
export const PUSH_SETTINGS = 0x92;
export const PUSH_CAPABILITIES = 0xa2;

export const SETTING_RESOLUTION = 2;
export const SETTING_FPS = 3;
export const SETTING_VIDEO_LENS = 121;
export const SETTING_PHOTO_LENS = 122;

export const WATCHED_SETTINGS = [
  SETTING_RESOLUTION,
  SETTING_FPS,
  SETTING_VIDEO_LENS,
  SETTING_PHOTO_LENS,
];

export const STATUS_ENCODING = 0x08;
export const STATUS_DURATION = 0x0d;
export const STATUS_AP_ON = 0x1d;
export const STATUS_BATTERY = 0x46;
export const STATUS_PRESET_GROUP = 0x60;
export const STATUS_ACTIVE_PRESET = 0x61;

export const PRESET_GROUP_VIDEO = 1000;
export const PRESET_GROUP_PHOTO = 1001;

export const WATCHED_STATUSES = [
  STATUS_ENCODING,
  STATUS_DURATION,
  STATUS_AP_ON,
  STATUS_BATTERY,
  STATUS_PRESET_GROUP,
  STATUS_ACTIVE_PRESET,
];

export const HTTP_BASE = "http://10.5.5.9:8080";
export const PREVIEW_PORT = 8554;
export const PRESETS_URL = () => `${HTTP_BASE}/gopro/camera/presets/get`;
