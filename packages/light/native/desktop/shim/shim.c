/*
 * The desktop shell's C shim over webview: every function takes the length-delimited strings
 * scriptc passes and the opaque handle it keeps as a bigint, pumps the platform's event loop one
 * step at a time instead of running it (a native call must return, or the script's own loop
 * starves), and reports when the window closed. File choosers and message boxes are the
 * non-modal kind, answered inside a later pump through a bound function, so the script's loop
 * never parks. Linux (GTK) and Windows (Win32) live here; the Cocoa pump is shim_mac.m, reached
 * through desktop_pump_mac; dialogs and the inspector are GTK-only until the other backends get
 * theirs.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "webview.h"

#if defined(__linux__) || defined(__FreeBSD__)
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#define DESKTOP_GTK 1
#elif defined(_WIN32)
#include <windows.h>
#define DESKTOP_WIN32 1
#elif defined(__APPLE__)
#define DESKTOP_COCOA 1
int32_t desktop_pump_mac(void *window, int32_t *closed);
void desktop_watch_close_mac(void *window, int32_t *closed);
void desktop_frameless_mac(void *window);
void desktop_begin_move_mac(void *window);
int32_t desktop_state_mac(void *window);
void desktop_minimize_mac(void *window);
void desktop_maximize_mac(void *window, int32_t on);
void desktop_close_mac(void *window);
#endif

#define DESKTOP_FRAMELESS 1
#define DESKTOP_STATE_MAXIMIZED 1
#define DESKTOP_STATE_FULLSCREEN 2
#define DESKTOP_STATE_FOCUSED 4
#define DESKTOP_STATE_MINIMIZED 8
#define DESKTOP_STATE_FRAMELESS 16

typedef void (*desktop_dialog_fn)(int32_t id, int32_t status, const char *paths, void *ctx);

struct dialog_request {
  struct desktop *d;
  int32_t id;
  void *dialog;
  struct dialog_request *next;
};

struct desktop {
  webview_t w;
  int32_t closed;
  int32_t frameless;
  void *own_window;
  desktop_dialog_fn dialog_fn;
  void *dialog_ctx;
  int32_t next_dialog;
  struct dialog_request *dialogs;
};

/* A NUL-terminated copy of a length-delimited string; (NULL, 0) is "". The caller frees. */
static char *dup_span(const uint8_t *s, size_t n) {
  char *out = (char *)malloc(n + 1);
  if (out == NULL) return NULL;
  if (n > 0 && s != NULL) memcpy(out, s, n);
  out[n] = 0;
  return out;
}

#ifdef DESKTOP_GTK
static void on_destroy(GtkWidget *widget, gpointer data) {
  struct desktop *d = (struct desktop *)data;
  (void)widget;
  d->closed = 1;
}
#endif

#ifdef DESKTOP_GTK
/* A window with client-side decorations and an empty, never-shown titlebar: no title bar is drawn,
   GTK keeps its resize handles in the shadow margin. It has to be set before the window is
   realized, which webview does inside webview_create for a window it owns, so the shim creates the
   window and hands it over. */
static GtkWidget *frameless_window(void) {
  if (!gtk_init_check(NULL, NULL)) return NULL;
  GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
  gtk_window_set_titlebar(GTK_WINDOW(window), gtk_label_new(NULL));
  gtk_style_context_add_class(gtk_widget_get_style_context(window), "light-frameless");
  return window;
}
#endif

/* flags: DESKTOP_FRAMELESS asks for a window without the system title bar (GTK: client-side
   decorations with no titlebar; Cocoa: a transparent, full-size-content title bar that keeps the
   traffic lights; Win32: ignored, the native caption stays). */
