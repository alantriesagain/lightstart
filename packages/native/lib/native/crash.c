/*
 * The crash report of a light native app: a handler for the signals a native crash ends in, writing
 * what was running and where to the run's log, putting the terminal back, naming the log on stderr,
 * then dying by the signal itself so the exit status and a core dump stay.
 *
 * Everything the handler calls is async-signal-safe (write, sigaction, tcsetattr, fork, execvp,
 * waitpid, nanosleep, kill, raise); its buffers are static, so a crash in the allocator is reportable.
 * The note is a bounded copy of the trail's last text, updated by the app as keys, plugins and frames
 * begin and end.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>
#if defined(__linux__)
#include <execinfo.h>
#include <sys/wait.h>
#elif defined(__APPLE__)
#include <execinfo.h>
#include <sys/wait.h>
#include <mach-o/dyld.h>
#endif

#define CRASH_NOTE_MAX 1024
#define CRASH_APP_MAX 64
#define CRASH_PATH_MAX 1024
#define CRASH_FRAMES 64
#define CRASH_ALT_STACK (64 * 1024)
#define CRASH_MAPS_MAX (128 * 1024)

static int log_fd = -1;
static char log_path[CRASH_PATH_MAX];
static char app_name[CRASH_APP_MAX];
static char note_text[CRASH_NOTE_MAX];
static volatile sig_atomic_t note_len = 0;
static struct termios saved_termios;
static int termios_fd = -1;
static volatile sig_atomic_t have_termios = 0;
static volatile sig_atomic_t in_handler = 0;
static volatile sig_atomic_t installed = 0;
static char alt_stack_mem[CRASH_ALT_STACK] __attribute__((aligned(16)));

static const char LEAVE[] = "\x1b[0m\x1b[?1006l\x1b[?1002l\x1b[?1000l\x1b[?2004l\x1b[?25h\x1b[?1049l\x1b]23;0t";

static void wr(int fd, const char *s) {
  size_t n = strlen(s);
  while (n > 0) {
    ssize_t w = write(fd, s, n);
    if (w < 0) {
      if (errno == EINTR) continue;
      return;
    }
    if (w == 0) return;
    s += w;
    n -= (size_t)w;
  }
}

static void wrn(int fd, const char *s, size_t n) {
  while (n > 0) {
    ssize_t w = write(fd, s, n);
    if (w < 0) {
      if (errno == EINTR) continue;
      return;
    }
    if (w == 0) return;
    s += w;
    n -= (size_t)w;
  }
}

static const char *signame(int sig) {
  switch (sig) {
    case SIGSEGV: return "SIGSEGV";
    case SIGBUS: return "SIGBUS";
    case SIGFPE: return "SIGFPE";
    case SIGILL: return "SIGILL";
    case SIGABRT: return "SIGABRT";
    default: return "signal";
  }
}

static char *put_hex(char *p, char *end, uintptr_t v) {
  char tmp[2 * sizeof(uintptr_t)];
  int n = 0;
  do {
    unsigned d = (unsigned)(v & 0xf);
    tmp[n++] = (char)(d < 10 ? '0' + d : 'a' + d - 10);
    v >>= 4;
  } while (v > 0 && n < (int)sizeof tmp);
  while (n > 0 && p < end) *p++ = tmp[--n];
  return p;
}

static void put_field(int fd, const char *label, uintptr_t v) {
  char buf[64];
  char *end = buf + sizeof buf - 2;
  char *p = buf;
  const char *l = label;
  while (*l != '\0' && p < end) *p++ = *l++;
  if (p < end) *p++ = ':';
  if (p < end) *p++ = ' ';
  if (p < end) *p++ = '0';
  if (p < end) *p++ = 'x';
  p = put_hex(p, end, v);
  if (p < end) *p++ = '\n';
  wrn(fd, buf, (size_t)(p - buf));
}

static uintptr_t from_hex(const char *p, const char **end) {
  uintptr_t v = 0;
  while (*p != '\0') {
    unsigned d;
    if (*p >= '0' && *p <= '9') d = (unsigned)(*p - '0');
    else if (*p >= 'a' && *p <= 'f') d = (unsigned)(*p - 'a' + 10);
    else if (*p >= 'A' && *p <= 'F') d = (unsigned)(*p - 'A' + 10);
    else break;
    v = (v << 4) | d;
    p++;
  }
  *end = p;
  return v;
}

#if defined(__linux__)
/* The executable's mapped range and load base (for a PIE), read from /proc/self/maps. */
static void exe_range(const char *exe, uintptr_t *lo, uintptr_t *hi, uintptr_t *base) {
  static char maps[CRASH_MAPS_MAX];
  *lo = ~(uintptr_t)0;
  *hi = 0;
  *base = 0;
  int fd = open("/proc/self/maps", O_RDONLY | O_CLOEXEC);
  if (fd < 0) return;
  size_t len = 0;
  while (len < sizeof maps - 1) {
    ssize_t n = read(fd, maps + len, sizeof maps - 1 - len);
    if (n < 0) {
      if (errno == EINTR) continue;
      break;
    }
    if (n == 0) break;
    len += (size_t)n;
  }
  close(fd);
  maps[len] = '\0';
  char *p = maps;
  while (*p != '\0') {
    char *eol = strchr(p, '\n');
    if (eol == NULL) eol = p + strlen(p);
    char *found = strstr(p, exe);
    if (found != NULL && found < eol && (found == p || found[-1] == '/' || found[-1] == ' ')) {
      const char *at = NULL;
      uintptr_t start = from_hex(p, &at);
      uintptr_t end = from_hex(at + 1, &at);
      const char *f = at;
      while (*f == ' ') f++;
      while (*f != '\0' && *f != ' ') f++;
      while (*f == ' ') f++;
      uintptr_t offset = from_hex(f, &at);
      if (start < *lo) *lo = start;
      if (end > *hi) *hi = end;
      if (offset == 0 && *base == 0) *base = start - offset;
    }
    p = *eol == '\0' ? eol : eol + 1;
  }
}

