/**
 * @bootstrapp/light/controller/writers: writing a record by a key named at
 * run time. Natively, a write by a key that is not a literal is static only
 * when its receiver is the object literal itself, so a record that takes such
 * writes is made here with closures over its literal, and its writer is found
 * again by the record. The record stays a plain object for its readers
 * (`this.$queries.rows`).
 */

/** A record and the closures that write and drop a key of it. */
export class RecordWriter {
  record: object;
  writeKey: (key: string, value: unknown) => void;
  dropKey: (key: string) => void;

  constructor(record: object, writeKey: (key: string, value: unknown) => void, dropKey: (key: string) => void) {
    this.record = record;
    this.writeKey = writeKey;
    this.dropKey = dropKey;
  }
}

const writers: WeakMap<object, RecordWriter> = new WeakMap();

/** Remember a writer by its record. */
export const registerWriter = (writer: RecordWriter): void => {
  writers.set(writer.record, writer);
};

/** The writer of a record made or registered here, or undefined for any other value. */
export const writerOf = (record: unknown): RecordWriter | undefined => (typeof record === "object" && record !== null ? writers.get(record) : undefined);

/** A new empty record with its writer, registered. */
export const writableRecord = (): RecordWriter => {
  const record: Record<string, unknown> = {};
  const writer = new RecordWriter(
    record,
    (key, value) => {
      record[key] = value;
    },
    (key) => {
      delete record[key];
    },
  );
  registerWriter(writer);
  return writer;
};