void *desktop_create(int32_t debug, int32_t flags) {
  struct desktop *d = (struct desktop *)calloc(1, sizeof(struct desktop));
  if (d == NULL) return NULL;
  void *given = NULL;
#ifdef DESKTOP_GTK
  if ((flags & DESKTOP_FRAMELESS) != 0) {
    given = frameless_window();
    if (given == NULL) {
      free(d);
      return NULL;
    }
  }
#endif
  d->w = webview_create(debug != 0 ? 1 : 0, given);
  if (d->w == NULL) {
#ifdef DESKTOP_GTK
    if (given != NULL) gtk_widget_destroy(GTK_WIDGET(given));
#endif
    free(d);
    return NULL;
  }
#ifdef DESKTOP_GTK
  if (given != NULL) {
    d->own_window = given;
    d->frameless = 1;
    GtkWidget *view = (GtkWidget *)webview_get_native_handle(d->w, WEBVIEW_NATIVE_HANDLE_KIND_UI_WIDGET);
    if (view != NULL) gtk_widget_grab_focus(view);
    gtk_widget_show(GTK_WIDGET(given));
  }
  g_signal_connect(G_OBJECT(webview_get_window(d->w)), "destroy", G_CALLBACK(on_destroy), d);
#endif
#ifdef DESKTOP_COCOA
  desktop_watch_close_mac(webview_get_window(d->w), &d->closed);
  if ((flags & DESKTOP_FRAMELESS) != 0) {
    desktop_frameless_mac(webview_get_window(d->w));
    d->frameless = 1;
  }
#endif
  (void)flags;
  return d;
}

void *desktop_window(void *w) {
  return webview_get_window(((struct desktop *)w)->w);
}

void desktop_set_title(void *w, const uint8_t *s, size_t n) {
  char *text = dup_span(s, n);
  if (text == NULL) return;
  webview_set_title(((struct desktop *)w)->w, text);
  free(text);
}

void desktop_set_size(void *w, int32_t width, int32_t height, int32_t hint) {
  struct desktop *d = (struct desktop *)w;
  webview_set_size(d->w, (int)width, (int)height, (webview_hint_t)hint);
#ifdef DESKTOP_COCOA
  /* webview rewrites the style mask when it sizes a Cocoa window. */
  if (d->frameless) desktop_frameless_mac(webview_get_window(d->w));
#endif
}

void desktop_navigate(void *w, const uint8_t *s, size_t n) {
  char *url = dup_span(s, n);
  if (url == NULL) return;
  webview_navigate(((struct desktop *)w)->w, url);
  free(url);
}

void desktop_set_html(void *w, const uint8_t *s, size_t n) {
  char *html = dup_span(s, n);
  if (html == NULL) return;
  webview_set_html(((struct desktop *)w)->w, html);
  free(html);
}

void desktop_init(void *w, const uint8_t *s, size_t n) {
  char *js = dup_span(s, n);
  if (js == NULL) return;
  webview_init(((struct desktop *)w)->w, js);
  free(js);
}

void desktop_eval(void *w, const uint8_t *s, size_t n) {
  char *js = dup_span(s, n);
  if (js == NULL) return;
  webview_eval(((struct desktop *)w)->w, js);
  free(js);
}

int32_t desktop_bind(void *w, const uint8_t *s, size_t n, void (*fn)(const char *id, const char *req, void *ctx), void *ctx) {
  char *name = dup_span(s, n);
  if (name == NULL) return -1;
  int32_t rc = (int32_t)webview_bind(((struct desktop *)w)->w, name, fn, ctx);
  free(name);
  return rc;
}

void desktop_unbind(void *w, const uint8_t *s, size_t n, void (*fn)(const char *id, const char *req, void *ctx), void *ctx) {
  char *name = dup_span(s, n);
  (void)fn;
  (void)ctx;
  if (name == NULL) return;
  webview_unbind(((struct desktop *)w)->w, name);
  free(name);
}

void desktop_return(void *w, const uint8_t *id, size_t idn, int32_t status, const uint8_t *json, size_t jn) {
  char *rid = dup_span(id, idn);
  char *result = dup_span(json, jn);
  if (rid != NULL && result != NULL) webview_return(((struct desktop *)w)->w, rid, (int)status, result);
  free(rid);
  free(result);
}

/* One step of the platform loop: drain what is pending without blocking. 1 while the window
   lives, 0 once it closed. */
int32_t desktop_pump(void *w) {
  struct desktop *d = (struct desktop *)w;
  if (d->closed) return 0;
#ifdef DESKTOP_GTK
  for (int i = 0; i < 32 && g_main_context_pending(NULL); i++) g_main_context_iteration(NULL, FALSE);
#endif
#ifdef DESKTOP_WIN32
  MSG msg;
  for (int i = 0; i < 64 && PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE); i++) {
    if (msg.message == WM_QUIT) {
      d->closed = 1;
      break;
    }
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  if (!d->closed && !IsWindow((HWND)webview_get_window(d->w))) d->closed = 1;
#endif
#ifdef DESKTOP_COCOA
  desktop_pump_mac(webview_get_window(d->w), &d->closed);
#endif
  return d->closed ? 0 : 1;
}

