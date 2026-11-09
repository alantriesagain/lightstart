/**
 * The words the library itself draws, keyed by component tag. A host
 * translates them by merging a locale file of the same shape into its own;
 * `lcText` falls back to this file, so lc keeps working with no i18n
 * package installed at all.
 */
export default {
  "lc-command-palette": {
    placeholder: "Search…",
    navigate: "navigate",
    open: "open",
    close: "close",
  },
  "lc-app-shell": {
    menu: "Open navigation",
  },
  "lc-example": {
    preview: "Preview",
    code: "Code",
  },
  "lc-nav-tree": {
    nav: "Sections",
    more: "+{count} more",
  },
  "lc-toc": {
    title: "On this page",
  },
  "lc-clipboard": {
    copy: "Copy",
    copied: "Copied",
  },
  "lc-code-block": {
    showAll: "Show all {count} lines",
  },
  "lc-pagination": {
    nav: "Pagination",
    prevPage: "Previous page",
    nextPage: "Next page",
    page: "Page {page}",
    prev: "Prev",
    next: "Next",
    pageOf: "Page {current} of {total}",
    loadMore: "Load More",
  },
  "lc-form": {
    required: "{label} is required",
    loadFailed: "Failed to load",
  },
  "lc-modal": {
    close: "Close",
  },
  "lc-toast": {
    close: "Close",
  },
  "lc-alert-dialog": {
    confirm: "OK",
    cancel: "Cancel",
  },
  "lc-chart": {
    noData: "No data",
  },
  "lc-pull-indicator": {
    pull: "Pull to refresh",
    release: "Release to refresh",
    refreshing: "Refreshing",
  },
  "lc-data-table": {
    range: "{from}–{to} of {total}",
    perPage: "Rows per page",
  },
  "lc-table": {
    noData: "No data",
  },
  "lc-async": {
    failed: "Something went wrong.",
  },
  "lc-week-hours": {
    label: "Opening hours",
    closed: "Closed",
    to: "to",
    opens: "Opens on {day}",
    closes: "Closes on {day}",
    nextDay: "next day",
  },
  "lc-select": {
    search: "Search...",
    noResults: "No results",
    placeholder: "Select...",
    add: "Add...",
    count: "{count} of {max}",
  },
  "lc-search": {
    placeholder: "Search...",
    noResults: "No results",
    expand: "Search",
    collapse: "Close search",
    clear: "Clear search",
  },
  "lc-icon-picker": {
    icons: "Icons",
    emoji: "Emoji",
    noIcons: "No icons found",
    noEmoji: "No emoji found",
  },
  "lc-calendar": {
    noneScheduled: "No events scheduled",
    noneThisDay: "No events on this day",
    list: "List",
    week: "Week",
    month: "Month",
  },
  "lc-stories": {
    empty: "Nothing here yet.",
    close: "Close",
    prev: "Previous",
    next: "Next",
  },
  "lc-file-upload": {
    click: "Click to upload",
    drag: "or drag and drop",
  },
  "lc-pricing-card": {
    popular: "Most popular",
  },
  "lc-tag": {
    remove: "Remove tag",
  },
  "lc-app-header": {
    back: "Go back",
  },
  "lc-scroller": {
    left: "Scroll left",
    right: "Scroll right",
  },
  "lc-title-bar": {
    minimize: "Minimize window",
    maximize: "Maximize window",
    restore: "Restore window",
    close: "Close window",
  },
  "lc-navbar": {
    toggle: "Toggle navigation",
  },
  "lc-breadcrumbs": {
    nav: "Breadcrumb",
  },
  "lc-color-picker": {
    pick: "Pick a colour",
    opacity: "Opacity",
    clear: "Clear the colour",
    swatches: "Swatches",
  },
  "lc-image-crop": {
    choose: "Choose a photo",
    drop: "or drop one here",
    frame: "Photo to crop. Drag to move it, pinch or scroll to zoom, or use the arrow keys and plus and minus.",
    loading: "Opening the photo…",
    unreadable: "This photo can't be opened here. Try a JPEG or a PNG.",
    zoom: "Zoom",
    hint: "Drag to move, pinch to zoom",
  },
  "lc-number-input": {
    lower: "Lower {label}",
    edit: "Edit {label}",
    raise: "Raise {label}",
  },
  "lc-darkmode": {
    label: "Dark mode",
  },
  "lc-kanban": {
    addPlaceholder: "Add task...",
  },
  "lc-comment": {
    hidden: "Hidden",
  },
  "lc-avatar": {
    alt: "Avatar",
  },
  "lc-slider": {
    label: "Slider",
  },
  "lc-field": {
    nothingYet: "Nothing yet.",
  },
  "lc-wizard": {
    next: "Next \u2192",
    cancel: "Cancel",
    finish: "Finish",
    step: "Step",
  },
  "lc-auth-form": {
    login: "Login",
    register: "Register",
    createAccount: "Create Account",
    fullName: "Full Name",
    namePlaceholder: "John Doe",
    email: "Email",
    orContinue: "Or continue with",
    google: "Continue with Google",
    apple: "Continue with Apple",
    guest: "Continue as Guest",
    password: "Password",
    passwordPlaceholder: "Enter password",
  },
  "lc-avatar-group": {
    more: "{count} more",
  },
};
