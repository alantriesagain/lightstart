/*
 * The native edge of @lightstart/sqlite: a small synchronous API over one
 * SQLite connection. FFI cannot return strings or bytes, so a JSON result is
 * built here and written into the caller's buffer; the answer is its length,
 * or minus the size it needs when the buffer is short. A result is kept on the
 * statement, so a short buffer copies it out instead of running the statement
 * again. A statement and a database are opaque handles.
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

typedef struct {
  sqlite3_stmt *stmt;
  char *json;
  size_t json_len;
  char *row;
  size_t row_len;
  int row_null;
} shim_statement;

static shim_statement *as_statement(void *handle) {
  return (shim_statement *)handle;
}

static void invalidate(shim_statement *statement) {
  if (statement->json != NULL) free(statement->json);
  statement->json = NULL;
  statement->json_len = 0;
  if (statement->row != NULL) free(statement->row);
  statement->row = NULL;
  statement->row_len = 0;
  statement->row_null = 0;
}

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
  int rc = sqlite3_open_v2(copy, &db, flags | SQLITE_OPEN_NOMUTEX, NULL);
  free(copy);
  if (rc != SQLITE_OK) {
    if (db != NULL) sqlite3_close(db);
    return NULL;
  }
  sqlite3_extended_result_codes(db, 0);
  return (void *)db;
}

void sqlite_shim_close(void *handle) {
  if (handle != NULL) sqlite3_close_v2((sqlite3 *)handle);
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
  sqlite3_stmt *raw = NULL;
  int rc = sqlite3_prepare_v2((sqlite3 *)handle, sql, (int)len, &raw, NULL);
  if (rc != SQLITE_OK) {
    if (raw != NULL) sqlite3_finalize(raw);
    return NULL;
  }
  shim_statement *statement = (shim_statement *)malloc(sizeof(shim_statement));
  if (statement == NULL) {
    sqlite3_finalize(raw);
    return NULL;
  }
  statement->stmt = raw;
  statement->json = NULL;
  statement->json_len = 0;
  statement->row = NULL;
  statement->row_len = 0;
  statement->row_null = 0;
  return (void *)statement;
}

int sqlite_shim_finalize(void *handle) {
  if (handle == NULL) return SQLITE_OK;
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  int rc = sqlite3_finalize(statement->stmt);
  free(statement);
  return rc;
}

int sqlite_shim_bind_null(void *handle, int index) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_null(statement->stmt, index);
}

int sqlite_shim_bind_double(void *handle, int index, double value) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_double(statement->stmt, index, value);
}

int sqlite_shim_bind_int(void *handle, int index, int64_t value) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_int64(statement->stmt, index, (sqlite3_int64)value);
}

int sqlite_shim_bind_int32(void *handle, int index, int32_t value) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_int(statement->stmt, index, value);
}

int sqlite_shim_bind_text(void *handle, int index, const char *value, size_t len) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_text(statement->stmt, index, value, (int)len, SQLITE_TRANSIENT);
}

int sqlite_shim_bind_blob(void *handle, int index, const unsigned char *value, size_t len) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_bind_blob(statement->stmt, index, value, (int)len, SQLITE_TRANSIENT);
}

int sqlite_shim_bind_index(void *handle, const char *name, size_t len) {
  shim_statement *statement = as_statement(handle);
  char *copy = (char *)malloc(len + 1);
  if (copy == NULL) return 0;
  memcpy(copy, name, len);
  copy[len] = '\0';
  int index = sqlite3_bind_parameter_index(statement->stmt, copy);
  free(copy);
  return index;
}

int sqlite_shim_clear_bindings(void *handle) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_clear_bindings(statement->stmt);
}

int sqlite_shim_ready(void *handle) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  sqlite3_reset(statement->stmt);
  return sqlite3_clear_bindings(statement->stmt);
}

int sqlite_shim_reset(void *handle) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_reset(statement->stmt);
}

int sqlite_shim_columns(void *handle) {
  return sqlite3_column_count(as_statement(handle)->stmt);
}

int sqlite_shim_step(void *handle) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  return sqlite3_step(statement->stmt);
}

static void buffer_base64(buffer *b, const unsigned char *data, int len) {
  static const char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  buffer_char(b, '"');
  for (int i = 0; i < len; i += 3) {
    unsigned int value = (unsigned int)data[i] << 16;
    if (i + 1 < len) value |= (unsigned int)data[i + 1] << 8;
    if (i + 2 < len) value |= (unsigned int)data[i + 2];
    buffer_char(b, alphabet[(value >> 18) & 0x3f]);
    buffer_char(b, alphabet[(value >> 12) & 0x3f]);
    buffer_char(b, i + 1 < len ? alphabet[(value >> 6) & 0x3f] : '=');
    buffer_char(b, i + 2 < len ? alphabet[value & 0x3f] : '=');
  }
  buffer_char(b, '"');
}

static void format_double(buffer *b, double value) {
  if (isnan(value) || isinf(value)) {
    buffer_text(b, "null");
    return;
  }
  if (value == 0) {
    buffer_text(b, "0");
    return;
  }
  char text[64];
  int precision = 1;
  for (; precision <= 17; precision++) {
    snprintf(text, sizeof(text), "%.*g", precision, value);
    if (strtod(text, NULL) == value) break;
  }
  char *exponent = strchr(text, 'e');
  if (exponent != NULL) {
    int exp = (int)strtol(exponent + 1, NULL, 10);
    if (exp >= -6 && exp <= 20) {
      int decimals = precision - 1 - exp;
      if (decimals < 0) decimals = 0;
      if (decimals > 30) decimals = 30;
      snprintf(text, sizeof(text), "%.*f", decimals, value);
      char *dot = strchr(text, '.');
      if (dot != NULL) {
        char *end = text + strlen(text) - 1;
        while (end > dot && *end == '0') *end-- = '\0';
        if (end == dot) *end = '\0';
      }
    } else {
      char *digits = exponent + 1;
      if (*digits == '+' || *digits == '-') digits++;
      while (digits[0] == '0' && digits[1] >= '0' && digits[1] <= '9') memmove(digits, digits + 1, strlen(digits));
    }
  }
  buffer_text(b, text);
}

static int append_value(buffer *b, sqlite3_stmt *statement, int column) {
  int type = sqlite3_column_type(statement, column);
  if (type == SQLITE_NULL) {
    buffer_text(b, "null");
    return 1;
  }
  if (type == SQLITE_INTEGER) {
    int64_t value = (int64_t)sqlite3_column_int64(statement, column);
    char text[32];
    if (value <= 9007199254740991LL && value >= -9007199254740991LL) {
      sqlite3_snprintf(sizeof(text), text, "%lld", (long long)value);
      buffer_text(b, text);
    } else {
      buffer_char(b, '"');
      sqlite3_snprintf(sizeof(text), text, "%lld", (long long)value);
      buffer_text(b, text);
      buffer_char(b, '"');
    }
    return 1;
  }
  if (type == SQLITE_FLOAT) {
    format_double(b, sqlite3_column_double(statement, column));
    return 1;
  }
  if (type == SQLITE_BLOB) {
    const unsigned char *data = (const unsigned char *)sqlite3_column_blob(statement, column);
    buffer_base64(b, data == NULL ? (const unsigned char *)"" : data, sqlite3_column_bytes(statement, column));
    return 1;
  }
  const unsigned char *text = sqlite3_column_text(statement, column);
  int len = sqlite3_column_bytes(statement, column);
  buffer_escaped(b, text == NULL ? (const unsigned char *)"" : text, len);
  return 1;
}

static int append_object(buffer *b, sqlite3_stmt *statement);

int64_t sqlite_shim_json(void *handle, unsigned char *out, size_t cap) {
  shim_statement *statement = as_statement(handle);
  if (statement->json == NULL) {
    buffer b = { NULL, 0, 0, 0 };
    buffer_char(&b, '[');
    int row = 0;
    int rc = SQLITE_OK;
    for (;;) {
      rc = sqlite3_step(statement->stmt);
      if (rc == SQLITE_DONE) break;
      if (rc != SQLITE_ROW) {
        free(b.data);
        return -2;
      }
      if (row++ > 0) buffer_char(&b, ',');
      append_object(&b, statement->stmt);
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
    statement->json = b.data;
    statement->json_len = b.len;
  }
  size_t needed = statement->json_len + 1;
  if (cap < needed) return -(int64_t)needed;
  memcpy(out, statement->json, statement->json_len);
  return (int64_t)statement->json_len;
}

static int duplicate_later(sqlite3_stmt *statement, int column) {
  const char *name = sqlite3_column_name(statement, column);
  int columns = sqlite3_column_count(statement);
  for (int i = column + 1; i < columns; i++) if (strcmp(name, sqlite3_column_name(statement, i)) == 0) return 1;
  return 0;
}

static int append_object(buffer *b, sqlite3_stmt *statement) {
  buffer_char(b, '{');
  int columns = sqlite3_column_count(statement);
  int written = 0;
  for (int i = 0; i < columns; i++) {
    if (duplicate_later(statement, i)) continue;
    if (written++ > 0) buffer_char(b, ',');
    const char *name = sqlite3_column_name(statement, i);
    buffer_escaped(b, (const unsigned char *)name, (int)strlen(name));
    buffer_char(b, ':');
    append_value(b, statement, i);
  }
  buffer_char(b, '}');
  return !b->failed;
}

static int64_t copy_row(shim_statement *statement, unsigned char *out, size_t cap) {
  size_t needed = statement->row_len + 1;
  if (cap < needed) return -(int64_t)needed;
  memcpy(out, statement->row, statement->row_len);
  return (int64_t)statement->row_len;
}

/* Step once and keep the first row (or `null`) as JSON; the statement is reset
 * at once, so a read leaves no cursor open to pin a snapshot or lock a table. */
