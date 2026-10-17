/**
 * @file The example's types: a task and a board as the store answers them.
 */
export interface Task {
  id?: string | number;
  title?: string;
  done?: boolean;
  addedAt?: number;
  boardId?: string;
}

export interface Board {
  id?: string | number;
  title?: string;
  position?: number;
}
