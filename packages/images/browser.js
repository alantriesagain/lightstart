/**
 * @file Client-side image resizing using canvas + createImageBitmap.
 * Resizes large images before upload to save bandwidth and storage.
 * Skips SVGs, GIFs, non-images, and images already within bounds.
 */

/**
 * Resize a picked image before upload, or answer the file unchanged when it is
 * not an image, is an SVG/GIF, or already fits. Uses `OffscreenCanvas` when it
 * exists and a DOM canvas otherwise.
 * @param {File} file
 * @param {{ maxWidth?: number, maxHeight?: number, quality?: number, type?: string }} [options]
 * @returns {Promise<File>}
 */
export async function resizeImage(file, options = {}) {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.85, type = "image/webp" } = options;

  if (!file.type?.startsWith("image/")) {
    console.log("[resize] Skipping non-image file:", file.name, file.type);
    return file;
  }
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    console.log("[resize] Skipping SVG/GIF:", file.name);
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const originalSize = file.size;

  console.log(`[resize] Input: ${file.name}, ${width}x${height}, ${(originalSize / 1024).toFixed(1)}KB, ${file.type}`);
  console.log(`[resize] Limits: ${maxWidth}x${maxHeight}, quality=${quality}, output=${type}`);

  if (width <= maxWidth && height <= maxHeight) {
    bitmap.close();
    console.log("[resize] Already within bounds, skipping");
    return file;
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);

  /** @type {OffscreenCanvas | HTMLCanvasElement} */
  let canvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(newWidth, newHeight);
  } else {
    const element = document.createElement("canvas");
    element.width = newWidth;
    element.height = newHeight;
    canvas = element;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const outputType = type || file.type;
  /** @type {Blob | null} */
  const blob =
    canvas instanceof OffscreenCanvas
      ? await canvas.convertToBlob({ type: outputType, quality })
      : await new Promise((resolve) => canvas.toBlob(resolve, outputType, quality));
  if (!blob) throw new Error("Canvas could not encode the image");

  const ext = outputType === "image/webp" ? ".webp" : outputType === "image/jpeg" ? ".jpg" : ".png";
  const baseName = file.name?.replace(/\.[^.]+$/, "") || "image";
  const result = new File([blob], `${baseName}${ext}`, { type: outputType });

  const savings = ((1 - result.size / originalSize) * 100).toFixed(1);
  console.log(`[resize] Output: ${result.name}, ${newWidth}x${newHeight}, ${(result.size / 1024).toFixed(1)}KB, ${outputType}`);
  console.log(`[resize] Saved ${savings}% (${((originalSize - result.size) / 1024).toFixed(1)}KB)`);

  return result;
}
