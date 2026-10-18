/**
 * @bootstrapp/light/components: public type declarations.
 */

export type Prop<V> = import("@bootstrapp/light/types").TypeDefinition<V>;

/** Anything a component may place in a template: what a caller-supplied render callback returns. */
export type Renderable = import("@bootstrapp/light/html").Renderable;

/** utils/highlight.js: one coloured run of a code line; `type` is null for plain text. */
export interface Run {
  text: string;
  type: string | null;
}

/** app/stories.js: the viewer controls handed to every story render callback. */
export interface StoryContext {
  close: () => void;
  go: (delta: number) => void;
  index: number;
  total: number;
}

/** app/stories.js: a caller-supplied renderer for one story item. */
export type StoryRenderer = (item: unknown, ctx: StoryContext) => Renderable;

/** app/stories.js: resolves the blurred backdrop image URL for one story item. */
export type StoryBackground = (item: unknown) => string;

/** app/swipe-deck.js: the deck controls handed to every card render callback. */
export interface SwipeDeckContext {
  index: number;
  total: number;
  depth: number;
  skip: () => void;
  save: () => void;
  open: () => void;
  undo: () => void;
}

/** app/swipe-deck.js: a caller-supplied renderer for one card or the footer under it. */
export type SwipeDeckRenderer = (item: unknown, ctx: SwipeDeckContext) => Renderable;

/** app/swipe-deck.js: what to draw once the deck has run out. */
export type SwipeDeckEmpty = () => Renderable;

/** app/swipe-deck.js: resolves the URL painted behind the stack for one item. */
export type SwipeDeckBackground = (item: unknown) => string;

/** app/swipe-deck.js: copy for the two buttons and the counter; `{i}` and `{n}` are substituted. */
export interface SwipeDeckLabels {
  skip?: string;
  save?: string;
  undo?: string;
  counter?: string;
}

/** app/swipe-deck.js: one committed swipe, kept so it can be undone. */
export interface SwipeDeckHistory {
  index: number;
  item: unknown;
  direction: "left" | "right";
}

/** display/calendar.js: an event on the calendar grid/list. */
export interface CalendarEvent {
  id: string | number;
  date: string;
  title: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: string;
  recurrenceDays?: number[];
  recurrenceParentId?: string | number;
  category?: string;
  image?: string;
  time?: string;
  venue?: string;
  address?: string;
}

/** display/calendar.js: how often a recurring event repeats. */
export type RecurrencePattern = "daily" | "weekly" | "monthly" | "custom";

/** display/calendar.js: a caller-supplied renderer for one event chip. */
export type CalendarEventRenderer = (event: CalendarEvent) => Renderable;

/** display/calendar.js: the callback fired when an event is dropped on a day cell. */
export type CalendarDayDrop = (dateStr: string, draggedId: string, e: DragEvent) => void;

/** display/calendar.js: a single day cell in the month grid. */
export interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

/** form/select.js: one <lc-select> option (either a plain value or a { value, label } pair). */
/** Which mask rule of an icon an element draws: the outline, `solid` or `bold`. */
export type IconVariant = "" | "solid" | "bold";

export interface SelectOption {
  value?: unknown;
  label?: unknown;
  /** Drawn before the label wherever the option shows: a flag, an emoji. */
  leading?: string;
  [k: string]: unknown;
}

/** page/steps-section.js: one step in the `steps` array property. */
export interface StepItem {
  number?: string;
  title?: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  iconBgColor?: string;
  iconBorderColor?: string;
  mockupGradientFrom?: string;
  mockupGradientTo?: string;
  cta?: { label?: string; href?: string } | null;
  image?: File | string;
}

/** feedback/stepper.js: one entry in the `steps` array property. */
export interface StepperStep {
  id: string;
  label: string;
  /** A line under the label, drawn by the vertical stepper. */
  description?: string;
  /** Marks the step done whatever `current` says. */
  done?: boolean;
}

/** display/comment.js: the `actions` render property, drawn in the comment's actions row. */
export type CommentActions = () => Renderable;

