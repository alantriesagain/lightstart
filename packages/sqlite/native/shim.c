/*
 * The native edge of @lightstart/sqlite: a small synchronous API over one
 * SQLite connection. FFI cannot return strings or bytes, so a JSON result is
 * built here and written into the caller's buffer; the answer is its length,
 * or minus the size it needs when the buffer is short. A statement and a
 * database are opaque handles.
 */

#include "sqlite3.h"

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  char *data;
  size_t len;
  size_t cap;
  int failed;
} buffer;

static int buffer_grow(buffer *b, size_t need) {
  if (b->failed) return 0;
  if (b->len + need <= b->cap) return 1;
  size_t cap = b->cap == 0 ? 256 : b->cap;
  while (cap < b->len + need) cap *= 2;
  char *data = (char *)realloc(b->data, cap);
  if (data == NULL) {
    b->failed = 1;
    return 0;
  }
  b->data = data;
  b->cap = cap;
  return 1;
}

static void buffer_raw(buffer *b, const char *text, size_t len) {
  if (!buffer_grow(b, len)) return;
  memcpy(b->data + b->len, text, len);
  b->len += len;
}

static void buffer_char(buffer *b, char c) {
  if (!buffer_grow(b, 1)) return;
  b->data[b->len++] = c;
}

static void buffer_text(buffer *b, const char *text) {
  buffer_raw(b, text, strlen(text));
}

static void buffer_escaped(buffer *b, const unsigned char *text, int len) {
  static const char hex[] = "0123456789abcdef";
  buffer_char(b, '"');
  for (int i = 0; i < len; i++) {
    unsigned char c = text[i];
    if (c == '"') buffer_text(b, "\\\"");
    else if (c == '\\') buffer_text(b, "\\\\");
    else if (c == '\b') buffer_text(b, "\\b");
    else if (c == '\f') buffer_text(b, "\\f");
    else if (c == '\n') buffer_text(b, "\\n");
    else if (c == '\r') buffer_text(b, "\\r");
    else if (c == '\t') buffer_text(b, "\\t");
    else if (c < 0x20) {
      char escaped[6] = { '\\', 'u', '0', '0', hex[(c >> 4) & 0xf], hex[c & 0xf] };
      buffer_raw(b, escaped, 6);
    } else buffer_char(b, (char)c);
  }
  buffer_char(b, '"');
}

void *sqlite_shim_open(const char *path, size_t len, int read_only) {
  sqlite3 *db = NULL;
  char *copy = (char *)malloc(len + 1);
  if (copy == NULL) return NULL;
  memcpy(copy, path, len);
  copy[len] = '\0';
  int flags = read_only ? SQLITE_OPEN_READONLY : (SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE);
  int rc = sqlite3_open_v2(copy, &db, flags | SQLITE_OPEN_FULLMUTEX, NULL);
  free(copy);
  if (rc != SQLITE_OK) {
    if (db != NULL) sqlite3_close(db);
    return NULL;
  }
  sqlite3_extended_result_codes(db, 0);
  return (void *)db;
}

void sqlite_shim_close(void *handle) {
  if (handle != NULL) sqlite3_close((sqlite3 *)handle);
}

int sqlite_shim_errmsg(void *handle, unsigned char *out, size_t cap) {
  const char *message = handle == NULL ? "sqlite: no database" : sqlite3_errmsg((sqlite3 *)handle);
  size_t len = strlen(message);
  size_t needed = len + 1;
  if (cap < needed) return (int)(-((int64_t)needed));
  memcpy(out, message, len);
  out[len] = '\0';
  return (int)len;
}

void *sqlite_shim_prepare(void *handle, const char *sql, size_t len) {
  sqlite3_stmt *statement = NULL;
  int rc = sqlite3_prepare_v2((sqlite3 *)handle, sql, (int)len, &statement, NULL);
  if (rc != SQLITE_OK) {
    if (statement != NULL) sqlite3_finalize(statement);
    return NULL;
  }
  return (void *)statement;
}

int sqlite_shim_finalize(void *statement) {
  return sqlite3_finalize((sqlite3_stmt *)statement);
}

int sqlite_shim_bind_null(void *statement, int index) {
  return sqlite3_bind_null((sqlite3_stmt *)statement, index);
}

int sqlite_shim_bind_double(void *statement, int index, double value) {
  return sqlite3_bind_double((sqlite3_stmt *)statement, index, value);
}

int sqlite_shim_bind_int(void *statement, int index, int64_t value) {
  return sqlite3_bind_int64((sqlite3_stmt *)statement, index, (sqlite3_int64)value);
}

int sqlite_shim_bind_text(void *statement, int index, const char *value, size_t len) {
  return sqlite3_bind_text((sqlite3_stmt *)statement, index, value, (int)len, SQLITE_TRANSIENT);
}