static int exe_is_pie(const char *exe) {
  unsigned char h[20];
  int fd = open(exe, O_RDONLY | O_CLOEXEC);
  if (fd < 0) return 0;
  ssize_t n = read(fd, h, sizeof h);
  close(fd);
  return n == (ssize_t)sizeof h && h[16] == 3 && h[17] == 0;
}
#endif

static void symbolize(int fd, const char *exe, void *const *frames, int count) {
#if defined(__linux__)
  uintptr_t lo = 0, hi = 0, base = 0;
  exe_range(exe, &lo, &hi, &base);
  int pie = exe_is_pie(exe);
  static char offsets[CRASH_FRAMES][2 * sizeof(uintptr_t) + 1];
  int used = 0;
  for (int i = 0; i < count && used < CRASH_FRAMES; i++) {
    uintptr_t a = (uintptr_t)frames[i];
    if (a < lo || a >= hi) continue;
    uintptr_t off = pie && base != 0 ? a - base : a;
    char *p = offsets[used];
    char *end = p + 2 * sizeof(uintptr_t);
    p = put_hex(p, end, off);
    *p = '\0';
    used++;
  }
  if (used == 0) return;
  wr(fd, "offsets:");
  for (int i = 0; i < used; i++) {
    wr(fd, " 0x");
    wr(fd, offsets[i]);
  }
  wr(fd, "\n");
  wr(fd, "symbolize by hand: addr2line -f -C -e ");
  wr(fd, exe);
  for (int i = 0; i < used; i++) {
    wr(fd, " 0x");
    wr(fd, offsets[i]);
  }
  wr(fd, "\n");
  static char *argv[CRASH_FRAMES + 6];
  int argc = 0;
  argv[argc++] = (char *)"addr2line";
  argv[argc++] = (char *)"-f";
  argv[argc++] = (char *)"-C";
  argv[argc++] = (char *)"-e";
  argv[argc++] = (char *)exe;
  for (int i = 0; i < used; i++) argv[argc++] = offsets[i];
  argv[argc] = NULL;
  pid_t pid = fork();
  if (pid == 0) {
    dup2(fd, STDOUT_FILENO);
    dup2(fd, STDERR_FILENO);
    execvp("addr2line", argv);
    wr(fd, "(addr2line is missing; the offsets and the command above stay)\n");
    _exit(127);
  }
  if (pid > 0) {
    int status = 0;
    int reaped = 0;
    for (int i = 0; i < 200; i++) {
      pid_t r = waitpid(pid, &status, WNOHANG);
      if (r == pid) {
        reaped = 1;
        break;
      }
      if (r < 0) break;
      struct timespec ts;
      ts.tv_sec = 0;
      ts.tv_nsec = 10 * 1000 * 1000;
      nanosleep(&ts, NULL);
    }
    if (!reaped) {
      kill(pid, SIGKILL);
      waitpid(pid, &status, 0);
    }
  }
#else
  (void)fd;
  (void)exe;
  (void)frames;
  (void)count;
#endif
}

#if defined(__linux__)
static void exe_path(char *out, size_t size) {
  ssize_t n = readlink("/proc/self/exe", out, size - 1);
  out[n > 0 ? (size_t)n : 0] = '\0';
}
#elif defined(__APPLE__)
static void exe_path(char *out, size_t size) {
  uint32_t len = (uint32_t)size;
  if (_NSGetExecutablePath(out, &len) != 0) out[0] = '\0';
}
#else
static void exe_path(char *out, size_t size) {
  out[0] = '\0';
  (void)size;
}
#endif

