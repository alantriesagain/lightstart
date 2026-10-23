import { html } from "@bootstrapp/light/html";

export default {
  description: "Sign in and sign up in one component: tabs, OAuth buttons, a guest route, and the validation between them.",
  preview: () => html`
    <lc-auth-form mode="login" loginTitle="Welcome back"></lc-auth-form>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Custom labels",
      render: () => html`
        <lc-auth-form
          loginTitle="Welcome!"
          registerTitle="Join Us"
          submitLoginLabel="Sign In"
          submitRegisterLabel="Sign Up"
        ></lc-auth-form>
      `,
    },
  ],
};
