import { apiError, corsHeaders, evidenceStore, json, options, randomToken, requireMobileUser } from "../_shared";

const env: any = (globalThis as any).process?.env || {};

export const OPTIONS = options;

export async function POST(request: Request) {
  try {
    const current = await requireMobileUser(request);
    if (!current) return json({ error: "Sesión no válida." }, 401);

    const form = await request.formData();
    const photo = form.get("photo");
    if (!(photo instanceof File)) return json({ error: "Selecciona una fotografía." }, 400);
    if (!photo.type.startsWith("image/")) return json({ error: "El archivo debe ser una imagen." }, 415);
    if (photo.size > 50 * 1024 * 1024) return json({ error: "La imagen debe pesar menos de 50 MB." }, 413);

    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const key = `${current.familyId}/${current.userId}/${Date.now()}-${randomToken(6)}.${extension}`;

    if (env.EVIDENCE) {
      await env.EVIDENCE.put(key, photo.stream(), {
        httpMetadata: { contentType: photo.type, cacheControl: "private, max-age=3600" },
        customMetadata: { familyId: String(current.familyId), userId: String(current.userId) },
      });
    } else {
      const buffer = await photo.arrayBuffer();
      evidenceStore.set(key, { buffer, contentType: photo.type });
    }

    return json({ evidenceKey: key, evidenceUrl: `/api/mobile/evidence/${key}` }, 201);
  } catch (error) {
    return apiError(error);
  }
}
