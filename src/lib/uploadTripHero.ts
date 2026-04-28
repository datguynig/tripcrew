import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_LONG_EDGE = 2400;
const ACCEPTED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type UploadError =
  | "too_large"
  | "unsupported_type"
  | "decode_failed"
  | "upload_failed"
  | "not_signed_in";

export type UploadStage = "converting" | "resizing" | "uploading";

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: UploadError; message: string };

function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".heic") || lower.endsWith(".heif");
}

async function convertHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function resizeToJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
      "image/jpeg",
      0.88,
    );
  });
}

export async function uploadTripHeroImage(
  file: File,
  onStage?: (stage: UploadStage) => void,
): Promise<UploadResult> {
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: "too_large",
      message: "Image too large. Max 8 MB.",
    };
  }
  const heic = isHeic(file);
  if (!heic && !ACCEPTED.has(file.type)) {
    return {
      ok: false,
      error: "unsupported_type",
      message: "Use JPEG, PNG, WebP, or HEIC.",
    };
  }

  let working: Blob;
  try {
    if (heic) onStage?.("converting");
    working = heic ? await convertHeic(file) : file;
  } catch {
    return {
      ok: false,
      error: "decode_failed",
      message: "Couldn't read that image. Try exporting as JPEG.",
    };
  }

  let resized: Blob;
  try {
    onStage?.("resizing");
    resized = await resizeToJpeg(working);
  } catch {
    return {
      ok: false,
      error: "decode_failed",
      message: "Couldn't process that image. Try a different one.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_signed_in", message: "Sign in first." };
  }

  onStage?.("uploading");
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("trip-hero-images")
    .upload(path, resized, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) {
    return {
      ok: false,
      error: "upload_failed",
      message: uploadError.message,
    };
  }

  const { data } = supabase.storage.from("trip-hero-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
