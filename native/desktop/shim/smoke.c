/* The M2 smoke: open a window through the shim and pump it the way the shell will, then close it
   from the program (what a window manager's close does) and report how the pump answered. With
   --wait, keep the window up until the user closes it. */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#if defined(__linux__)
#include <gtk/gtk.h>
#endif

void *desktop_create(int32_t debug);
void *desktop_window(void *w);
void desktop_set_title(void *w, const uint8_t *s, size_t n);
void desktop_set_size(void *w, int32_t width, int32_t height, int32_t hint);
void desktop_set_html(void *w, const uint8_t *s, size_t n);
int32_t desktop_pump(void *w);
void desktop_destroy(void *w);

int main(int argc, char **argv) {
  int wait = argc > 1 && strcmp(argv[1], "--wait") == 0;
  void *w = desktop_create(0);
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
