import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/**
 * Flex Component
 * Flexible container for flexbox layouts
 * No shadow DOM - host element is the flex container
 */

export default defineComponent({
  tag: "lc-flex",
  style: true,
  props: {
    direction: T.string({
      defaultValue: "row",
      enum: ["row", "column", "row-reverse", "column-reverse"],
    }),
    gap: T.string({
      enum: ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"],
    }),
    align: T.string({
      defaultValue: "stretch",
      enum: ["start", "center", "end", "stretch", "baseline"],
    }),
    justify: T.string({
      defaultValue: "start",
      enum: [
        "start",
        "center",
        "end",
        "space-between",
        "space-around",
        "space-evenly",
      ],
    }),
    wrap: T.string({
      defaultValue: "nowrap",
      enum: ["wrap", "nowrap", "wrap-reverse"],
    }),
  },
});

/**
 * Flex Component
 *
 * @component
 * @category layout
 * @tag lc-flex
 *
 * A flexible container component for creating flexbox layouts.
 * No shadow DOM - the host element itself becomes the flex container.
 *
 * ## Flex Item Attributes
 *
 * Direct children can use these attributes for individual flex behavior:
 * - `flex-1` - Grow and shrink equally (flex: 1 1 0%)
 * - `flex-auto` - Grow and shrink with auto basis (flex: 1 1 auto)
 * - `flex-initial` - Don't grow, can shrink (flex: 0 1 auto)
 * - `flex-none` - Don't grow or shrink (flex: none)
 * - `flex-grow` - Allow growing (flex-grow: 1)
 * - `flex-shrink="0"` - Prevent shrinking
 * - `align-self="center|start|end|stretch"` - Individual alignment
 *
 * @example
 * // Basic row layout
 * ```html
 * <lc-flex gap="md">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </lc-flex>
 * ```
 *
 * @example
 * // Column layout with gap
 * ```html
 * <lc-flex direction="column" gap="lg">
 *   <div>Top</div>
 *   <div>Middle</div>
 *   <div>Bottom</div>
 * </lc-flex>
 * ```
 *
 * @example
 * // Centered content
 * ```html
 * <lc-flex align="center" justify="center" style="min-height: 200px;">
 *   <div>Centered Content</div>
 * </lc-flex>
 * ```
 *
 * @example
 * // Sidebar layout with flex-1
 * ```html
 * <lc-flex gap="md">
 *   <aside style="width: 250px;">
 *     Sidebar (fixed width)
 *   </aside>
 *   <main flex-1>
 *     Main content (takes remaining space)
 *   </main>
 * </lc-flex>
 * ```
 *
 * @example
 * // Toolbar with flexible search
 * ```html
 * <lc-flex align="center" gap="sm">
 *   <lc-button flex-none>New</lc-button>
 *   <lc-button flex-none>Save</lc-button>
 *   <lc-input flex-1 placeholder="Search..."></lc-input>
 *   <lc-button flex-none variant="primary">Submit</lc-button>
 * </lc-flex>
 * ```
 *
 * @example
 * // Card with flexible body
 * ```html
 * <lc-flex direction="column" gap="none" style="height: 400px;">
 *   <div flex-none style="padding: 1rem; border-bottom: 1px solid #ddd;">
 *     Header
 *   </div>
 *   <div flex-1 style="padding: 1rem; overflow-y: auto;">
 *     Body content that grows to fill available space
 *   </div>
 *   <div flex-none style="padding: 1rem; border-top: 1px solid #ddd;">
 *     Footer
 *   </div>
 * </lc-flex>
 * ```
 *
 * @example
 * // Space between items
 * ```html
 * <lc-flex justify="space-between" align="center">
 *   <h2>Page Title</h2>
 *   <lc-button variant="primary">Action</lc-button>
 * </lc-flex>
 * ```
 *
 * @example
 * // Individual item alignment
 * ```html
 * <lc-flex gap="md" style="height: 150px;">
 *   <div align-self="start">Aligned to start</div>
 *   <div align-self="center">Centered</div>
 *   <div align-self="end">Aligned to end</div>
 *   <div align-self="stretch">Stretched</div>
 * </lc-flex>
 * ```
 *
 * @example
 * // Wrap items
 * ```html
 * <lc-flex wrap="wrap" gap="sm">
 *   <lc-badge>Tag 1</lc-badge>
 *   <lc-badge>Tag 2</lc-badge>
 *   <lc-badge>Tag 3</lc-badge>
 *   <lc-badge>Tag 4</lc-badge>
 *   <lc-badge>Tag 5</lc-badge>
 * </lc-flex>
 * ```
 *
 * @example
 * // Dashboard layout
 * ```html
 * <lc-flex direction="column" gap="lg" style="height: 100vh;">
 *   <header flex-none>
 *     <lc-navbar>Navigation</lc-navbar>
 *   </header>
 *
 *   <lc-flex flex-1 gap="md">
 *     <aside flex-none style="width: 300px;">
 *       <lc-sidebar>Sidebar</lc-sidebar>
 *     </aside>
 *
 *     <main flex-1>
 *       <div style="padding: 2rem;">
 *         Main content area
 *       </div>
 *     </main>
 *   </lc-flex>
 *
 *   <footer flex-none>
 *     Footer content
 *   </footer>
 * </lc-flex>
 * ```
 *
 * @example
 * // Form row with labels
 * ```html
 * <lc-flex direction="column" gap="md">
 *   <lc-flex align="center" gap="sm">
 *     <label flex-none style="width: 120px;">Name:</label>
 *     <lc-input flex-1></lc-input>
 *   </lc-flex>
 *
 *   <lc-flex align="center" gap="sm">
 *     <label flex-none style="width: 120px;">Email:</label>
 *     <lc-input flex-1 type="email"></lc-input>
 *   </lc-flex>
 * </lc-flex>
 * ```
 */