/** page/steps-section.js: the `footerCta` object property. */
export interface FooterCta {
  label?: string;
  href?: string;
  icon?: string;
}

/** page/testimonial-section.js: one entry in the `testimonials` array property. */
export interface Testimonial {
  rating?: number;
  quote?: string;
  avatar?: string;
  author?: string;
  role?: string;
}

/** A searchable document rendered by `lc-search` / matched by `lc-search`'s matcher. */
export interface SearchDoc {
  id: string | number;
  group: string;
  title: string;
  hint?: string;
  href?: string;
  [k: string]: unknown;
}

/** page/pricing-card.js: the `cta` object property. */
export interface PricingCta {
  label?: string;
  href?: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  options?: Array<string | { value: unknown; label: unknown; leading?: string }>;
  checkboxLabel?: string;
  /** A `select` that is typed into to find its option; a `multi-select` always is. */
  searchable?: boolean;
  /** Text drawn inside a text field before what is typed, never part of the value. */
  prefix?: string;
  defaultValue?: unknown;
  /** A hint under the control. `description` is the same slot under the name a schema tends to use. */
  help?: string;
  description?: string;
  /** Forwarded to a file input: which types it takes, and the ceiling in bytes. */
  accept?: string;
  maxSize?: number;
  /** Forwarded to a number or date input; on a `multi-select`, the most it takes. */
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
  readonly?: boolean;
  /** Added to the field's wrapper, for a layout the form itself has no opinion about. */
  class?: string;
  /**
   * When to draw the field: the name of another field that has to be truthy,
   * or a predicate over the current values. A hidden field is not collected
   * either, so a branch nobody could see never reaches the payload.
   */
  visibleIf?: string | ((values: Record<string, unknown>) => boolean);
  /** The fields of an `object` field, addressed under this one's name. */
  fields?: FormField[];
  /** The shape of one entry of an `array` field. */
  itemFields?: FormField[];
  /** One entry of an `array` of plain values, which has a control rather than a group. */
  itemField?: FormField;
  /** An `object` field drawn as an accordion, for a shape deep enough to want folding away. */
  collapsible?: boolean;
  /** What the add button says, and what an empty list says instead of nothing. */
  addLabel?: string;
  emptyLabel?: string;
  /**
   * Where a select's options come from when they are not a constant: called
   * with the form's current values, and again whenever a field named in
   * `dependsOn` changes.
   */
  loadOptions?: (values: Record<string, unknown>) => Promise<Array<string | { value: unknown; label: unknown }>>;
  dependsOn?: string | string[];
  /** Buttons beside the add button of an `array` field, for whatever else fills it. */
  actions?: Array<{ label?: string; icon?: string; title?: string; onClick?: (items: unknown[]) => void }>;
  /** Set by the CMS field pipeline; picks a registered renderer over the plain input. */
  cmsType?: string;
  /**
   * A registered renderer reads whatever its own field type declares: a media
   * picker wants the workspace it picks from, an image field the page's slug.
   * The built-in controls read none of it.
   */
  [key: string]: unknown;
}

export interface FormTypeHandler {
  serialize?: (value: unknown, field: FormField) => unknown;
  deserialize?: (value: unknown, field: FormField) => unknown;
  render?: (
    field: FormField,
    value: unknown,
    onChange: (newValue: unknown) => void,
  ) => Renderable;
}

/** form/field-renderers.js: a renderer registered for one `field.cmsType`. */
export type FormFieldRenderer = (
  field: FormField,
  value: unknown,
  onChange: (newValue: unknown) => void,
  html: typeof import("@bootstrapp/light/html").html,
) => Renderable;

/** form/form.js: a control `collectFormData` reads; the native inputs and the `lc-*` controls share this surface. */
export interface FormControlElement extends Element {
  name?: string;
  type?: string;
  checked?: boolean;
  multiple?: boolean;
  value?: unknown;
}

export type FormTypeHandlers = Record<string, FormTypeHandler>;

export interface PieChartDatum {
  value?: number;
  label?: string;
  color?: string;
}

