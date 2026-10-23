/* Probe T's stub of the desktop shim: no GUI, the same shapes. A pointer handle, (ptr, len)
   strings that may be (NULL, 0), a retained callback with a context pointer fired from a later
   pump call, replies recorded for the script to check, and a paired release. */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef void (*call_fn)(const char *id, const char *req, void *ctx);

struct stub {
  call_fn fn;
  void *ctx;
  int bound;
  int pumps;
  int fired;
  int replies;
  int32_t title_len;
  char reply_json[4][256];
  char reply_id[4][32];
  int32_t reply_status[4];
};

void *stub_create(int32_t debug) {
  struct stub *s = (struct stub *)calloc(1, sizeof(struct stub));
  (void)debug;
  return s;
}

void stub_set_title(void *w, const uint8_t *text, size_t n) {
  struct stub *s = (struct stub *)w;
  s->title_len = (text == NULL) ? -(int32_t)n - 1 : (int32_t)n;
}

int32_t stub_title_len(void *w) {
  return ((struct stub *)w)->title_len;
}

int32_t stub_bind(void *w, const uint8_t *name, size_t n, call_fn fn, void *ctx) {
  struct stub *s = (struct stub *)w;
  (void)name;
  s->fn = fn;
  s->ctx = ctx;
  s->bound = 1;
  return (int32_t)n;
}

void stub_unbind(void *w, const uint8_t *name, size_t n, call_fn fn, void *ctx) {
  struct stub *s = (struct stub *)w;
  (void)name;
  (void)n;
  if (s->fn == fn && s->ctx == ctx) {
    s->fn = NULL;
    s->ctx = NULL;
    s->bound = 0;
  }
}

int32_t stub_bound(void *w) {
  return ((struct stub *)w)->bound;
}

int32_t stub_pump(void *w) {
  struct stub *s = (struct stub *)w;
  s->pumps++;
  if (s->fn != NULL && s->pumps == 3) {
    s->fired++;
    s->fn("7", "[\"echo\",[1,\"a\"]]", s->ctx);
  }
  if (s->fn != NULL && s->pumps == 5) {
    s->fired++;
    s->fn("8", "[\"missing\",[]]", s->ctx);
  }
  if (s->fn != NULL && s->pumps == 6) {
    s->fired++;
    s->fn("9", "[\"$log\",[\"info\",\"h\\u00e9\"]]", s->ctx);
  }
  return s->pumps < 10 ? 1 : 0;
}

int32_t stub_fired(void *w) {
  return ((struct stub *)w)->fired;
}

void stub_return(void *w, const uint8_t *id, size_t idn, int32_t status, const uint8_t *json, size_t jn) {
  struct stub *s = (struct stub *)w;
  int i = s->replies;
  if (i >= 4) return;
  if (idn >= sizeof(s->reply_id[i])) idn = sizeof(s->reply_id[i]) - 1;
  if (jn >= sizeof(s->reply_json[i])) jn = sizeof(s->reply_json[i]) - 1;
  if (id != NULL) memcpy(s->reply_id[i], id, idn);
  s->reply_id[i][idn] = 0;
  if (json != NULL) memcpy(s->reply_json[i], json, jn);
  s->reply_json[i][jn] = 0;
  s->reply_status[i] = status;
  s->replies++;
}

int32_t stub_replies(void *w) {
  return ((struct stub *)w)->replies;
}

int32_t stub_reply_status(void *w, int32_t i) {
  return ((struct stub *)w)->reply_status[i];
}

/* 1 when reply i has the given id and json. */
uint8_t stub_reply_is(void *w, int32_t i, const uint8_t *id, size_t idn, const uint8_t *json, size_t jn) {
  struct stub *s = (struct stub *)w;
  if (i < 0 || i >= s->replies) return 0;
  if (strlen(s->reply_id[i]) != idn || (idn > 0 && memcmp(s->reply_id[i], id, idn) != 0)) return 0;
  if (strlen(s->reply_json[i]) != jn || (jn > 0 && memcmp(s->reply_json[i], json, jn) != 0)) return 0;
  return 1;
}

void stub_destroy(void *w) {
  free(w);
}
