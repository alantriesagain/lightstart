/*
 * The Cocoa half of the shim: one non-blocking step of the application's event loop, and a
 * watch on the window that records when it closes. Compiled with clang -fobjc-arc into the
 * archive on macOS; the C side (shim.c) calls these from desktop_create and desktop_pump.
 * Unverified: written against the AppKit API, not yet built on a Mac.
 */
#import <Cocoa/Cocoa.h>
#include <stdint.h>

int32_t desktop_pump_mac(void *window, int32_t *closed);
void desktop_watch_close_mac(void *window, int32_t *closed);

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
      [app sendEvent:event];
    }
    [app updateWindows];
  }
  return *closed ? 0 : 1;
}
