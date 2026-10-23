import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

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
