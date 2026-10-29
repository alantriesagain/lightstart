# SQLite amalgamation

`sqlite3.c` and `sqlite3.h` are the unmodified SQLite 3.54.1 amalgamation from
<https://www.sqlite.org/download.html> (`sqlite-amalgamation-3540100`). SQLite
is in the public domain: <https://www.sqlite.org/copyright.html>.

`native/build.js` compiles them with the shim into `native/out/libsqlite.a`;
neither file is edited here, so a new release replaces both together.
