/**
 * @file `<admin-shell>`: the admin's layout. It draws the config's title, the
 * sidebar `adminSections` fill, the routed view through `<app-container>`, the
 * command palette over `adminCommands`, the notifications list, and the dialog
 * and toast outlets.
 */

import View from "@lightstart/light";
import { element, html, nothing } from "@lightstart/light/html";
import { currentRoute } from "@lightstart/app/web";
import { activeDialog, message, settle } from "../dialogs.ts";
import { loadAdminSession } from "../files.ts";
import { adminCommands, adminHeader, adminSections } from "../slots.ts";
import type { AdminSection } from "../slots.ts";
import { adminTitle, clearNotifications, notifications, notificationsOpen } from "../state.ts";

const isActive = (path: string, section: AdminSection): boolean => path === section.path || path.startsWith(`${section.path.replace(/\/+$/, "")}/`);

const iconFor = (kind: string | undefined): string => (kind === "error" ? "circle-x" : kind === "warning" ? "triangle-alert" : kind === "success" ? "circle-check" : "bell");

class AdminShell extends View {
  connected() {
    void loadAdminSession();
  }

  private _selectCommand(event: Event): void {
    const detail = (event as CustomEvent<unknown>).detail;
    if (typeof detail !== "object" || detail === null) return;
    const id = Reflect.get(detail, "id");
    const command = this._commands().find((entry) => entry.id === String(id));
    if (command === undefined) return;
    void Promise.resolve(command.run()).catch((error: unknown) => {
      message(error instanceof Error ? error.message : String(error), { kind: "error" });
    });
  }

  private _commands() {
    return adminCommands.items.value;
  }

  private _docs() {
    return this._commands().map((command) => ({ id: command.id, group: "Commands", title: command.title, hint: command.icon ?? "" }));
  }

  private _promptInput(event: Event): void {
    const dialog = activeDialog.value;
    if (dialog === null || dialog.kind !== "prompt") return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    activeDialog.value = { ...dialog, value: target.value };
  }

  render() {
    const sections = adminSections.items.value;
    const header = adminHeader.items.value;
    const path = currentRoute.value?.routePath ?? "";
    const dialog = activeDialog.value;
    const entries = notifications.value;
    const count = entries.length;
    const unread = count > 9 ? "9+" : String(count);
    return html`
      <div class="admin-shell">
        <header class="admin-shell-header">
          <div class="admin-shell-heading">
            <lc-text class="admin-shell-title" level="1" size="lg">${adminTitle.value}</lc-text>
            ${header.map((item) => element(item.tag, { "data-admin-header": item.id }))}
          </div>
          <div class="admin-shell-actions">
            <lc-command-palette hide-trigger .docs=${this._docs()} .groups=${["Commands"]} @command-select=${(event: Event) => this._selectCommand(event)}></lc-command-palette>
            <span class="admin-shell-bell">
              <lc-button icon="bell" iconOnly ghost aria-label=${`Notifications${count === 0 ? "" : `, ${String(count)} unread`}`} @click=${() => { notificationsOpen.value = !notificationsOpen.value; }}></lc-button>
              ${count === 0 ? nothing : html`<lc-badge class="admin-shell-bell-count" data-count>${unread}</lc-badge>`}
            </span>
          </div>
        </header>
        <div class="admin-shell-body">
          <nav class="admin-shell-sidebar" aria-label="Admin sections">
            ${sections.length === 0 ? html`<lc-text muted size="sm">No sections yet</lc-text>` : sections.map((section) => html`<lc-nav-item icon=${section.icon} label=${section.title} href=${section.path} .active=${isActive(path, section)}></lc-nav-item>`)}
          </nav>
          <main class="admin-shell-main"><app-container></app-container></main>
        </div>
        ${notificationsOpen.value
          ? html`
              <lc-card class="admin-shell-notifications" heading="Notifications">
                <div slot="actions">
                  <lc-button ghost size="xs" @click=${() => { clearNotifications(); }}>Clear</lc-button>
                </div>
                ${entries.length === 0
                  ? html`<lc-empty-state title="No notifications" description="A tool tells you here when something happens."></lc-empty-state>`
                  : entries.map((entry) => html`<lc-list-row static icon=${iconFor(entry.kind)} label=${entry.title} hint=${entry.body ?? ""}></lc-list-row>`)}
              </lc-card>
            `
          : nothing}
        <lc-alert-dialog
          ?open=${dialog !== null && dialog.kind === "confirm"}
          title="Confirm"
          message=${dialog !== null && dialog.kind === "confirm" ? dialog.text : ""}
          confirmText=${dialog !== null && dialog.kind === "confirm" ? dialog.confirmLabel : "Confirm"}
          variant=${dialog !== null && dialog.kind === "confirm" && dialog.danger ? "error" : "default"}
          showCancel
          @confirm=${() => settle(true)}
          @cancel=${() => settle(false)}
        ></lc-alert-dialog>
        <lc-modal size="sm" ?open=${dialog !== null && dialog.kind === "prompt"} @modal-close=${() => settle(null)}>
          ${dialog !== null && dialog.kind === "prompt"
            ? html`
                <lc-text slot="header" level="3">${dialog.text}</lc-text>
                <lc-input .value=${dialog.value} placeholder=${dialog.placeholder} @input=${(event: Event) => this._promptInput(event)}></lc-input>
                <div slot="footer" class="admin-shell-dialog-actions">
                  <lc-button ghost @click=${() => settle(null)}>Cancel</lc-button>
                  <lc-button primary @click=${() => settle(dialog.value)}>OK</lc-button>
                </div>
              `
            : nothing}
        </lc-modal>
        <lc-toast></lc-toast>
      </div>
    `;
  }
}

export default AdminShell;
