/*
 * The Cocoa half of the shim: one non-blocking step of the application's event loop, and a
 * watch on the window that records when it closes. Compiled with clang -fobjc-arc into the
 * archive on macOS; the C side (shim.c) calls these from desktop_create and desktop_pump.
 * Also the frameless title bar (the system's traffic lights over a transparent bar), moving the
 * window from a page press, its state, minimize, zoom and close. Unverified: written against the
 * AppKit API, not yet built on a Mac.
 */
#import <Cocoa/Cocoa.h>
#include <stdint.h>

int32_t desktop_pump_mac(void *window, int32_t *closed);
void desktop_watch_close_mac(void *window, int32_t *closed);
void desktop_frameless_mac(void *window);
void desktop_begin_move_mac(void *window);
int32_t desktop_state_mac(void *window);
void desktop_minimize_mac(void *window);
void desktop_maximize_mac(void *window, int32_t on);
void desktop_close_mac(void *window);

@interface DesktopCloseWatch : NSObject
@property(nonatomic) int32_t *closed;
- (void)windowWillClose:(NSNotification *)note;
@end

@implementation DesktopCloseWatch
- (void)windowWillClose:(NSNotification *)note {
  (void)note;
  if (self.closed != NULL) *self.closed = 1;
}
@end

static DesktopCloseWatch *watch = nil;
static NSEvent *lastMouseDown = nil;
static int launched = 0;

void desktop_watch_close_mac(void *window, int32_t *closed) {
  NSWindow *w = (__bridge NSWindow *)window;
  watch = [DesktopCloseWatch new];
  watch.closed = closed;
  [[NSNotificationCenter defaultCenter] addObserver:watch selector:@selector(windowWillClose:) name:NSWindowWillCloseNotification object:w];
}

int32_t desktop_pump_mac(void *window, int32_t *closed) {
  (void)window;
  NSApplication *app = [NSApplication sharedApplication];
  if (!launched) {
    launched = 1;
    [app finishLaunching];
  }
  @autoreleasepool {
    for (int i = 0; i < 64; i++) {
      NSEvent *event = [app nextEventMatchingMask:NSEventMaskAny untilDate:nil inMode:NSDefaultRunLoopMode dequeue:YES];
      if (event == nil) break;
      if (event.type == NSEventTypeLeftMouseDown) lastMouseDown = event;
      [app sendEvent:event];
    }
    [app updateWindows];
  }
  return *closed ? 0 : 1;
}

/* A transparent, full-size-content title bar that keeps the system's traffic lights: the page
   draws under it and reserves room for them on the left (Electron's hiddenInset). An empty toolbar
   gives the band its height. Re-applied after every resize, since webview rewrites the style mask
   when it sizes the window. */
void desktop_frameless_mac(void *window) {
  NSWindow *w = (__bridge NSWindow *)window;
  w.styleMask |= NSWindowStyleMaskFullSizeContentView;
  w.titlebarAppearsTransparent = YES;
  w.titleVisibility = NSWindowTitleHidden;
  if (w.toolbar == nil) {
    NSToolbar *toolbar = [[NSToolbar alloc] initWithIdentifier:@"light-frameless"];
    toolbar.showsBaselineSeparator = NO;
    w.toolbar = toolbar;
  }
  if (@available(macOS 11.0, *)) w.toolbarStyle = NSWindowToolbarStyleUnifiedCompact;
}

/* Move the window with the pointer from the last press the pump saw, while the button is down.
   AppKit runs its own tracking loop until the button is released, which parks the program's loop
   for the length of the drag. */
void desktop_begin_move_mac(void *window) {
  NSWindow *w = (__bridge NSWindow *)window;
  if (lastMouseDown == nil || ([NSEvent pressedMouseButtons] & 1) == 0) return;
  [w performWindowDragWithEvent:lastMouseDown];
}

int32_t desktop_state_mac(void *window) {
  NSWindow *w = (__bridge NSWindow *)window;
  int32_t bits = 0;
  if (w.isZoomed) bits |= 1;
  if ((w.styleMask & NSWindowStyleMaskFullScreen) != 0) bits |= 2;
  if (w.isKeyWindow) bits |= 4;
  if (w.isMiniaturized) bits |= 8;
  return bits;
}

void desktop_minimize_mac(void *window) {
  [(__bridge NSWindow *)window miniaturize:nil];
}

void desktop_maximize_mac(void *window, int32_t on) {
  NSWindow *w = (__bridge NSWindow *)window;
  if ((w.isZoomed ? 1 : 0) != (on != 0 ? 1 : 0)) [w zoom:nil];
}

void desktop_close_mac(void *window) {
  [(__bridge NSWindow *)window performClose:nil];
}
