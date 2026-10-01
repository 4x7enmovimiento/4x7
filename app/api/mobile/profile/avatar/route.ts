import { getSupabase } from "../../../../../db/supabase";
import { apiError, json, options, requireMobileUser } from "../../_shared";

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return json({ error: "Selecciona una fotografía." }, 400);
    if (!photo.type.startsWith("image/")) return json({ error: "El archivo debe ser una imagen." }, 415);
    if (photo.size > 20 * 1024 * 1024) return json({ error: "La imagen debe pesar menos de 20 MB." }, 413);

    const buffer = Buffer.from(await photo.arrayBuffer());
    const supabase = getSupabase();
    const filePath = `${current.userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: photo.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase avatar upload error:", uploadError);
      return json({ error: "No se pudo guardar la foto de perfil en Supabase." }, 500);
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData?.publicUrl || `https://lhrdapdtcrjqlbjozmjc.supabase.co/storage/v1/object/public/avatars/${filePath}`;

    return json({ ok: true, avatarUrl }, 200);
  } catch (error) {
    return apiError(error);
  }
}
