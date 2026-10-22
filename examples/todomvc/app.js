import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import View from "@bootstrapp/light";

/**
 * @import { TypeDefinition } from "@bootstrapp/light/types"
 * @import { Todo } from "./types.ts"
 */

const STORAGE_KEY = "todos-light";

/** @returns {Todo[]} */
const loadTodos = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(stored) ? /** @type {Todo[]} */ (stored) : [];
  } catch {
    return [];
  }
};

/** @param {Todo[]} todos */
const saveTodos = (todos) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
};

let nextId = Date.now();

View.define("todo-app", {
  todos: /** @type {TypeDefinition<Todo[]>} */ (T.array({ defaultValue: [], attribute: false })),
  filter: "all",
}, {
  connected() {
    this.todos = loadTodos();
    window.addEventListener("hashchange", this.updateFilter);
    this.$own(() => window.removeEventListener("hashchange", this.updateFilter));
    this.updateFilter();
  },

  updateFilter() {
    const hash = window.location.hash.replace("#/", "") || "all";
    this.filter = ["all", "active", "completed"].includes(hash) ? hash : "all";
  },

  /** @param {KeyboardEvent} e */
  addTodo(e) {
    if (e.key !== "Enter") return;
    const input = /** @type {HTMLInputElement} */ (e.target);
    const title = input.value.trim();
    if (!title) return;
    this.todos = [...this.todos, { id: nextId++, title, completed: false }];
    saveTodos(this.todos);
    input.value = "";
  },

  /** @param {Event} e */
  toggleAll(e) {
    const { checked } = /** @type {HTMLInputElement} */ (e.target);
    this.todos = this.todos.map((todo) => ({ ...todo, completed: checked }));
    saveTodos(this.todos);
  },

  /** @param {number} id */
  toggle(id) {
    this.todos = this.todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo,
    );
    saveTodos(this.todos);
  },

  /** @param {number} id */
  destroy(id) {
    this.todos = this.todos.filter((todo) => todo.id !== id);
    saveTodos(this.todos);
  },

  /**
   * @param {number} id
   * @param {string} title
   */
  updateTodo(id, title) {
    if (!title.trim()) return void this.destroy(id);
    this.todos = this.todos.map((todo) =>
      todo.id === id ? { ...todo, title: title.trim() } : todo,
    );
    saveTodos(this.todos);
  },

  clearCompleted() {
    this.todos = this.todos.filter((todo) => !todo.completed);
    saveTodos(this.todos);
  },

  /** @returns {Todo[]} */
  get filteredTodos() {
    switch (this.filter) {
      case "active":
        return this.todos.filter((t) => !t.completed);
      case "completed":
        return this.todos.filter((t) => t.completed);
      default:
        return this.todos;
    }
  },

  /** @returns {number} */
  get activeCount() {
    return this.todos.filter((t) => !t.completed).length;
  },

  /** @returns {number} */
  get completedCount() {
    return this.todos.filter((t) => t.completed).length;
  },

  render() {
    const { todos, filter, filteredTodos, activeCount, completedCount } = this;

    return html`
      <section class="todoapp">
        <header class="header">
          <h1>todos</h1>
          <input
            class="new-todo"
            placeholder="What needs to be done?"
            autofocus
            @keydown=${(/** @type {KeyboardEvent} */ e) => this.addTodo(e)}
          />
        </header>

        ${todos.length > 0
          ? html`
              <section class="main">
                <input
                  id="toggle-all"
                  class="toggle-all"
                  type="checkbox"
                  .checked=${activeCount === 0}
                  @change=${(/** @type {Event} */ e) => this.toggleAll(e)}
                />
                <label for="toggle-all">Mark all as complete</label>
                <ul class="todo-list">
                  ${filteredTodos.map(
                    (todo) => html`
                      <todo-item
                        .todo=${todo}
                        @toggle=${() => this.toggle(todo.id)}
                        @destroy=${() => this.destroy(todo.id)}
                        @update=${(/** @type {CustomEvent<string>} */ e) => this.updateTodo(todo.id, e.detail)}
                      ></todo-item>
                    `,
                  )}
                </ul>
              </section>

              <footer class="footer">
                <span class="todo-count">
                  <strong>${activeCount}</strong>
                  ${activeCount === 1 ? " item" : " items"} left
                </span>
                <ul class="filters">
                  <li>
                    <a class=${filter === "all" ? "selected" : ""} href="#/">
                      All
                    </a>
                  </li>
                  <li>
                    <a
                      class=${filter === "active" ? "selected" : ""}
                      href="#/active"
                    >
                      Active
                    </a>
                  </li>
                  <li>
                    <a
                      class=${filter === "completed" ? "selected" : ""}
                      href="#/completed"
                    >
                      Completed
                    </a>
                  </li>
                </ul>
                ${completedCount > 0
                  ? html`
                      <button
                        class="clear-completed"
                        @click=${() => this.clearCompleted()}
                      >
                        Clear completed
                      </button>
                    `
                  : null}
              </footer>
            `
          : null}
      </section>
    `;
  },
});

View.define("todo-item", {
  todo: /** @type {TypeDefinition<Todo>} */ (T.object({ defaultValue: {}, attribute: false })),
  editing: false,
}, {
  events: {
    toggle: T.object(),
    destroy: T.object(),
    update: T.string(),
  },

  startEditing() {
    this.editing = true;
    requestAnimationFrame(() => {
      const input = /** @type {HTMLInputElement | null} */ (this.$(".edit"));
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  },

  /** @param {Event} e */
  finishEditing(e) {
    if (!this.editing) return;
    this.editing = false;
    this.$emit("update", /** @type {HTMLInputElement} */ (e.target).value);
  },

  /** @param {KeyboardEvent} e */
  handleKeydown(e) {
    if (e.key === "Enter")
      this.finishEditing(e);
     else if (e.key === "Escape")
      this.editing = false;

  },

  render() {
    const { todo, editing } = this;

    return html`
      <li class="${todo.completed ? "completed" : ""} ${editing ? "editing" : ""}">
        <div class="view">
          <input
            class="toggle"
            type="checkbox"
            .checked=${todo.completed}
            @change=${() => this.$emit("toggle")}
          />
          <label @dblclick=${() => this.startEditing()}>${todo.title}</label>
          <button class="destroy" @click=${() => this.$emit("destroy")}></button>
        </div>
        ${editing
          ? html`
              <input
                class="edit"
                .value=${todo.title}
                @blur=${(/** @type {Event} */ e) => this.finishEditing(e)}
                @keydown=${(/** @type {KeyboardEvent} */ e) => this.handleKeydown(e)}
              />
            `
          : null}
      </li>
    `;
  },
});