static void crash_handler(int sig, siginfo_t *info, void *context) {
  (void)context;
  int saved_errno = errno;
  if (in_handler) {
    signal(sig, SIG_DFL);
    raise(sig);
    _exit(128 + sig);
  }
  in_handler = 1;
  int fd = log_fd;
  if (fd >= 0) {
    char line[96];
    char *end = line + sizeof line - 2;
    char *p = line;
    const char *s = "\n--- crash: ";
    while (*s != '\0' && p < end) *p++ = *s++;
    s = signame(sig);
    while (*s != '\0' && p < end) *p++ = *s++;
    s = " ---\n";
    while (*s != '\0' && p < end) *p++ = *s++;
    wrn(fd, line, (size_t)(p - line));
    put_field(fd, "pid", (uintptr_t)getpid());
    if (sig == SIGSEGV || sig == SIGBUS || sig == SIGFPE || sig == SIGILL) put_field(fd, "address", (uintptr_t)info->si_addr);
    wr(fd, "note: ");
    if (note_len > 0) wrn(fd, note_text, (size_t)note_len);
    else wr(fd, "(nothing)");
    wr(fd, "\n");
    char exe[CRASH_PATH_MAX];
    exe_path(exe, sizeof exe);
    if (exe[0] != '\0') {
      wr(fd, "exe: ");
      wr(fd, exe);
      wr(fd, "\n");
    }
    void *frames[CRASH_FRAMES];
    int count = backtrace(frames, CRASH_FRAMES);
    wr(fd, "backtrace:\n");
    if (count > 0) backtrace_symbols_fd(frames, count, fd);
    if (exe[0] != '\0') {
      wr(fd, "symbolized:\n");
      symbolize(fd, exe, frames, count);
    }
    wr(fd, "--- crash end ---\n");
  }
  if (have_termios && termios_fd >= 0) tcsetattr(termios_fd, TCSANOW, &saved_termios);
  if (isatty(STDOUT_FILENO)) wr(STDOUT_FILENO, LEAVE);
  wr(STDERR_FILENO, "\n");
  wr(STDERR_FILENO, app_name[0] != '\0' ? app_name : "the app");
  wr(STDERR_FILENO, " crashed (");
  wr(STDERR_FILENO, signame(sig));
  wr(STDERR_FILENO, "). Log: ");
  wr(STDERR_FILENO, log_path[0] != '\0' ? log_path : "(none)");
  wr(STDERR_FILENO, "\n");
  struct sigaction dfl;
  memset(&dfl, 0, sizeof dfl);
  dfl.sa_handler = SIG_DFL;
  sigemptyset(&dfl.sa_mask);
  sigaction(sig, &dfl, NULL);
  /* The signal is blocked while its handler runs: unblock it so raising it kills the process (and
   * dumps core) here, before the _exit fallback. */
  sigset_t unblock;
  sigemptyset(&unblock);
  sigaddset(&unblock, sig);
  sigprocmask(SIG_UNBLOCK, &unblock, NULL);
  raise(sig);
  _exit(128 + sig);
  errno = saved_errno;
}

int crash_install(const char *log, size_t log_size, const char *app, size_t app_size) {
  if (installed) return 0;
  if (log_size >= sizeof log_path) log_size = sizeof log_path - 1;
  if (log_size > 0) {
    memcpy(log_path, log, log_size);
    log_path[log_size] = '\0';
    log_fd = open(log_path, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, 0600);
    if (log_fd < 0) log_path[0] = '\0';
  }
  if (app_size >= sizeof app_name) app_size = sizeof app_name - 1;
  if (app_size > 0) {
    memcpy(app_name, app, app_size);
    app_name[app_size] = '\0';
  }
  if (isatty(STDIN_FILENO) && tcgetattr(STDIN_FILENO, &saved_termios) == 0) termios_fd = STDIN_FILENO;
  else if (isatty(STDOUT_FILENO) && tcgetattr(STDOUT_FILENO, &saved_termios) == 0) termios_fd = STDOUT_FILENO;
  have_termios = termios_fd >= 0;
  /* glibc's first backtrace loads libgcc_s and allocates: take that call now, outside the handler. */
  void *warm[1];
  (void)backtrace(warm, 1);
  stack_t ss;
  memset(&ss, 0, sizeof ss);
  ss.ss_sp = alt_stack_mem;
  ss.ss_size = sizeof alt_stack_mem;
  ss.ss_flags = 0;
  sigaltstack(&ss, NULL);
  struct sigaction sa;
  memset(&sa, 0, sizeof sa);
  sa.sa_sigaction = crash_handler;
  sa.sa_flags = SA_SIGINFO | SA_ONSTACK;
  sigemptyset(&sa.sa_mask);
  sigaction(SIGSEGV, &sa, NULL);
  sigaction(SIGBUS, &sa, NULL);
  sigaction(SIGFPE, &sa, NULL);
  sigaction(SIGILL, &sa, NULL);
  sigaction(SIGABRT, &sa, NULL);
  installed = 1;
  return 0;
}

void crash_note(const char *text, size_t size) {
  if (size >= sizeof note_text) size = sizeof note_text - 1;
  if (size > 0) memcpy(note_text, text, size);
  note_len = (sig_atomic_t)size;
}

void crash_trigger(int kind) {
  volatile int *p = (int *)0;
  if (kind == 0) {
    *p = 1;
  } else {
    abort();
  }
}
