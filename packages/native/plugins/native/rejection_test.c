// A rejected promise with no handler is reported by wcjs_jobs, not by the eval that made it.
// This links the real shim and QuickJS, so it covers the path the node stand-in cannot.
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef void (*wcjs_result_cb)(int32_t status, const uint8_t *text, size_t len, void *context);
extern void *wcjs_new(int32_t memory_mb, int32_t budget_ms);
extern void wcjs_free(void *p);
extern int32_t wcjs_eval(void *p, const uint8_t *code, size_t code_len, const uint8_t *file, size_t file_len, wcjs_result_cb done, void *context);
extern int32_t wcjs_jobs(void *p, wcjs_result_cb done, void *context);

static int32_t last_status = -1;
static char last_text[512];

static void done(int32_t status, const uint8_t *text, size_t len, void *context) {
  (void)context;
  last_status = status;
  size_t n = len < sizeof(last_text) - 1 ? len : sizeof(last_text) - 1;
  memcpy(last_text, text, n);
  last_text[n] = 0;
}

int main(void) {
  void *w = wcjs_new(16, 1000);
  if (w == NULL) {
    printf("no context\n");
    return 1;
  }
  static const char code[] = "Promise.reject(new Error('unhandled from a plugin'));";
  wcjs_eval(w, (const uint8_t *)code, strlen(code), (const uint8_t *)"reject.js", 9, done, NULL);
  int32_t evaled = last_status;
  last_status = -1;
  last_text[0] = 0;
  wcjs_jobs(w, done, NULL);
  printf("eval=%d jobs=%d text=%s\n", evaled, last_status, last_text);
  wcjs_free(w);
  return 0;
}