/** display/table.js: a `<lc-table>` column descriptor. */
export interface TableColumn {
  name: string;
  label?: string;
  align?: string;
  sortable?: boolean;
  /** Model field type name (`"string"`, `"boolean"`, ...); picks the built-in cell renderer. */
  type?: string;
  render?: (value: Renderable, row: TableRow) => Renderable;
  /** What `<lc-data-table>` sorts the column by; the field `name` names when absent. */
  sortValue?: (row: TableRow) => unknown;
}

/** display/data-table.js: the model `<lc-data-table>` pages when it pages a query rather than rows. */
export interface DataTableQuery {
  model: string;
  where?: Record<string, unknown>;
  includes?: string[];
}

/** display/table.js: one `<lc-table>` row; every cell is drawn, so every cell is renderable. */
export type TableRow = Record<string, Renderable>;

/** display/table.js: the click handler a caller hands `<lc-table>`'s `selectRow`. */
export type TableRowSelect = (row: TableRow, e: Event) => void;

/** Whether a table row is the one picked, drawn marked. */
export type TableRowSelected = (row: TableRow) => boolean;

/** page/hero-section.js: the eyebrow badge/label above the headline. */
export interface HeroEyebrow {
  badge?: string;
  label?: string;
  meta?: string;
  href?: string;
}

/** page/hero-section.js: a call-to-action button below the headline. */
export interface HeroCta {
  label?: string;
  href?: string;
  variant?: "primary" | "secondary";
}

/** A single FAQ entry rendered by `lc-faq-section`. */
export interface FaqItem {
  question: string;
  answer: string;
}

/** form/radio.js: a sibling `<lc-radio>` in the same radio group. */
export interface RadioElement extends Element {
  checked?: boolean;
}

/** overlay/alert-dialog.js: the dialog's visual variant. */
export type AlertVariant = "default" | "success" | "warning" | "error" | "info";

/** utils/roving.js: how a list answers an arrow key. */
export interface RovingOptions {
  /** Past the last item, continue at the first (and the other way round). */
  wrap?: boolean;
  /** Which pair of arrows moves the selection; `both` accepts all four. */
  orientation?: "vertical" | "horizontal" | "both";
  /** Answer Home and End as well. */
  homeEnd?: boolean;
}

/** overlay/anchor.js: which edge of the trigger a floating box sits against. */
export type AnchorSide = "top" | "bottom" | "left" | "right";

/** overlay/anchor.js: where the box sits along the trigger's other axis. */
export type AnchorAlign = "start" | "center" | "end";

/** overlay/anchor.js: the size of a box, which is all the anchor math needs of it. */
export interface Box {
  width: number;
  height: number;
}

/** overlay/anchor.js: the part of a DOMRect the anchor math reads. */
export interface Rect extends Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/** mixins/swipe-threshold.js: where the pointer that may become a swipe went down. */
export interface SwipeStart {
  pointerId: number;
  x: number;
  y: number;
}

/** mixins/pointer-drag.js: the one pointer a drag follows, and how far it has travelled. */
export interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** mixins/pointer-drag.js: what `onDragStart` is handed once the gesture is accepted. */
export interface DragStart {
  x: number;
  y: number;
  event: Event;
}

/** mixins/pointer-drag.js: what `onDragMove` is handed, once per animation frame. */
export interface DragMove {
  dx: number;
  dy: number;
  x: number;
  y: number;
}

/** mixins/pointer-drag.js: what `onDragEnd` is handed; `cancelled` means the platform took the gesture away. */
export interface DragEnd {
  dx: number;
  dy: number;
  x: number;
  y: number;
  cancelled: boolean;
}

/** overlay/drag-panel.js, overlay/bottom-sheet.js: a named stop of a draggable sheet. */
export type DetentName = "full" | "half" | "closed";

/** overlay/drag-panel.js: the y offset (translateY from fully open) of each stop. */
export type DetentStops = Record<DetentName, number>;

