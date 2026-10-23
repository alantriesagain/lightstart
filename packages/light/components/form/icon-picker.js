import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withPopover } from "@bootstrapp/light/components/mixins/popover.js";
import { lcText } from "../utils/text.js";

const ICONS = {
  common: [
    "star",
    "heart",
    "house",
    "settings",
    "search",
    "plus",
    "minus",
    "check",
    "x",
    "eye",
    "bell",
    "bookmark",
    "flag",
    "pin",
    "zap",
    "flame",
    "sparkles",
    "crown",
    "gem",
    "trophy",
    "target",
    "crosshair",
    "compass",
    "map",
    "navigation",
    "globe",
    "sun",
    "moon",
    "cloud",
  ],
  files: [
    "file",
    "file-text",
    "file-code",
    "file-image",
    "file-audio",
    "file-video",
    "folder",
    "folder-open",
    "folder-plus",
    "archive",
    "clipboard",
    "copy",
    "scissors",
    "save",
    "download",
    "upload",
    "paperclip",
    "link",
    "external-link",
  ],
  communication: [
    "mail",
    "inbox",
    "send",
    "message-circle",
    "message-square",
    "phone",
    "video",
    "at-sign",
    "hash",
    "share",
    "rss",
    "radio",
    "podcast",
    "megaphone",
  ],
  media: [
    "image",
    "camera",
    "film",
    "music",
    "headphones",
    "mic",
    "volume-2",
    "play",
    "pause",
    "square",
    "circle",
    "tv",
    "monitor",
    "smartphone",
    "tablet",
  ],
  people: [
    "user",
    "users",
    "user-plus",
    "user-check",
    "contact",
    "smile",
    "frown",
    "thumbs-up",
    "thumbs-down",
    "hand",
    "brain",
    "graduation-cap",
  ],
  development: [
    "code",
    "terminal",
    "bug",
    "git-branch",
    "git-commit",
    "git-merge",
    "database",
    "server",
    "cpu",
    "hard-drive",
    "wifi",
    "bluetooth",
    "key",
    "lock",
    "unlock",
    "shield",
  ],
  business: [
    "briefcase",
    "building",
    "store",
    "wallet",
    "credit-card",
    "banknote",
    "receipt",
    "chart-bar",
    "chart-line",
    "chart-pie",
    "trending-up",
    "trending-down",
    "calendar",
    "clock",
    "timer",
    "alarm-clock",
  ],
  objects: [
    "book",
    "book-open",
    "notebook",
    "pen",
    "pencil",
    "highlighter",
    "lamp",
    "lightbulb",
    "wrench",
    "hammer",
    "paint-bucket",
    "palette",
    "ruler",
    "package",
    "gift",
    "shopping-bag",
    "shopping-cart",
    "tag",
    "tags",
  ],
  health: [
    "heart-pulse",
    "activity",
    "dumbbell",
    "apple",
    "bike",
    "footprints",
    "pill",
    "stethoscope",
    "thermometer",
    "bed",
    "baby",
    "dog",
    "cat",
    "fish",
  ],
  arrows: [
    "arrow-up",
    "arrow-down",
    "arrow-left",
    "arrow-right",
    "chevron-up",
    "chevron-down",
    "chevron-left",
    "chevron-right",
    "move",
    "maximize",
    "minimize",
    "refresh-cw",
    "rotate-cw",
    "repeat",
  ],
  layout: [
    "layout-dashboard",
    "layout-grid",
    "layout-list",
    "kanban",
    "columns",
    "rows",
    "table",
    "list",
    "list-todo",
    "list-checks",
    "square-check",
    "circle-check",
    "circle-dot",
    "filter",
    "sliders-horizontal",
    "menu",
    "sidebar",
  ],
};

