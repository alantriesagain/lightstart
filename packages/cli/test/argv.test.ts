/**
 * @file The argument parser: positionals, flags and their negation, options, shorts that group,
 * `--`, choices, required values, rest positionals, and a schema that contradicts itself.
 * Runs under node and natively; the outputs must be identical.
 */
import { ArgError, SchemaError, parseArgs } from "../argv.ts";
import { done, eq, ok, throws } from "@light/test/assert.ts";

eq("a positional", JSON.stringify(parseArgs({ name: { positional: true } }, ["alice"])), '{"name":"alice"}');
eq("a positional default when omitted", JSON.stringify(parseArgs({ name: { positional: true, default: "world" } }, [])), '{"name":"world"}');
throws("a required positional is an error when missing", () => parseArgs({ name: { positional: true, required: true } }, []), "Missing required positional: name");
eq("a flag", JSON.stringify(parseArgs({ watch: { flag: true } }, ["--watch"])), '{"watch":true}');
eq("a flag defaults to false", JSON.stringify(parseArgs({ watch: { flag: true } }, [])), '{"watch":false}');
eq("--no- negates a flag", JSON.stringify(parseArgs({ watch: { flag: true, default: true } }, ["--no-watch"])), '{"watch":false}');
eq("a flag named no-x is that flag", JSON.stringify(parseArgs({ "no-launch": { flag: true } }, ["--no-launch"])), '{"no-launch":true}');
eq("an option and its value", JSON.stringify(parseArgs({ port: {} }, ["--port", "3000"])), '{"port":"3000"}');
eq("an option with =", JSON.stringify(parseArgs({ port: {} }, ["--port=3000"])), '{"port":"3000"}');
eq("a short option and its value", JSON.stringify(parseArgs({ port: { short: "p" } }, ["-p", "3000"])), '{"port":"3000"}');
eq("a short flag", JSON.stringify(parseArgs({ watch: { flag: true, short: "w" } }, ["-w"])), '{"watch":true}');
eq("choices accept one of them", JSON.stringify(parseArgs({ mode: { choices: ["a", "b"] as const } }, ["--mode", "a"])), '{"mode":"a"}');
throws("choices reject another value", () => parseArgs({ mode: { choices: ["a", "b"] as const } }, ["--mode", "c"]), "Invalid value for --mode");
throws("an unknown long option is an error", () => parseArgs({}, ["--unknown"]), "Unknown option: --unknown");
throws("an unknown short option is an error", () => parseArgs({}, ["-x"]), "Unknown short option: -x");
throws("an option without its value is an error", () => parseArgs({ port: {} }, ["--port"]), "Option --port requires a value");
throws("a required option is an error when missing", () => parseArgs({ host: { required: true } }, []), "Missing required option: --host");
eq("-- collects the rest as a positional", JSON.stringify(parseArgs({ files: { positional: true } }, ["--", "--not-a-flag"])), '{"files":"--not-a-flag"}');
eq("a positional after a flag", JSON.stringify(parseArgs({ name: { positional: true }, shout: { flag: true } }, ["--shout", "alice"])), '{"shout":true,"name":"alice"}');
eq("an option default", JSON.stringify(parseArgs({ port: { default: "1315" } }, [])), '{"port":"1315"}');

const schema = { watch: { flag: true, short: "w" }, open: { flag: true, short: "o" }, port: { short: "p" } };
eq("short flags group", JSON.stringify(parseArgs(schema, ["-wo"])), '{"watch":true,"open":true}');
eq("a short option takes its value attached", JSON.stringify(parseArgs(schema, ["-p3000"])), '{"watch":false,"open":false,"port":"3000"}');
eq("a short option takes its value next", JSON.stringify(parseArgs(schema, ["-wp", "3000"])), '{"watch":true,"open":false,"port":"3000"}');
eq("a group then an attached value", JSON.stringify(parseArgs(schema, ["-wp3000", "-o"])), '{"watch":true,"open":true,"port":"3000"}');
throws("a short option without its value is an error", () => parseArgs(schema, ["-wp"]), "Option -p requires a value");
throws("an undeclared positional is an error", () => parseArgs({ name: { positional: true } }, ["alice", "bob"]), "Unexpected argument: bob");
throws("a stray positional is an error", () => parseArgs({}, ["stray"]), "Unexpected argument: stray");
throws("a flag takes no value", () => parseArgs({ watch: { flag: true } }, ["--watch=yes"]), "takes no value");

const rest = { kind: { positional: true, required: true }, picks: { positional: true, rest: true } } as const;
eq("the last positional takes the rest", JSON.stringify(parseArgs(rest, ["event", "2", "4", "all"])), '{"kind":"event","picks":["2","4","all"]}');
eq("the rest may be empty", JSON.stringify(parseArgs(rest, ["event"])), '{"kind":"event","picks":[]}');
eq("the rest takes what follows --", JSON.stringify(parseArgs(rest, ["event", "--", "-1"])), '{"kind":"event","picks":["-1"]}');
throws("a required rest is an error when empty", () => parseArgs({ picks: { positional: true, rest: true, required: true } }, []), "Missing required positional: picks");
eq("a negative number is a value", JSON.stringify(parseArgs({ n: { positional: true } }, ["-1"])), '{"n":"-1"}');

throws("a default outside its choices is a schema error", () => parseArgs({ mode: { choices: ["a", "b"] as const, default: "c" } }, []), "which is not one of its choices");
throws("required with a default is a schema error", () => parseArgs({ host: { required: true, default: "x" } }, []), "required and has a default");
throws("a short is one character", () => parseArgs({ port: { short: "po" } }, []), "a short is one character");
throws("two shorts cannot share", () => parseArgs({ a: { short: "x" }, b: { short: "x" } }, []), "share the short");
throws("the rest is the last positional", () => parseArgs({ files: { positional: true, rest: true }, name: { positional: true } }, []), "must be the last positional");
ok("ArgError and SchemaError are distinct", new ArgError("a") instanceof Error && new SchemaError("s") instanceof Error);

done();