/** overlay/bottom-sheet.js: what the sheet measures once at the start of a drag. */
export interface SheetGeometry {
  stops: DetentStops;
  base: number;
  backdrop: HTMLElement | null;
  moved: boolean;
  room: number;
  lift: number;
}

/** utility/droparea.js: what `onDropped` is handed when a drag lands on the area. */
export interface DropInfo {
  draggedId: string;
  targetId: string;
  event: DragEvent;
  droparea: Element;
  /** Insertion index, present only on an `orderable` droparea. */
  index?: number;
}

/** form/form.js: the imperative surface `<lc-form>` exposes to a host element. */
export interface UixFormElement extends Element {
  submit(): boolean;
  setErrors(errors: Record<string, string> | null | undefined): void;
  validate(): Record<string, string>;
  clearErrors(): void;
}

/** mixins/popover.js: the imperative surface every popover-based overlay exposes. */
export interface UixPopoverElement extends Element {
  toggle(triggerElement: Element | null): void;
}

/** A kanban board column. */
export interface KanbanColumn {
  name: string;
  label?: string;
  icon?: string;
  color?: string;
}

/** A row rendered as a kanban card; carries an arbitrary grouping field. */
export interface KanbanRow extends Record<string, unknown> {
  id: string | number;
  title?: string;
  name?: string;
}

/** Where a dropped kanban card lands relative to the card it was dropped on. */
export interface KanbanMovePlacement {
  beforeId: string | number | null;
  afterId: string | number | null;
  nestUnderId: string | number | null;
}

/** Fired when a kanban card is dropped into a column. */
export type KanbanMove = (
  draggedId: string,
  columnName: string,
  placement: KanbanMovePlacement,
) => void;

/** Fired when a new card title is submitted in a kanban column footer. */
export type KanbanAdd = (columnName: string, title: string) => void;

/** Fired when a kanban card is clicked. */
export type KanbanSelect = (row: KanbanRow) => void;

/** A caller-supplied renderer for one kanban card. */
export type KanbanRowRenderer = (row: KanbanRow) => Renderable;

/** A caller-supplied renderer for a kanban column's header actions. */
export type KanbanColumnRenderer = (column: KanbanColumn) => Renderable;

/** Active drag/drop target state for a kanban board. */
export interface KanbanDropTarget {
  cardId: string;
  zone: "above" | "below" | "on";
  column: string;
}

/** A single toast notification, fully resolved (defaults applied). */
/** What `toasts.show` takes. */
export interface ToastOptions {
  title?: string;
  message?: string;
  variant?: string;
  icon?: string;
  duration?: number;
  closable?: boolean;
  onTap?: () => void;
}

/** feedback/toasts.js: the notification queue. */
export interface ToastQueue {
  items: import("@bootstrapp/light/signals").Signal<ToastItem[]>;
  show(options?: ToastOptions): string;
  success(message: string, options?: ToastOptions): string;
  error(message: string, options?: ToastOptions): string;
  warning(message: string, options?: ToastOptions): string;
  info(message: string, options?: ToastOptions): string;
  tap(id: string): void;
  hide(id: string): void;
  hideAll(): void;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  variant: string;
  /** Drawn in place of the variant's own icon when set. */
  icon: string;
  duration: number;
  closable: boolean;
  /** Makes the entry a button: a tap takes it off and runs this. */
  onTap?: () => void;
}

/** A breadcrumb trail entry, parsed from `<a>`/`<span>` children or passed in directly. */
export interface BreadcrumbItem {
  text: string | null;
  href: string | null;
  isLast: boolean;
}

/** One crumb `lc-page-header` draws before its title; one without `href` is plain text. */
export interface PageHeaderCrumb {
  label: string;
  href?: string;
}

/** A single stat tile rendered by `lc-stats-section`. */
export interface StatItem {
  value?: string;
  label?: string;
  description?: string;
  icon?: string;
}

/** The `image` property of `lc-showcase-section`. */
export interface ShowcaseImage {
  src?: string;
  alt?: string;
}

/** A single call-to-action rendered by `lc-showcase-section`. */
export interface ShowcaseCta {
  label?: string;
  href?: string;
  variant?: string;
}

