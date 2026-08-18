import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "tapwash-media";

export async function uploadImage(file: File, folder: string) {
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10MB or smaller.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}