static int build_row(shim_statement *statement) {
  int rc = sqlite3_step(statement->stmt);
  if (rc == SQLITE_DONE) {
    sqlite3_reset(statement->stmt);
    statement->row = (char *)malloc(5);
    if (statement->row == NULL) return 0;
    memcpy(statement->row, "null", 4);
    statement->row_len = 4;
    statement->row_null = 1;
    return 1;
  }
  if (rc != SQLITE_ROW) return 0;
  buffer b = { NULL, 0, 0, 0 };
  if (!append_object(&b, statement->stmt)) {
    free(b.data);
    sqlite3_reset(statement->stmt);
    return 0;
  }
  sqlite3_reset(statement->stmt);
  statement->row = b.data;
  statement->row_len = b.len;
  return 1;
}

int64_t sqlite_shim_get_text(void *handle, const char *value, size_t len, unsigned char *out, size_t cap) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  sqlite3_reset(statement->stmt);
  sqlite3_clear_bindings(statement->stmt);
  if (sqlite3_bind_text(statement->stmt, 1, value, (int)len, SQLITE_TRANSIENT) != SQLITE_OK) return -2;
  if (!build_row(statement)) return -2;
  return copy_row(statement, out, cap);
}

int64_t sqlite_shim_get_int(void *handle, int64_t value, unsigned char *out, size_t cap) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  sqlite3_reset(statement->stmt);
  sqlite3_clear_bindings(statement->stmt);
  if (sqlite3_bind_int64(statement->stmt, 1, (sqlite3_int64)value) != SQLITE_OK) return -2;
  if (!build_row(statement)) return -2;
  return copy_row(statement, out, cap);
}

