/**
 * The IndexedDB explorer example: its records and the Dexie surface it drives.
 */

export type Prop<V> = import("@lightstart/light/types").TypeDefinition<V>;

/** A `{ label, value }` option pair for the database and store pickers. */
export interface LabeledOption {
  label: string;
  value: string;
}

/** A stored row of arbitrary shape, as read from an IndexedDB object store. */
export type IdbRecord = Record<string, unknown>;

/** A Dexie `IndexSpec`-like shape, as read off `table.schema.primKey` / `table.schema.indexes`. */
export interface DexieIndexSpec {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
  auto: boolean;
}

/** A Dexie `Table`-like shape, as iterated from `db.tables`. */
export interface DexieTableLike {
  name: string;
  schema: {
    primKey: DexieIndexSpec;
    indexes: DexieIndexSpec[];
  };
}

/** One index entry within the explorer's own captured schema snapshot. */
export interface IdbSchemaIndex {
  name: string;
  keyPath: string | string[] | null;
  unique: boolean;
  multiEntry: boolean;
}

/** One object store entry within the explorer's own captured schema snapshot. */
export interface IdbSchemaTable {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IdbSchemaIndex[];
}

/** The explorer's own captured schema snapshot for the selected database. */
export interface IdbSchema {
  version: number;
  tables: IdbSchemaTable[];
}