/** page/catalog.js: one entry of the page-section catalog. */
export interface CatalogEntry {
  tag: string;
  label: string;
  icon: string;
}

/** page/sample-bootstrapp.js: one section of the sample page, with the props it hands its component. */
export interface SampleSection {
  type: string;
  props: Record<string, Renderable>;
}

/** page/sample-bootstrapp.js: the sample page the showcase previews render from. */
export interface SamplePage {
  header: SampleSection;
  footer: SampleSection;
  sections: SampleSection[];
}

/** A header/footer/body section descriptor rendered by `lc-page`. */
export interface PageSection {
  type: string;
  props?: Record<string, unknown>;
}

/** A single data point plotted by `lc-line-chart`. */
export interface ChartDataPoint {
  value: number;
  label?: string;
}

/** A `lc-segmented` option: a plain string is normalized to `{ value, label: value }`; a label may be a template (an icon and a badge beside the text). */
/** form/day-strip.js: one day of the strip, as drawn. */
export interface DayStripDay {
  date: string;
  weekday: string;
  day: string;
  today: boolean;
  dot: boolean;
}

/** utils/week-hours.js: one day's hours, `HH:MM`; a close at or before the open runs past midnight. */
export interface WeekHoursDay {
  open: string;
  close: string;
}

/** utils/week-hours.js: the days (0 Sunday to 6 Saturday) that keep the same hours. */
export interface WeekHoursEntry extends WeekHoursDay {
  days: number[];
}

/** form/crop-rect.js: the square of a picture a crop frame shows, in the picture's pixels. */
export interface CropRect {
  x: number;
  y: number;
  size: number;
}

/** form/crop-rect.js: a picture's size, and the smallest square a crop may zoom in to. */
export interface CropBounds {
  width: number;
  height: number;
  minSize: number;
}

/** form/crop-rect.js: a point of the frame, in screen pixels. */
export interface CropPoint {
  x: number;
  y: number;
}

/** form/crop-rect.js: what a key asks of a crop. */
export type CropIntent = { pan: [number, number] } | { zoom: number } | { reset: true };

/** form/month-picker.js: one cell of the grid, as drawn. */
export interface MonthPickerDay {
  date: string;
  day: string;
  inMonth: boolean;
  today: boolean;
  dot: boolean;
  disabled: boolean;
  edge: boolean;
  inside: boolean;
}

export interface SegmentedOption {
  value: string;
  label?: Renderable;
  icon?: string;
  /** A small number drawn after the label, such as what waits in that segment. */
  count?: number | string;
}

/** A `lc-sparkline` data point: a bare number or an object carrying `value`. */
export type SparklineDatum = number | { value: number };

/** `lc-footer`'s `brand` property shape. */
export interface FooterBrand {
  name?: string;
  logo?: string;
  href?: string;
}

/** `lc-footer`'s `columns` item shape. */
export interface FooterColumn {
  title?: string;
  links?: FooterLink[];
}

/** A single link inside a `FooterColumn`. */
export interface FooterLink {
  label?: string;
  href?: string;
}

/** `lc-footer`'s `socials` item shape. */
export interface FooterSocial {
  icon?: string;
  href?: string;
}

/** `lc-pricing-table`'s `plans` item shape. */
export interface PricingPlan {
  name?: string;
  price?: string;
  period?: string;
  description?: string;
  features?: string[];
  cta?: { label?: string; href?: string };
  highlighted?: boolean;
}

/** A single call-to-action button in `<lc-cta-section>`'s `ctas` array. */
export interface CtaSectionAction {
  label: string;
  href?: string;
  variant?: "primary" | "secondary";
}

/** A single card in `<lc-feature-grid>`'s `features` array. */
export interface FeatureGridItem {
  icon?: string;
  title?: string;
  description?: string;
}

/** A single datum of `<lc-bar-chart>`'s `data` array. */
export interface BarChartDatum {
  value?: number;
  label?: string;
}