/* The first row of the bound statement; a second call after a short buffer
 * copies the row it kept instead of stepping again. */
int64_t sqlite_shim_row(void *handle, unsigned char *out, size_t cap) {
  shim_statement *statement = as_statement(handle);
  if (statement->row == NULL && !build_row(statement)) return -2;
  return copy_row(statement, out, cap);
}

/* Step once, then reset: a write (an `INSERT … RETURNING` included) makes
 * every change on its first step, and the reset leaves no cursor open. The
 * connection's changes and last rowid go into `out` as two little-endian
 * int64s, so a run is one call. */
int sqlite_shim_run(void *handle, unsigned char *out, size_t cap) {
  shim_statement *statement = as_statement(handle);
  invalidate(statement);
  int rc = sqlite3_step(statement->stmt);
  sqlite3_reset(statement->stmt);
  if (cap >= 16) {
    sqlite3 *db = sqlite3_db_handle(statement->stmt);
    int64_t values[2] = { (int64_t)sqlite3_changes64(db), (int64_t)sqlite3_last_insert_rowid(db) };
    for (int v = 0; v < 2; v++) {
      uint64_t bits = (uint64_t)values[v];
      for (int i = 0; i < 8; i++) out[v * 8 + i] = (unsigned char)((bits >> (8 * i)) & 0xff);
    }
  }
  return rc;
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