static void unlink_dialog(struct dialog_request *request) {
  struct dialog_request **at = &request->d->dialogs;
  while (*at != NULL && *at != request) at = &(*at)->next;
  if (*at == request) *at = request->next;
}

static void finish_dialog(struct dialog_request *request, int32_t status, const char *paths) {
  struct desktop *d = request->d;
  unlink_dialog(request);
  if (d->dialog_fn != NULL) d->dialog_fn(request->id, status, paths == NULL ? "" : paths, d->dialog_ctx);
#ifdef DESKTOP_GTK
  if (request->dialog != NULL) g_object_unref(request->dialog);
#endif
  free(request);
}

#ifdef DESKTOP_GTK
static void on_dialog_response(GtkNativeDialog *dialog, gint response, gpointer data) {
  struct dialog_request *request = (struct dialog_request *)data;
  if (response != GTK_RESPONSE_ACCEPT) {
    finish_dialog(request, 0, "");
    return;
  }
  GSList *files = gtk_file_chooser_get_filenames(GTK_FILE_CHOOSER(dialog));
  size_t total = 1;
  for (GSList *f = files; f != NULL; f = f->next) total += strlen((const char *)f->data) + 1;
  char *joined = (char *)malloc(total);
  if (joined == NULL) {
    g_slist_free_full(files, g_free);
    finish_dialog(request, 2, "");
    return;
  }
  joined[0] = 0;
  for (GSList *f = files; f != NULL; f = f->next) {
    if (joined[0] != 0) strcat(joined, "\n");
    strcat(joined, (const char *)f->data);
  }
  g_slist_free_full(files, g_free);
  finish_dialog(request, 1, joined);
  free(joined);
}

static void on_message_response(GtkDialog *dialog, gint response, gpointer data) {
  (void)response;
  (void)data;
  gtk_widget_destroy(GTK_WIDGET(dialog));
}
#endif

/* Register the one function dialog results arrive through: (id, status, paths); status 0 is
   cancelled, 1 chosen (paths newline-joined), 2 failed. */
int32_t desktop_dialog_bind(void *w, desktop_dialog_fn fn, void *ctx) {
  struct desktop *d = (struct desktop *)w;
  d->dialog_fn = fn;
  d->dialog_ctx = ctx;
  return 0;
}

void desktop_dialog_unbind(void *w, desktop_dialog_fn fn, void *ctx) {
  struct desktop *d = (struct desktop *)w;
  (void)fn;
  (void)ctx;
  d->dialog_fn = NULL;
  d->dialog_ctx = NULL;
}

/* Open a file chooser: kind 0 opens files, 1 a folder, 2 saves. Non-modal; its response arrives
   inside a later pump through the bound function. Answers the request's id, or -1. */
int32_t desktop_dialog_open(void *w, int32_t kind, const uint8_t *ts, size_t tn, const uint8_t *ps, size_t pn, int32_t multi) {
  struct desktop *d = (struct desktop *)w;
  char *title = dup_span(ts, tn);
  char *path = dup_span(ps, pn);
  struct dialog_request *request = (struct dialog_request *)calloc(1, sizeof(struct dialog_request));
  int32_t id = -1;
  if (title != NULL && path != NULL && request != NULL) {
#ifdef DESKTOP_GTK
    GtkFileChooserAction action = kind == 1 ? GTK_FILE_CHOOSER_ACTION_SELECT_FOLDER : kind == 2 ? GTK_FILE_CHOOSER_ACTION_SAVE : GTK_FILE_CHOOSER_ACTION_OPEN;
    GtkFileChooserNative *dialog = gtk_file_chooser_native_new(title[0] != 0 ? title : NULL, GTK_WINDOW(webview_get_window(d->w)), action, kind == 2 ? "_Save" : "_Open", "_Cancel");
    if (kind != 1) gtk_file_chooser_set_select_multiple(GTK_FILE_CHOOSER(dialog), multi != 0 && kind == 0);
    if (path[0] != 0) {
      if (kind == 2) gtk_file_chooser_set_filename(GTK_FILE_CHOOSER(dialog), path);
      else gtk_file_chooser_set_current_folder(GTK_FILE_CHOOSER(dialog), path);
    }
    if (kind == 2) gtk_file_chooser_set_do_overwrite_confirmation(GTK_FILE_CHOOSER(dialog), TRUE);
    request->d = d;
    request->id = ++d->next_dialog;
    request->dialog = dialog;
    request->next = d->dialogs;
    d->dialogs = request;
    g_signal_connect(dialog, "response", G_CALLBACK(on_dialog_response), request);
    gtk_native_dialog_show(GTK_NATIVE_DIALOG(dialog));
    id = request->id;
    request = NULL;
#else
    (void)kind;
    (void)multi;
#endif
  }
  free(title);
  free(path);
  free(request);
  return id;
}