const EMOJI = [
  { char: "😀", name: "grinning" },
  { char: "😂", name: "joy" },
  { char: "😍", name: "heart eyes" },
  { char: "🥳", name: "party" },
  { char: "😎", name: "cool" },
  { char: "🤔", name: "thinking" },
  { char: "👍", name: "thumbs up" },
  { char: "👎", name: "thumbs down" },
  { char: "👋", name: "wave" },
  { char: "✌️", name: "peace" },
  { char: "🙌", name: "raised hands" },
  { char: "💪", name: "muscle" },
  { char: "❤️", name: "red heart" },
  { char: "💛", name: "yellow heart" },
  { char: "💙", name: "blue heart" },
  { char: "💚", name: "green heart" },
  { char: "💜", name: "purple heart" },
  { char: "🖤", name: "black heart" },
  { char: "⭐", name: "star" },
  { char: "🌟", name: "glowing star" },
  { char: "✨", name: "sparkles" },
  { char: "🔥", name: "fire" },
  { char: "💡", name: "light bulb" },
  { char: "⚡", name: "lightning" },
  { char: "🎯", name: "target" },
  { char: "🏆", name: "trophy" },
  { char: "🥇", name: "gold medal" },
  { char: "🎉", name: "party popper" },
  { char: "🎊", name: "confetti" },
  { char: "🎁", name: "gift" },
  { char: "📌", name: "pin" },
  { char: "📎", name: "paperclip" },
  { char: "✏️", name: "pencil" },
  { char: "📝", name: "memo" },
  { char: "📄", name: "document" },
  { char: "📂", name: "folder" },
  { char: "📚", name: "books" },
  { char: "📖", name: "open book" },
  { char: "📕", name: "red book" },
  { char: "💻", name: "laptop" },
  { char: "🖥️", name: "desktop" },
  { char: "📱", name: "phone" },
  { char: "⌨️", name: "keyboard" },
  { char: "🖱️", name: "mouse" },
  { char: "🔒", name: "locked" },
  { char: "🔑", name: "key" },
  { char: "🔔", name: "bell" },
  { char: "📣", name: "megaphone" },
  { char: "💬", name: "speech" },
  { char: "💭", name: "thought" },
  { char: "📧", name: "email" },
  { char: "🏠", name: "house" },
  { char: "🏢", name: "office" },
  { char: "🏫", name: "school" },
  { char: "🏦", name: "bank" },
  { char: "🏥", name: "hospital" },
  { char: "🏪", name: "store" },
  { char: "🚀", name: "rocket" },
  { char: "✈️", name: "airplane" },
  { char: "🚗", name: "car" },
  { char: "🚲", name: "bicycle" },
  { char: "🏃", name: "runner" },
  { char: "🧘", name: "yoga" },
  { char: "🏋️", name: "weightlifting" },
  { char: "⚽", name: "soccer" },
  { char: "🎮", name: "gaming" },
  { char: "🎵", name: "music" },
  { char: "🎬", name: "cinema" },
  { char: "🎨", name: "art" },
  { char: "📸", name: "camera" },
  { char: "🎤", name: "microphone" },
  { char: "🎧", name: "headphones" },
  { char: "💰", name: "money bag" },
  { char: "💵", name: "dollar" },
  { char: "💳", name: "credit card" },
  { char: "📊", name: "chart" },
  { char: "📈", name: "chart up" },
  { char: "📉", name: "chart down" },
  { char: "⏰", name: "alarm clock" },
  { char: "📅", name: "calendar" },
  { char: "⏳", name: "hourglass" },
  { char: "🌍", name: "earth" },
  { char: "🌈", name: "rainbow" },
  { char: "☀️", name: "sun" },
  { char: "🌙", name: "moon" },
  { char: "☁️", name: "cloud" },
  { char: "🌊", name: "wave water" },
  { char: "🌱", name: "seedling" },
  { char: "🌳", name: "tree" },
  { char: "🌸", name: "blossom" },
  { char: "🍎", name: "apple" },
  { char: "🍕", name: "pizza" },
  { char: "☕", name: "coffee" },
  { char: "🍺", name: "beer" },
  { char: "🧪", name: "test tube" },
  { char: "🔬", name: "microscope" },
  { char: "🧠", name: "brain" },
  { char: "👁️", name: "eye" },
  { char: "🦾", name: "robot arm" },
  { char: "🐶", name: "dog" },
  { char: "🐱", name: "cat" },
  { char: "🐦", name: "bird" },
  { char: "🦋", name: "butterfly" },
  { char: "🐠", name: "fish" },
  { char: "🦊", name: "fox" },
  { char: "✅", name: "check mark" },
  { char: "❌", name: "cross mark" },
  { char: "⚠️", name: "warning" },
  { char: "ℹ️", name: "info" },
  { char: "❓", name: "question" },
  { char: "💎", name: "gem" },
  { char: "🔧", name: "wrench" },
  { char: "⚙️", name: "gear" },
  { char: "🛡️", name: "shield" },
  { char: "🗂️", name: "dividers" },
  { char: "🗃️", name: "card box" },
  { char: "🗑️", name: "trash" },
  { char: "📋", name: "clipboard" },
  { char: "📦", name: "package" },
  { char: "🏷️", name: "label" },
  { char: "🔗", name: "link" },
  { char: "🔍", name: "magnifier" },
  { char: "💤", name: "sleep" },
];

const CATEGORY_LABELS = {
  common: "Common",
  files: "Files",
  communication: "Chat",
  media: "Media",
  people: "People",
  development: "Dev",
  business: "Business",
  objects: "Objects",
  health: "Health",
  arrows: "Arrows",
  layout: "Layout",
};

