import { env } from "cloudflare:workers";
import { corsHeaders, evidenceStore, json, options } from "../../_shared";

export const OPTIONS = options;

export async function GET(request: Request, context: { params?: Promise<{ key?: string[] | string }> | { key?: string[] | string } }) {
  try {
    const rawParams = await Promise.resolve(context?.params);
    let key = "";
    if (rawParams?.key) {
      key = Array.isArray(rawParams.key) ? rawParams.key.join("/") : String(rawParams.key);
    }
    if (!key) {
      const url = new URL(request.url);
      key = decodeURIComponent(url.pathname.replace(/^\/api\/mobile\/evidence\/?/, ""));
    }

    if (!key) {
      return json({ error: "Fotografía no especificada." }, 400);
    }

    // 1. Try Cloudflare R2 if available
    if (env.EVIDENCE) {
      const object = await env.EVIDENCE.get(key);
      if (object) {
        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(object.body, { headers });
      }
    }

    // 2. Try in-memory / local fallback store
    const stored = evidenceStore.get(key);
    if (stored) {
      const headers = new Headers(corsHeaders);
      headers.set("Content-Type", stored.contentType || "image/jpeg");
      headers.set("Cache-Control", "public, max-age=86400");
      return new Response(stored.buffer, { headers });
    }

    return json({ error: "Fotografía no encontrada." }, 404);
  } catch (error) {
    console.error("Error serving evidence image:", error);
    return json({ error: "Error al cargar la fotografía." }, 500);
  }
}