/* Withdraw a pending dialog; its result arrives as cancelled. */
void desktop_dialog_cancel(void *w, int32_t id) {
  struct desktop *d = (struct desktop *)w;
  for (struct dialog_request *r = d->dialogs; r != NULL; r = r->next)
    if (r->id == id) {
#ifdef DESKTOP_GTK
      gtk_native_dialog_hide(GTK_NATIVE_DIALOG(r->dialog));
#endif
      finish_dialog(r, 0, "");
      return;
    }
}

/* A non-modal message box; closing it is the only answer. */
void desktop_message(void *w, const uint8_t *ts, size_t tn, const uint8_t *ms, size_t mn) {
  struct desktop *d = (struct desktop *)w;
  char *title = dup_span(ts, tn);
  char *text = dup_span(ms, mn);
  if (title != NULL && text != NULL) {
#ifdef DESKTOP_GTK
    GtkWidget *dialog = gtk_message_dialog_new(GTK_WINDOW(webview_get_window(d->w)), GTK_DIALOG_DESTROY_WITH_PARENT, GTK_MESSAGE_ERROR, GTK_BUTTONS_CLOSE, "%s", text);
    gtk_window_set_title(GTK_WINDOW(dialog), title);
    g_signal_connect(dialog, "response", G_CALLBACK(on_message_response), NULL);
    gtk_widget_show(dialog);
#else
    (void)d;
#endif
  }
  free(title);
  free(text);
}

void desktop_minimize(void *w) {
#ifdef DESKTOP_COCOA
  desktop_minimize_mac(webview_get_window(((struct desktop *)w)->w));
#endif
#ifdef DESKTOP_GTK
  gtk_window_iconify(GTK_WINDOW(webview_get_window(((struct desktop *)w)->w)));
#endif
#ifdef DESKTOP_WIN32
  ShowWindow((HWND)webview_get_window(((struct desktop *)w)->w), SW_MINIMIZE);
#endif
}

void desktop_maximize(void *w, int32_t on) {
#ifdef DESKTOP_COCOA
  desktop_maximize_mac(webview_get_window(((struct desktop *)w)->w), on);
#endif
#ifdef DESKTOP_GTK
  GtkWindow *window = GTK_WINDOW(webview_get_window(((struct desktop *)w)->w));
  if (on != 0) gtk_window_maximize(window);
  else gtk_window_unmaximize(window);
#endif
#ifdef DESKTOP_WIN32
  ShowWindow((HWND)webview_get_window(((struct desktop *)w)->w), on != 0 ? SW_MAXIMIZE : SW_RESTORE);
#endif
}

int32_t desktop_is_maximized(void *w) {
#ifdef DESKTOP_COCOA
  return (desktop_state_mac(webview_get_window(((struct desktop *)w)->w)) & DESKTOP_STATE_MAXIMIZED) != 0 ? 1 : 0;
#endif
#ifdef DESKTOP_GTK
  return gtk_window_is_maximized(GTK_WINDOW(webview_get_window(((struct desktop *)w)->w))) ? 1 : 0;
#endif
#ifdef DESKTOP_WIN32
  return IsZoomed((HWND)webview_get_window(((struct desktop *)w)->w)) ? 1 : 0;
#endif
  return 0;
}

/* Start moving the window with the pointer, as a press on a title bar does. Called from a page
   call that arrives in a later pump than the page's mousedown, so it does nothing once the button
   is up (a quick click must not start a move). x and y are where the press happened, in screen
   coordinates: the move is anchored there, so the point that was grabbed stays under the pointer
   however far it travelled before the call arrived; negative means "where the pointer is now". */
