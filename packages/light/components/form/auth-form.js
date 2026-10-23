import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

const TAG = /** @type {const} */ ("lc-auth-form");

export default defineComponent({
  tag: "lc-auth-form",
  style: true,
  props: {

    mode: T.string({ defaultValue: "register", enum: ["login", "register"] }),

    showTabs: true,
    showOAuth: true,
    showGuest: true,

    loginLabel: "",
    registerLabel: "",
    loginTitle: "",
    registerTitle: "",
    nameLabel: "",
    namePlaceholder: "",
    emailLabel: "",
    emailPlaceholder: "you@example.com",
    submitLoginLabel: "",
    submitRegisterLabel: "",
    oauthDividerLabel: "",
    googleLabel: "",
    appleLabel: "",
    guestLabel: "",

    passwordLabel: "",
    passwordPlaceholder: "",
    confirmPasswordLabel: "",
    confirmPasswordPlaceholder: "",

    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    error: "",
    loading: false,
  },

  /** @param {"login" | "register"} newMode */
  handleModeChange(newMode) {
    this.mode = newMode;
    this.error = "";
  },

  handleSubmit() {
    this.error = "";

    if (this.mode === "register" && !this.name.trim()) {
      this.error = "Please enter your name";
      this.$emit("auth-error", { message: this.error });
      return;
    }

    if (!this.email.trim()) {
      this.error = "Please enter your email";
      this.$emit("auth-error", { message: this.error });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.error = "Please enter a valid email";
      this.$emit("auth-error", { message: this.error });
      return;
    }

    if (!this.password) {
      this.error = "Please enter a password";
      this.$emit("auth-error", { message: this.error });
      return;
    }

    if (this.password.length < 8) {
      this.error = "Password must be at least 8 characters";
      this.$emit("auth-error", { message: this.error });
      return;
    }

    this.$emit("auth-submit", {
      mode: this.mode,
      name: this.name,
      email: this.email,
      password: this.password,
      passwordConfirm: this.password,
    });
  },

  /** @param {"google" | "apple"} provider */
  handleOAuth(provider) {
    this.$emit("auth-oauth", { provider });
  },

  handleGuest() {
    this.$emit("auth-guest", {});
  },

  /** @param {KeyboardEvent} e */
  handleKeyPress(e) {
    if (e.key === "Enter")
      this.handleSubmit();

  },

  /** @param {string} message */
  setError(message) {
    this.error = message;
  },

  render() {
    const isRegister = this.mode === "register";

    return html`
      ${this.showTabs ? this.renderTabs() : null}

      <div class="auth-form" part="lc-auth-form-form">
        ${
          this.error
            ? html`
              <div class="error-message" part="lc-auth-form-error">
                ${this.error}
              </div>
            `
            : null
        }

        ${
          isRegister
            ? html`
              <div class="field" part="lc-auth-form-field">
                <label class="label" part="lc-auth-form-label">${this.nameLabel || lcText(TAG, "fullName")}</label>
                <lc-input
                  name="name"
                  type="text"
                  placeholder="${this.namePlaceholder || lcText(TAG, "namePlaceholder")}"
                  value=${this.name}
                  @input=${(e) => ((this.name = e.target.value))}
                  @keypress=${this.handleKeyPress.bind(this)}
                  fullWidth
                ></lc-input>
              </div>
            `
            : null
        }

        <div class="field" part="lc-auth-form-field">
          <label class="label" part="lc-auth-form-label">${this.emailLabel || lcText(TAG, "email")}</label>
          <lc-input
            name="email"
            type="email"
            placeholder="${this.emailPlaceholder}"
            value=${this.email}
            @input=${(e) => (this.email = e.target.value)}
            @keypress=${this.handleKeyPress.bind(this)}
            fullWidth
          ></lc-input>
        </div>

        <div class="field" part="lc-auth-form-field">
          <label class="label" part="lc-auth-form-label">${this.passwordLabel || lcText(TAG, "password")}</label>
          <lc-input
            type="password"
            placeholder="${this.passwordPlaceholder || lcText(TAG, "passwordPlaceholder")}"
            .value=${this.password}
            @input=${(e) => (this.password = e.target.value)}
            @keypress=${this.handleKeyPress.bind(this)}
            fullWidth
          ></lc-input>
        </div>

        <lc-button
          class="submit-btn"
          ?disabled=${this.loading}
          @click=${this.handleSubmit.bind(this)}
          wFull
        >
          ${
            this.loading
              ? "..."
              : isRegister
                ? this.submitRegisterLabel || lcText(TAG, "createAccount")
                : this.submitLoginLabel || lcText(TAG, "login")
          }
        </lc-button>
      </div>

      ${this.showOAuth ? this.renderOAuthButtons() : null}

      ${this.showGuest ? this.renderGuestOption() : null}
    `;
  },

  renderTabs() {
    return html`
      <lc-tabs
        class="auth-tabs"
        part="lc-auth-form-tabs"
        .activeTab=${this.mode === "login" ? 0 : 1}
        @tab-change=${(e) => this.handleModeChange(e.detail === 0 ? "login" : "register")}
      >
        <button slot="tab" ?active=${this.mode === "login"}>${this.loginLabel || lcText(TAG, "login")}</button>
        <button slot="tab" ?active=${this.mode === "register"}>${this.registerLabel || lcText(TAG, "register")}</button>
      </lc-tabs>
    `;
  },

  renderOAuthButtons() {
    return html`
      <div class="oauth-section" part="lc-auth-form-oauth">
        <div class="divider" part="lc-auth-form-divider">
          <span>${this.oauthDividerLabel || lcText(TAG, "orContinue")}</span>
        </div>
        <div class="oauth-buttons" part="lc-auth-form-oauth-buttons">
          <lc-button
            class="oauth-btn google"
            @click=${() => this.handleOAuth("google")}
            wFull
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            ${this.googleLabel || lcText(TAG, "google")}
          </lc-button>
          <lc-button
            class="oauth-btn apple"
            @click=${() => this.handleOAuth("apple")}
            wFull
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            ${this.appleLabel || lcText(TAG, "apple")}
          </lc-button>
        </div>
      </div>
    `;
  },

  renderGuestOption() {
    return html`
      <div class="guest-section" part="lc-auth-form-guest">
        <lc-button
          class="guest-btn"
          w-full
          @click=${this.handleGuest.bind(this)}
        >
          ${this.guestLabel || lcText(TAG, "guest")}
        </lc-button>
      </div>
    `;
  },
});

