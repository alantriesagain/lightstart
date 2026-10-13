/*
 * The desktop shell's C shim over webview: every function takes the length-delimited strings
 * scriptc passes and the opaque handle it keeps as a bigint, pumps the platform's event loop one
 * step at a time instead of running it (a native call must return, or the script's own loop
 * starves), and reports when the window closed. Linux (GTK) and Windows (Win32) live here; the
 * Cocoa pump is shim_mac.m, reached through desktop_pump_mac.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "webview.h"

#if defined(__linux__) || defined(__FreeBSD__)
#include <gtk/gtk.h>
#define DESKTOP_GTK 1
#elif defined(_WIN32)
#include <windows.h>
#define DESKTOP_WIN32 1
#elif defined(__APPLE__)
#define DESKTOP_COCOA 1
int32_t desktop_pump_mac(void *window, int32_t *closed);
void desktop_watch_close_mac(void *window, int32_t *closed);
#endif

struct desktop {
  webview_t w;
  int32_t closed;
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

void *desktop_create(int32_t debug) {
  struct desktop *d = (struct desktop *)calloc(1, sizeof(struct desktop));
  if (d == NULL) return NULL;
  d->w = webview_create(debug != 0 ? 1 : 0, NULL);
  if (d->w == NULL) {
    free(d);
    return NULL;
  }
#ifdef DESKTOP_GTK
  g_signal_connect(G_OBJECT(webview_get_window(d->w)), "destroy", G_CALLBACK(on_destroy), d);
#endif
#ifdef DESKTOP_COCOA
  desktop_watch_close_mac(webview_get_window(d->w), &d->closed);
#endif
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
  webview_set_size(((struct desktop *)w)->w, (int)width, (int)height, (webview_hint_t)hint);
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

void desktop_terminate(void *w) {
  struct desktop *d = (struct desktop *)w;
  d->closed = 1;
  webview_terminate(d->w);
}

void desktop_destroy(void *w) {
  struct desktop *d = (struct desktop *)w;
  if (!d->closed) webview_destroy(d->w);
  free(d);
}
