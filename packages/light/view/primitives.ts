/**
 * The types of `definition.js`: the definition composition every citizen
 * built on the engine shares (a component, a mixin, a controller).
 */

/** Any definition-shaped citizen (a component, a controller, an extension) or a fragment of one. */
export type DefinitionFragment = Record<string, unknown> & { mixins?: readonly DefinitionFragment[] };

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type MixinOf<M> = M extends readonly (infer X)[] ? X : never;
type PropsOf<X> = X extends { props?: infer P } ? (P extends undefined ? {} : P) : {};
type EventsOf<X> = X extends { events?: infer E } ? (E extends undefined ? {} : E) : {};
type NestedOf<X> = X extends { mixins?: infer N } ? (N extends undefined ? never : N) : never;
type MembersOf<X, K extends PropertyKey> = Omit<X, K>;

type PropsTree<X> = X extends unknown ? PropsOf<X> | PropsTree<MixinOf<NestedOf<X>>> : never;
type EventsTree<X> = X extends unknown ? EventsOf<X> | EventsTree<MixinOf<NestedOf<X>>> : never;
type MembersTree<X, K extends PropertyKey> = X extends unknown ? MembersOf<X, K> | MembersTree<MixinOf<NestedOf<X>>, K> : never;

/** The properties every mixin in `M` declares, nested mixins included. */
export type MixinProps<M> = M extends readonly unknown[] ? UnionToIntersection<PropsTree<MixinOf<M>>> : unknown;

/** The events every mixin in `M` declares, nested mixins included. */
export type MixinEvents<M> = M extends readonly unknown[] ? UnionToIntersection<EventsTree<MixinOf<M>>> : unknown;

/** The members every mixin in `M` contributes, minus the definition keys `K` the host engine consumes. */
export type MixinMembers<M, K extends PropertyKey> = M extends readonly unknown[] ? UnionToIntersection<MembersTree<MixinOf<M>, K>> : unknown;