int sqlite_shim_bind_blob(void *statement, int index, const unsigned char *value, size_t len) {
  return sqlite3_bind_blob((sqlite3_stmt *)statement, index, value, (int)len, SQLITE_TRANSIENT);
}

int sqlite_shim_bind_index(void *statement, const char *name, size_t len) {
  char *copy = (char *)malloc(len + 1);
  if (copy == NULL) return 0;
  memcpy(copy, name, len);
  copy[len] = '\0';
  int index = sqlite3_bind_parameter_index((sqlite3_stmt *)statement, copy);
  free(copy);
  return index;
}

int sqlite_shim_clear_bindings(void *statement) {
  return sqlite3_clear_bindings((sqlite3_stmt *)statement);
}

int sqlite_shim_reset(void *statement) {
  return sqlite3_reset((sqlite3_stmt *)statement);
}

int sqlite_shim_step(void *statement) {
  return sqlite3_step((sqlite3_stmt *)statement);
}

static int append_value(buffer *b, sqlite3_stmt *statement, int column) {
  int type = sqlite3_column_type(statement, column);
  if (type == SQLITE_NULL) {
    buffer_text(b, "null");
    return 1;
  }
  if (type == SQLITE_INTEGER) {
    char text[32];
    sqlite3_snprintf(sizeof(text), text, "%lld", (long long)sqlite3_column_int64(statement, column));
    buffer_text(b, text);
    return 1;
  }
  if (type == SQLITE_FLOAT) {
    double value = sqlite3_column_double(statement, column);
    if (isnan(value) || isinf(value)) {
      buffer_text(b, "null");
      return 1;
    }
    char text[64];
    for (int precision = 1; precision <= 17; precision++) {
      snprintf(text, sizeof(text), "%.*g", precision, value);
      if (strtod(text, NULL) == value) break;
    }
    char *exponent = strchr(text, 'e');
    if (exponent != NULL) {
      char *digits = exponent + 1;
      if (*digits == '+' || *digits == '-') digits++;
      while (digits[0] == '0' && digits[1] >= '0' && digits[1] <= '9') memmove(digits, digits + 1, strlen(digits));
    }
    buffer_text(b, text);
    return 1;
  }
  const unsigned char *text = sqlite3_column_text(statement, column);
  int len = sqlite3_column_bytes(statement, column);
  buffer_escaped(b, text == NULL ? (const unsigned char *)"" : text, len);
  return 1;
}

int64_t sqlite_shim_json(void *handle, unsigned char *out, size_t cap) {
  sqlite3_stmt *statement = (sqlite3_stmt *)handle;
  sqlite3_reset(statement);
  buffer b = { NULL, 0, 0, 0 };
  buffer_char(&b, '[');
  int row = 0;
  int rc = SQLITE_OK;
  for (;;) {
    rc = sqlite3_step(statement);
    if (rc == SQLITE_DONE) break;
    if (rc != SQLITE_ROW) {
      free(b.data);
      return -2;
    }
    if (row++ > 0) buffer_char(&b, ',');
    buffer_char(&b, '{');
    int columns = sqlite3_column_count(statement);
    for (int i = 0; i < columns; i++) {
      if (i > 0) buffer_char(&b, ',');
      const char *name = sqlite3_column_name(statement, i);
      buffer_escaped(&b, (const unsigned char *)name, (int)strlen(name));
      buffer_char(&b, ':');
      append_value(&b, statement, i);
    }
    buffer_char(&b, '}');
    if (b.failed) {
      free(b.data);
      return -2;
    }
  }
  buffer_char(&b, ']');
  if (b.failed) {
    free(b.data);
    return -2;
  }
  size_t needed = b.len + 1;
  if (cap < needed) {
    free(b.data);
    return -(int64_t)needed;
  }
  memcpy(out, b.data, b.len);
  size_t len = b.len;
  free(b.data);
  return (int64_t)len;
}

int sqlite_shim_run(void *handle) {
  sqlite3_stmt *statement = (sqlite3_stmt *)handle;
  sqlite3_reset(statement);
  return sqlite3_step(statement);
}

int64_t sqlite_shim_changes(void *handle) {
  return (int64_t)sqlite3_changes64((sqlite3 *)handle);
}

int64_t sqlite_shim_last_id(void *handle) {
  return (int64_t)sqlite3_last_insert_rowid((sqlite3 *)handle);
}

int sqlite_shim_exec(void *handle, const char *sql, size_t len) {
  char *copy = (char *)malloc(len + 1);
  if (copy == NULL) return SQLITE_NOMEM;
  memcpy(copy, sql, len);
  copy[len] = '\0';
  int rc = sqlite3_exec((sqlite3 *)handle, copy, NULL, NULL, NULL);
  free(copy);
  return rc;
}
