/**
 * Client-side media validation & automatic image compression
 * to satisfy Meta / Kapso WhatsApp Cloud API size limits:
 * - Images: max 5 MB
 * - Video / Audio: max 16 MB
 * - Documents: max 100 MB
 */

const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // target <= 4.5 MB (Meta hard limit 5 MB)
const MAX_VIDEO_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_DOC_BYTES = 100 * 1024 * 1024;

export async function prepareMediaForKapso(file: File): Promise<{ file: File; compressed: boolean }> {
  const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  const isVideoOrAudio =
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    /\.(mp4|3gp|mp3|ogg|aac)$/i.test(file.name);

  if (isVideoOrAudio && file.size > MAX_VIDEO_AUDIO_BYTES) {
    throw new Error(
      `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB, which exceeds Meta's 16 MB video/audio limit.`
    );
  }
  if (!isImage && !isVideoOrAudio && file.size > MAX_DOC_BYTES) {
    throw new Error(
      `Document "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB, which exceeds Meta's 100 MB document limit.`
    );
  }

  if (!isImage || file.size <= MAX_IMAGE_BYTES) {
    return { file, compressed: false };
  }

  // Compress oversized image in-browser via Canvas
  const bitmap = await createImageBitmap(file);
  const maxDim = 1920;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, compressed: false };
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.86;
  let blob: Blob | null = null;
  while (quality >= 0.45) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (blob && blob.size <= MAX_IMAGE_BYTES) break;
    quality -= 0.12;
  }

  if (!blob) return { file, compressed: false };
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return {
    file: new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }),
    compressed: true,
  };
}
