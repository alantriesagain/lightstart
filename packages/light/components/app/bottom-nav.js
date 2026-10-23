import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-bottom-nav",
  props: {
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "floating", "filled", "pill", "dock"],
    }),
    fixed: T.boolean(),
  },
  style: true,
  role: "navigation",
});

/**
 * Bottom Navigation Component
 *
 * @component
 * @category navigation
 * @tag lc-bottom-nav
 *
 * A mobile-optimized bottom navigation bar with icon and label items.
 * Commonly used in mobile apps for primary navigation.
 *
 * The `pill` variant hugs a few round items. Three attributes on a child
 * shape it: `prominent` for the one action the bar exists for, `wide` for a
 * control that keeps its own width inside the pill (a `lc-segmented`
 * switch, a search field), and the active markers (`.active`, `[active]`,
 * `aria-current="page"`). `--lc-bottom-nav-width` and
 * `--lc-bottom-nav-justify` let the pill span the bar and spread its items,
 * and `--lc-bottom-nav-item-background`, `--lc-bottom-nav-item-shadow` and
 * `--lc-bottom-nav-item-backdrop` paint each item as its own glass shape when
 * the bar itself is transparent.
 *
 * The `dock` variant is a pill of one colour, `--lc-bottom-nav-dock-height`
 * tall, whose items morph: the active item widens to show its label in the
 * active colours, a child marked `primary` grows to take the room left and
 * becomes the one action the screen has, and a child marked `collapsed`
 * shrinks to nothing. The three states are attributes on the same nodes, so
 * `flex-grow`, `width` and `opacity` transition between them rather than one
 * bar being swapped for another. The items keep their size and the row sits
 * centred; `--lc-bottom-nav-item-grow: 1` lets the idle ones share the room
 * the active one leaves instead, so the row fills the bar and an active item
 * at either end sits against the bar's padding.
 *
 * @example The dock, as a nav and as one action
 * ```html
 * <lc-bottom-nav variant="dock" fixed>
 *   <lc-nav-item icon="calendar-days" label="Today" active></lc-nav-item>
 *   <lc-nav-item icon="map" label="Map" icon-only></lc-nav-item>
 *   <lc-nav-item icon="heart" label="Saved" icon-only></lc-nav-item>
 *   <lc-avatar name="You" size="sm"></lc-avatar>
 * </lc-bottom-nav>
 * <lc-bottom-nav variant="dock" fixed>
 *   <lc-nav-item icon="map" label="Map" collapsed></lc-nav-item>
 *   <button primary>Going</button>
 *   <lc-avatar name="You" size="sm" collapsed></lc-avatar>
 * </lc-bottom-nav>
 * ```
 *
 * @slot default - Navigation items
 *
 * @part nav - The navigation container
 *
 * @example Basic Navigation
 * ```html
 * <lc-bottom-nav>
 *   <a href="/">
 *     <lc-icon name="house"></lc-icon>
 *     <span>Home</span>
 *   </a>
 *   <a href="/search">
 *     <lc-icon name="search"></lc-icon>
 *     <span>Search</span>
 *   </a>
 *   <a href="/favorites">
 *     <lc-icon name="heart"></lc-icon>
 *     <span>Favorites</span>
 *   </a>
 *   <a href="/profile">
 *     <lc-icon name="user"></lc-icon>
 *     <span>Profile</span>
 *   </a>
 * </lc-bottom-nav>
 * ```
 *
 * @example With Badges
 * ```html
 * <lc-bottom-nav>
 *   <a href="/">
 *     <lc-icon name="house"></lc-icon>
 *     <span>Home</span>
 *   </a>
 *   <a href="/notifications">
 *     <lc-badge>3</lc-badge>
 *     <lc-icon name="bell"></lc-icon>
 *     <span>Notifications</span>
 *   </a>
 *   <a href="/messages">
 *     <lc-badge>12</lc-badge>
 *     <lc-icon name="message-circle"></lc-icon>
 *     <span>Messages</span>
 *   </a>
 *   <a href="/profile">
 *     <lc-icon name="user"></lc-icon>
 *     <span>Profile</span>
 *   </a>
 * </lc-bottom-nav>
 * ```
 *
 * @example Floating Variant
 * ```html
 * <lc-bottom-nav variant="floating">
 *   <a href="/">
 *     <lc-icon name="house"></lc-icon>
 *     <span>Home</span>
 *   </a>
 *   <a href="/explore">
 *     <lc-icon name="search"></lc-icon>
 *     <span>Explore</span>
 *   </a>
 *   <a href="/create">
 *     <lc-icon name="plus"></lc-icon>
 *     <span>Create</span>
 *   </a>
 *   <a href="/profile">
 *     <lc-icon name="user"></lc-icon>
 *     <span>Profile</span>
 *   </a>
 * </lc-bottom-nav>
 * ```
 *
 * @example Icons Only (No Labels)
 * ```html
 * <lc-bottom-nav>
 *   <a href="/" aria-label="Home">
 *     <lc-icon name="house"></lc-icon>
 *   </a>
 *   <a href="/search" aria-label="Search">
 *     <lc-icon name="search"></lc-icon>
 *   </a>
 *   <a href="/saved" aria-label="Saved">
 *     <lc-icon name="bookmark"></lc-icon>
 *   </a>
 *   <a href="/settings" aria-label="Settings">
 *     <lc-icon name="settings"></lc-icon>
 *   </a>
 * </lc-bottom-nav>
 * ```
 *
 * @example Filled Variant
 * ```html
 * <lc-bottom-nav variant="filled">
 *   <a href="/">
 *     <lc-icon name="grid"></lc-icon>
 *     <span>Dashboard</span>
 *   </a>
 *   <a href="/shop">
 *     <lc-icon name="shopping-cart"></lc-icon>
 *     <span>Shop</span>
 *   </a>
 *   <a href="/wishlist">
 *     <lc-icon name="heart"></lc-icon>
 *     <span>Wishlist</span>
 *   </a>
 *   <a href="/account">
 *     <lc-icon name="user"></lc-icon>
 *     <span>Account</span>
 *   </a>
 * </lc-bottom-nav>
 * ```
 *
 * @example Non-Fixed Position
 * ```html
 * <lc-bottom-nav fixed="false">
 *   <a href="/"><lc-icon name="house"></lc-icon><span>Home</span></a>
 *   <a href="/search"><lc-icon name="search"></lc-icon><span>Search</span></a>
 *   <a href="/profile"><lc-icon name="user"></lc-icon><span>Profile</span></a>
 * </lc-bottom-nav>
 * ```
 */
