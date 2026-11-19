import View, { trackWork } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { signal } from "@lightstart/light/signals";

const ITEMS = ["alpha", "alphabet", "beta", "gamma"];
const served = typeof document === "undefined";

class AppSearch extends View {
  private rows = signal<string[]>(served ? ITEMS : []);
  private load: Promise<void> | null = served ? null : new Promise((resolve) => setTimeout(resolve, 5000));

  render() {
    if (this.load !== null) trackWork(this.load, "app:search-load");
    return html`
      <h1>Search</h1>
      <input
        class="search"
        placeholder="Filter"
        @input=${(event: Event) => {
          const input = event.target;
          if (!(input instanceof HTMLInputElement)) return;
          this.rows.value = ITEMS.filter((item) => item.includes(input.value));
        }}
      />
      <ul>
        ${this.rows.value.map((item) => html`<li>${item}</li>`)}
      </ul>
    `;
  }
}

View.register("app-search", AppSearch);
