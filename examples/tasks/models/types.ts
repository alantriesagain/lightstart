/**
 * @file The example's types: a task as the store answers it.
 */
export interface Task {
  id?: string | number;
  title?: string;
  done?: boolean;
  addedAt?: number;
}
