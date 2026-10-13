/* The shim's smoke: open a window through the shim and pump it the way the shell will, then close
   it from the program (what a window manager's close does) and report how the pump answered. With
   --wait, keep the window up until the user closes it. With --frameless, open a window without the
   system title bar and check its state bits, that it has client-side decorations, that maximize
   and restore reach the state, and that a close through the shim ends the pump. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#if defined(__linux__)
#include <gtk/gtk.h>
#endif

void *desktop_create(int32_t debug, int32_t flags);
int32_t desktop_window_state(void *w);
void desktop_maximize(void *w, int32_t on);
void desktop_close(void *w);
void *desktop_window(void *w);
void desktop_set_title(void *w, const uint8_t *s, size_t n);
void desktop_set_size(void *w, int32_t width, int32_t height, int32_t hint);
void desktop_set_html(void *w, const uint8_t *s, size_t n);
int32_t desktop_pump(void *w);
void desktop_destroy(void *w);

/* Pump until the state has (or lacks) the bit, at most two seconds. */
static int pump_until(void *w, int32_t bit, int set) {
  for (int i = 0; i < 250; i++) {
    desktop_pump(w);
    if (((desktop_window_state(w) & bit) != 0) == (set != 0)) return 1;
    usleep(8000);
  }
  return 0;
}

static int frameless(void) {
  void *w = desktop_create(0, 1);
  if (w == NULL) {
    puts("create failed");
    return 2;
  }
  const char *title = "light desktop smoke (frameless)";
  desktop_set_title(w, (const uint8_t *)title, strlen(title));
  desktop_set_size(w, 480, 240, 0);
  const char *html = "<!doctype html><body style=\"margin:0;font: 16px sans-serif\"><div style=\"height:32px;background:#334;color:#fff;padding:6px 10px\">frameless</div></body>";
  desktop_set_html(w, (const uint8_t *)html, strlen(html));
  for (int i = 0; i < 60; i++) {
    desktop_pump(w);
    usleep(8000);
  }
  int is_frameless = (desktop_window_state(w) & 16) != 0;
  int csd = 0;
#if defined(__linux__)
  csd = gtk_style_context_has_class(gtk_widget_get_style_context(GTK_WIDGET(desktop_window(w))), "csd");
#endif
  desktop_maximize(w, 1);
  int maximize = pump_until(w, 1, 1);
  desktop_maximize(w, 0);
  int restore = pump_until(w, 1, 0);
  desktop_close(w);
  int alive = 1;
  for (int i = 0; i < 250 && alive; i++) {
    alive = desktop_pump(w);
    usleep(8000);
  }
  printf("frameless=%d csd=%d maximize=%d restore=%d closed=%d\n", is_frameless, csd, maximize, restore, alive ? 0 : 1);
  desktop_destroy(w);
  return is_frameless && csd && maximize && restore && !alive ? 0 : 1;
}

int main(int argc, char **argv) {
  int wait = argc > 1 && strcmp(argv[1], "--wait") == 0;
  if (argc > 1 && strcmp(argv[1], "--frameless") == 0) return frameless();
  void *w = desktop_create(0, 0);
  if (w == NULL) {
    puts("create failed");
    return 2;
  }
  const char *title = "light desktop smoke";
  desktop_set_title(w, (const uint8_t *)title, strlen(title));
  desktop_set_size(w, 480, 240, 0);
  const char *html = "<!doctype html><body style=\"font: 20px sans-serif; padding: 24px\"><h1>light desktop</h1><p>smoke: the shim pumps the loop</p></body>";
  desktop_set_html(w, (const uint8_t *)html, strlen(html));
  int pumps = 0;
  int alive = 1;
  while (alive && (wait || pumps < 400)) {
    alive = desktop_pump(w);
    pumps++;
    usleep(8000);
#if defined(__linux__)
    if (!wait && pumps == 120) gtk_window_close(GTK_WINDOW(desktop_window(w)));
#endif
  }
  printf("pumps=%d closed=%d\n", pumps, alive ? 0 : 1);
  desktop_destroy(w);
  return alive ? 1 : 0;
}