/** display/flow.js: one step of a lane. */
export interface FlowStep {
  /** Unique across every lane of the flow: `selected` and `flow-select` name it. */
  id: string;
  label: string;
  /** A line under the label. */
  detail?: string;
  /** The index of its phase in the flow's `phases`; 0 when the flow has none. */
  phase?: number;
  tone?: "accent" | "muted";
}

/** display/flow.js: one entry in the `lanes` array property. */
export interface FlowLane {
  id: string;
  label: string;
  /** A line under the lane's label. */
  detail?: string;
  steps: FlowStep[];
}

/** `<lc-site-header>`'s `brand` property. */
export interface SiteHeaderBrand {
  name?: string;
  logo?: string;
  href?: string;
}

/** A single row of `<lc-site-header>`'s `links` array. */
export interface SiteHeaderLink {
  label: string;
  href: string;
}

/** A single row of `<lc-site-header>`'s `actions` array. */
export interface SiteHeaderAction {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

/** Minimal shape of the lazily-loaded `marked` module used by `<lc-markdown>`. */
export interface MarkedLike {
  parse(src: string): string;
  use(options: unknown): void;
}

/** One link of a `<lc-nav-tree>` group. */
export interface NavTreeItem {
  label: string;
  href: string;
  badge?: string;
  exact?: boolean;
}

/** One group of `<lc-nav-tree>`: a heading over its links. */
export interface NavTreeGroup {
  id: string;
  label: string;
  icon?: string;
  count?: number;
  items: NavTreeItem[];
}

/** One neighbour of `<lc-pagination variant="pager">`: where it leads and what it is called. */
export interface PagerLink {
  label: string;
  href: string;
  hint?: string;
}

/** A heading `<lc-markdown>` rendered, as its `markdown-rendered` event reports it. */
export interface MarkdownHeading {
  id: string;
  text: string;
  level: number;
}

/** One entry of `<lc-toc>`'s `items`: a heading the page has, by id. */
export interface TocItem {
  id: string;
  label: string;
  level?: number;
}

/** A single row of `<lc-dropdown>`'s structured `items` array. */
export interface DropdownItem {
  label?: string;
  icon?: string;
  onClick?: (e: Event) => void;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
  divider?: boolean;
  header?: string;
}

/** One row of `lc-context-menu`: a leaf with an action, a parent with children, or a separator. */
export interface ContextMenuItem {
  label?: string;
  icon?: string;
  keybinding?: string;
  /** Rows with the same group sit together; groups are separated and sorted by name. */
  group?: string;
  separator?: boolean;
  danger?: boolean;
  disabled?: boolean;
  action?: (target: unknown) => unknown;
  children?: ContextMenuItem[];
  [k: string]: unknown;
}

/** The `lc-context-menu` element as a caller drives it. */
export interface ContextMenuHost extends HTMLElement {
  items: ContextMenuItem[];
  target: unknown;
  openAt(x: number, y: number, opts?: { items?: ContextMenuItem[]; target?: unknown }): void;
  openFor(anchor: Element, opts?: { items?: ContextMenuItem[]; target?: unknown; position?: string }): void;
  close(): void;
}

/** What `anim-drag-panel` measures once at the start of a drag; the pointer itself is `withPointerDrag`'s. */
export interface PanelDrag {
  base: number;
  stops: DetentStops;
  moved: boolean;
  samples: Array<{ t: number; y: number }>;
  startVelocity: number;
}

/** What an overlay hands the stack when it opens. */
export interface OverlayOptions {
  /** Called when this layer is topmost and Escape arrives. */
  dismiss?: () => void;
  /** False for a native `<dialog>`, which answers Escape itself. */
  dismissible?: boolean;
  /** Whether the body stops scrolling while this layer is open. */
  lockScroll?: boolean;
  /** Whether closing returns focus to whatever opened it. */
  restoreFocus?: boolean;
}

/** One open layer, as the stack holds it. */
export interface OverlayEntry extends OverlayOptions {
  id: string;
  host: Element;
  dismissible: boolean;
  lockScroll: boolean;
  opener: HTMLElement | null;
}
