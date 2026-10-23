import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-circle",
  style: true,
  class:
    "inline-block align-middle box-border w-4 h-4 rounded-full border-1 border-solid border-dim",
  props: {
    solid: false,
  },
});