/**
 * Auth Form Component
 *
 * @component
 * @category form
 * @tag lc-auth-form
 *
 * A reusable authentication form component with login/register modes,
 * OAuth buttons, and guest option. Emits events for auth actions.
 *
 * @part tabs - Tab container for login/register toggle
 * @part tab - Individual tab button
 * @part tab-active - Active tab button
 * @part form - Main form container
 * @part field - Form field wrapper
 * @part label - Field label
 * @part input - Input field
 * @part error - Error message container
 * @part submit - Submit button
 * @part oauth - OAuth section container
 * @part divider - "Or continue with" divider
 * @part oauth-buttons - OAuth buttons wrapper
 * @part oauth-btn - OAuth button
 * @part oauth-btn-google - Google OAuth button
 * @part oauth-btn-apple - Apple OAuth button
 * @part guest - Guest section container
 * @part guest-btn - Guest option button
 *
 * @fires auth-submit - When form is submitted. Detail: { mode, name, email, password, passwordConfirm }
 * @fires auth-oauth - When OAuth button clicked. Detail: { provider: "google" | "apple" }
 * @fires auth-guest - When guest option clicked
 * @fires auth-error - When validation error occurs. Detail: { message }
 *
 * @example Basic Usage
 * ```html
 * <lc-auth-form
 *   @auth-submit=${this.handleAuthSubmit}
 *   @auth-oauth=${this.handleOAuth}
 *   @auth-guest=${this.handleGuest}
 * ></lc-auth-form>
 * ```
 *
 * @example Login Only
 * ```html
 * <lc-auth-form
 *   mode="login"
 *   .showTabs=${false}
 *   .showGuest=${false}
 * ></lc-auth-form>
 * ```
 *
 * @example Custom Labels
 * ```html
 * <lc-auth-form
 *   loginTitle="Welcome!"
 *   registerTitle="Join Us"
 *   submitLoginLabel="Sign In"
 *   submitRegisterLabel="Sign Up"
 * ></lc-auth-form>
 * ```
 */
