import { InputDecoder, KeyEvent } from "./index.ts";
import { done, eq } from "./assert.js";

/** @type {string[]} */
const got = [];
const dec = new InputDecoder((/** @type {KeyEvent} */ e) => {
  got.push(e.describe());
});
dec.escTimeoutMs = 0;
/** @param {string} s */
const feed = (s) => {
  got.length = 0;
  dec.pushText(s);
  return got.join(" ");
};

eq("plain text", feed("ab"), "a b");
eq("utf8 graphemes", feed("hé\u{1F600}é"), "h é \u{1F600} é");
eq("enter tab backspace", feed("\r\t\x7f"), "enter tab backspace");
eq("ctrl letters", feed("\x03\x01\x0a"), "ctrl+c ctrl+a ctrl+j");
eq("arrows CSI", feed("\x1b[A\x1b[B\x1b[C\x1b[D"), "up down right left");
eq("arrows SS3", feed("\x1bOA\x1bOH"), "up home");
eq("modified arrows", feed("\x1b[1;5A\x1b[1;2C\x1b[1;3D"), "ctrl+up shift+right alt+left");
eq("tilde keys", feed("\x1b[3~\x1b[5~\x1b[6~\x1b[15~\x1b[24~"), "delete pageup pagedown f5 f12");
eq("shift tab", feed("\x1b[Z"), "shift+tab");
eq("alt+char", feed("\x1bx"), "alt+x");
eq("alt+enter", feed("\x1b\r"), "alt+enter");
eq("kitty u", feed("\x1b[13;2u\x1b[97;5u"), "shift+enter ctrl+a");
eq("paste", feed("\x1b[200~hello\r\nworld\x1b[201~"), "paste(11)");
got.length = 0;
dec.pushText("\x1b[");
dec.pushText("1;5");
dec.pushText("B");
eq("split sequence", got.join(" "), "ctrl+down");
got.length = 0;
dec.pushText("\x1b[200~ab");
dec.pushText("c\x1b[201");
dec.pushText("~x");
eq("split paste", got.join(" "), "paste(3) x");
got.length = 0;
dec.pushText("\x1b");
dec.flushEscape();
eq("lone escape via flush", got.join(" "), "escape");
got.length = 0;
dec.pushText("\x1b\x1b");
dec.flushEscape();
eq("escape escape", got.join(" "), "escape escape");
eq("text after sequences", feed("\x1b[Aq"), "up q");
got.length = 0;
const bytes = new Uint8Array([0x68, 0xc3]);
dec.push(bytes);
dec.push(new Uint8Array([0xa9, 0x21]));
eq("utf8 split across chunks", got.join(" "), "h é !");

/** @type {string[]} */
const mouse = [];
dec.onMouse = (e) => {
  mouse.push(e.type + "@" + String(e.x) + "," + String(e.y) + ":" + String(e.button) + (e.ctrl ? "+ctrl" : "") + (e.shift ? "+shift" : "") + (e.alt ? "+alt" : ""));
};
dec.onWheel = (e) => {
  mouse.push("wheel" + String(e.delta) + "@" + String(e.x) + "," + String(e.y));
};
got.length = 0;
dec.pushText("\x1b[<0;10;5M\x1b[<0;10;5m");
eq("sgr press and release", mouse.join(" "), "mousedown@9,4:0 mouseup@9,4:0");
mouse.length = 0;
dec.pushText("\x1b[<2;1;1M\x1b[<18;3;3M\x1b[<6;3;3m");
eq("buttons and modifiers", mouse.join(" "), "mousedown@0,0:2 mousedown@2,2:2+ctrl mouseup@2,2:2+shift");
mouse.length = 0;
dec.pushText("\x1b[<32;7;8M\x1b[<64;7;8M\x1b[<65;7;9M");
eq("motion and wheel", mouse.join(" "), "mousemove@6,7:0 wheel-1@6,7 wheel1@6,8");
mouse.length = 0;
dec.pushText("\x1b[<0;10");
dec.pushText(";5Mq");
eq("split mouse report then text", mouse.join(" ") + " " + got.join(" "), "mousedown@9,4:0 q");

done();
