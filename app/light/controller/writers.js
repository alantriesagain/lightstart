/**
 * @lightstart/light/controller/writers: writing a record by a key named at
 * run time. Natively, a write by a key that is not a literal is static only
 * when its receiver is the object literal itself, so a record that takes such
 * writes is made here with closures over its literal, and its writer is found
 * again by the record. The record stays a plain object for its readers
 * (`this.$queries.rows`).
 */

/** A record and the closures that write a key of it and, for a record whose keys come and go, drop one. */
export class RecordWriter {
  record        ;
  writeKey                                       ;
  dropKey                                ;

  constructor(record        , writeKey                                       , dropKey                                ) {
    this.record = record;
    this.writeKey = writeKey;
    this.dropKey = dropKey;
  }
}

const writers                                = new WeakMap();

/** Remember a writer by its record. */
export const registerWriter = (writer              )       => {
  writers.set(writer.record, writer);
};

/** The writer of a record made or registered here, or undefined for any other value. */
export const writerOf = (record         )                           => (typeof record === "object" && record !== null ? writers.get(record) : undefined);

/** A new empty record with its writer, registered. */
export const writableRecord = ()               => {
  const record                          = {};
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