export default defineComponent({
  mixins: [withPopover],
  tag: "lc-icon-picker",
  icons: [
    "activity", "alarm-clock", "apple", "archive", "arrow-down", "arrow-left",
    "arrow-right", "arrow-up", "at-sign", "baby", "banknote", "bed",
    "bell", "bike", "bluetooth", "book", "book-open", "bookmark",
    "brain", "briefcase", "bug", "building", "calendar", "camera",
    "cat", "chart-bar", "chart-line", "chart-pie", "check", "chevron-down",
    "chevron-left", "chevron-right", "chevron-up", "circle", "circle-check", "circle-dot",
    "clipboard", "clock", "cloud", "code", "columns", "compass",
    "contact", "copy", "cpu", "credit-card", "crosshair", "crown",
    "database", "dog", "download", "dumbbell", "external-link", "eye",
    "file", "file-audio", "file-code", "file-image", "file-text", "file-video",
    "film", "filter", "fish", "flag", "flame", "folder",
    "folder-open", "folder-plus", "footprints", "frown", "gem", "gift",
    "git-branch", "git-commit", "git-merge", "globe", "graduation-cap", "hammer",
    "hand", "hard-drive", "hash", "headphones", "heart", "heart-pulse",
    "highlighter", "house", "image", "inbox", "kanban", "key",
    "lamp", "layout-dashboard", "layout-grid", "layout-list", "lightbulb", "link",
    "list", "list-checks", "list-todo", "lock", "mail", "map",
    "maximize", "megaphone", "menu", "message-circle", "message-square", "mic",
    "minimize", "minus", "monitor", "moon", "move", "music",
    "navigation", "notebook", "package", "paint-bucket", "palette", "paperclip",
    "pause", "pen", "pencil", "phone", "pill", "pin",
    "play", "plus", "podcast", "radio", "receipt", "refresh-cw",
    "repeat", "rotate-cw", "rows", "rss", "ruler", "save",
    "scissors", "search", "send", "server", "settings", "share",
    "shield", "shopping-bag", "shopping-cart", "sidebar", "sliders-horizontal", "smartphone",
    "smile", "sparkles", "square", "square-check", "star", "stethoscope",
    "store", "sun", "table", "tablet", "tag", "tags",
    "target", "terminal", "thermometer", "thumbs-down", "thumbs-up", "timer",
    "trending-down", "trending-up", "trophy", "tv", "unlock", "upload",
    "user", "user-check", "user-plus", "users", "video", "volume-2",
    "wallet", "wifi", "wrench", "x", "zap",
  ],
  style: true,
  props: {
    value: "",
    tab: "icon",
    search: "",
    category: "common",
  },

  render() {
    if (!this.open) return html``;

    const categories = Object.keys(ICONS);
    const filteredIcons = this._getFilteredIcons();
    const filteredEmoji = this._getFilteredEmoji();

    return html`
      <div class="picker-container">
        <div class="picker-tabs">
          <button
            class="picker-tab ${this.tab === "icon" ? "active" : ""}"
            @click=${() => {
              this.tab = "icon";
            }}
          >${lcText("lc-icon-picker", "icons")}</button>
          <button
            class="picker-tab ${this.tab === "emoji" ? "active" : ""}"
            @click=${() => {
              this.tab = "emoji";
            }}
          >${lcText("lc-icon-picker", "emoji")}</button>
        </div>

        <div class="picker-search">
          <input
            type="text"
            placeholder=${this.tab === "icon" ? "Search icons..." : "Search emoji..."}
            .value=${this.search}
            @input=${(e) => {
              this.search = e.target.value;
            }}
          />
        </div>

        ${
          this.tab === "icon"
            ? html`
          ${
            !this.search
              ? html`
            <div class="picker-categories">
              ${categories.map(
                (cat) => html`
                <button
                  class="category-pill ${this.category === cat ? "active" : ""}"
                  @click=${() => {
                    this.category = cat;
                  }}
                >${CATEGORY_LABELS[/** @type {keyof typeof CATEGORY_LABELS} */ (cat)] || cat}</button>
              `,
              )}
            </div>
          `
              : ""
          }

          <div class="picker-grid">
            ${filteredIcons.map(
              /** @param {string} name */
              (name) => html`
              <button
                class="picker-cell ${this.value === name ? "selected" : ""}"
                title=${name}
                @click=${() => this._select(name)}
              >
                <lc-icon name=${name} size="18"></lc-icon>
              </button>
            `,
            )}
            ${filteredIcons.length === 0 ? html`<div class="picker-empty">${lcText("lc-icon-picker", "noIcons")}</div>` : ""}
          </div>
        `
            : html`
          <div class="picker-grid emoji-grid">
            ${filteredEmoji.map(
              (e) => html`
              <button
                class="picker-cell emoji-cell ${this.value === e.char ? "selected" : ""}"
                title=${e.name}
                @click=${() => this._select(e.char)}
              >${e.char}</button>
            `,
            )}
            ${filteredEmoji.length === 0 ? html`<div class="picker-empty">${lcText("lc-icon-picker", "noEmoji")}</div>` : ""}
          </div>
        `
        }
      </div>
    `;
  },

  _getFilteredIcons() {
    if (this.search) {
      const q = this.search.toLowerCase();
      const all = Object.values(ICONS).flat();
      return all.filter((name) => name.includes(q));
    }
    return ICONS[/** @type {keyof typeof ICONS} */ (this.category)] || ICONS.common;
  },

  _getFilteredEmoji() {
    if (!this.search) return EMOJI;
    const q = this.search.toLowerCase();
    return EMOJI.filter((e) => e.name.includes(q) || e.char === q);
  },

  /** @param {string} value */
  _select(value) {
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("change", { detail: { value }, bubbles: true }),
    );
    this.search = "";
    this._close();
  },
});
