import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";

export default defineComponent({
  tag: "lc-pattern",
  style: true,
  props: {
    pattern: T.string(),
    random: false,
  },
  connected() {
    const patterns = ["pattern-1", "pattern-2", "pattern-3", "pattern-4"];
    let patternClass = this.pattern;

    if (this.random) {
      const randomIndex = Math.floor(Math.random() * patterns.length);
      patternClass = patterns[randomIndex];
    }

    if (patternClass)
      this.classList.add(patternClass);

  },
});
