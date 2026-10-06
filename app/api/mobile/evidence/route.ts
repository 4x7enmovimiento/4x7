import { apiError, corsHeaders, evidenceStore, json, options, randomToken, requireMobileUser } from "../_shared";

const env: any = (globalThis as any).process?.env || {};

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof Blob || (photo && typeof (photo as any).arrayBuffer === "function"))) {
      return json({ error: "Selecciona una fotografía." }, 400);
    }

    const mimeType = (photo as any).type || "image/jpeg";
    if (mimeType && !mimeType.startsWith("image/") && mimeType !== "application/octet-stream") {
      return json({ error: "El archivo debe ser una imagen." }, 415);
    }
    const photoSize = (photo as any).size || 0;
    if (photoSize > 50 * 1024 * 1024) {
      return json({ error: "La imagen debe pesar menos de 50 MB." }, 413);
    }

    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const key = `${current.familyId}/${current.userId}/${Date.now()}-${randomToken(6)}.${extension}`;
    const buffer = Buffer.from(await (photo as any).arrayBuffer());

    const { getSupabase } = await import("../../../../db/supabase");
    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage.from("evidence").upload(key, buffer, {
      contentType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      upsert: true,
    });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return json({ error: `Error al guardar foto en Supabase: ${uploadError.message}` }, 500);
    }

    if (env.EVIDENCE) {
      try {
        await env.EVIDENCE.put(key, buffer, {
          httpMetadata: { contentType: mimeType, cacheControl: "public, max-age=86400" },
          customMetadata: { familyId: String(current.familyId), userId: String(current.userId) },
        });
      } catch {}
    }

    evidenceStore.set(key, { buffer, contentType: mimeType });

    const directPublicUrl = `https://lhrdapdtcrjqlbjozmjc.supabase.co/storage/v1/object/public/evidence/${key}`;

    return json({
      evidenceKey: key,
      evidenceUrl: directPublicUrl,
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}
