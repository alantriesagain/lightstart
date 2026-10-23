import { html } from "@bootstrapp/light/html";

export default {
  description: "A drop zone and a file button in one, with previews and progress for what has been picked.",
  preview: () => html`
    <lc-file-upload variant="dropzone" accept="image/*" multiple></lc-file-upload>
  `,
  previewWidth: 640,
  examples: [
    {
      title: "Basic",
      render: () => html`
        <lc-file-upload></lc-file-upload>
      `,
    },
    {
      title: "Multiple",
      render: () => html`
        <lc-file-upload multiple></lc-file-upload>
      `,
    },
    {
      title: "Dropzone variant",
      render: () => html`
        <lc-file-upload variant="dropzone"></lc-file-upload>
      `,
    },
    {
      title: "Accept only images",
      render: () => html`
        <lc-file-upload accept="image/*" variant="dropzone"></lc-file-upload>
      `,
    },
    {
      title: "With a size limit",
      render: () => html`
        <lc-file-upload max-size="5242880" variant="dropzone"></lc-file-upload>
      `,
    },
    {
      title: "Multiple images with preview",
      render: () => html`
        <lc-file-upload
          accept="image/*"
          multiple
          variant="dropzone"
          show-preview
        ></lc-file-upload>
      `,
    },
    {
      title: "Documents only",
      render: () => html`
        <lc-file-upload
          accept=".pdf,.doc,.docx"
          variant="dropzone"
        ></lc-file-upload>
      `,
    },
    {
      title: "In a form",
      render: () => html`
        <form>
          <label>Upload your resume:</label>
          <lc-file-upload
            name="resume"
            accept=".pdf,.doc,.docx"
            required
            max-size="2097152"
          ></lc-file-upload>
          <lc-button primary type="submit">Submit Application</lc-button>
        </form>
      `,
    },
  ],
};