void desktop_begin_move(void *w, int32_t x, int32_t y) {
  struct desktop *d = (struct desktop *)w;
  if (d->closed) return;
#ifdef DESKTOP_GTK
  GtkWindow *window = GTK_WINDOW(webview_get_window(d->w));
  GdkWindow *gdkwin = gtk_widget_get_window(GTK_WIDGET(window));
  if (gdkwin == NULL) return;
  GdkDevice *pointer = gdk_seat_get_pointer(gdk_display_get_default_seat(gdk_window_get_display(gdkwin)));
  GdkModifierType mask = 0;
  gdk_window_get_device_position(gdkwin, pointer, NULL, NULL, &mask);
  if ((mask & GDK_BUTTON1_MASK) == 0) return;
  gint px = x;
  gint py = y;
  if (x < 0 || y < 0) gdk_device_get_position(pointer, NULL, &px, &py);
  gtk_window_begin_move_drag(window, 1, px, py, GDK_CURRENT_TIME);
#endif
#ifdef DESKTOP_COCOA
  (void)x;
  (void)y;
  desktop_begin_move_mac(webview_get_window(d->w));
#endif
}

/* Ask the platform to close the window, as its own close button does: the window goes away on a
   later pump and the pump reports it, so nothing is freed while a page call is being answered. */
void desktop_close(void *w) {
  struct desktop *d = (struct desktop *)w;
  if (d->closed) return;
#ifdef DESKTOP_GTK
  gtk_window_close(GTK_WINDOW(webview_get_window(d->w)));
#endif
#ifdef DESKTOP_WIN32
  PostMessageW((HWND)webview_get_window(d->w), WM_CLOSE, 0, 0);
#endif
#ifdef DESKTOP_COCOA
  desktop_close_mac(webview_get_window(d->w));
#endif
}

/* The window's state as bits: maximized 1, fullscreen 2, focused 4, minimized 8, frameless 16. */
int32_t desktop_window_state(void *w) {
  struct desktop *d = (struct desktop *)w;
  int32_t bits = d->frameless ? DESKTOP_STATE_FRAMELESS : 0;
  if (d->closed) return bits;
#ifdef DESKTOP_GTK
  GtkWidget *window = GTK_WIDGET(webview_get_window(d->w));
  GdkWindow *gdkwin = gtk_widget_get_window(window);
  if (gdkwin != NULL) {
    GdkWindowState state = gdk_window_get_state(gdkwin);
    if ((state & GDK_WINDOW_STATE_MAXIMIZED) != 0) bits |= DESKTOP_STATE_MAXIMIZED;
    if ((state & GDK_WINDOW_STATE_FULLSCREEN) != 0) bits |= DESKTOP_STATE_FULLSCREEN;
    if ((state & GDK_WINDOW_STATE_ICONIFIED) != 0) bits |= DESKTOP_STATE_MINIMIZED;
  }
  if (gtk_window_is_active(GTK_WINDOW(window))) bits |= DESKTOP_STATE_FOCUSED;
#endif
#ifdef DESKTOP_WIN32
  HWND hwnd = (HWND)webview_get_window(d->w);
  if (IsZoomed(hwnd)) bits |= DESKTOP_STATE_MAXIMIZED;
  if (IsIconic(hwnd)) bits |= DESKTOP_STATE_MINIMIZED;
  if (GetForegroundWindow() == hwnd) bits |= DESKTOP_STATE_FOCUSED;
#endif
#ifdef DESKTOP_COCOA
  bits |= desktop_state_mac(webview_get_window(d->w));
#endif
  return bits;
}

/* Show the engine's inspector (developer tools); needs the view created with debug. */
void desktop_inspector(void *w) {
#ifdef DESKTOP_GTK
  WebKitWebView *view = (WebKitWebView *)webview_get_native_handle(((struct desktop *)w)->w, WEBVIEW_NATIVE_HANDLE_KIND_BROWSER_CONTROLLER);
  if (view != NULL) webkit_web_inspector_show(webkit_web_view_get_inspector(view));
#endif
}

void desktop_terminate(void *w) {
  struct desktop *d = (struct desktop *)w;
  d->closed = 1;
  webview_terminate(d->w);
}

void desktop_destroy(void *w) {
  struct desktop *d = (struct desktop *)w;
  while (d->dialogs != NULL) finish_dialog(d->dialogs, 0, "");
  if (!d->closed) {
    webview_destroy(d->w);
#ifdef DESKTOP_GTK
    /* webview only detaches its view from a window it was given; the window is the shim's. */
    if (d->own_window != NULL) {
      gtk_widget_destroy(GTK_WIDGET(d->own_window));
      for (int i = 0; i < 64 && g_main_context_pending(NULL); i++) g_main_context_iteration(NULL, FALSE);
    }
#endif
  }
  free(d);
}
