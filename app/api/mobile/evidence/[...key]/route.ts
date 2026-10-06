import { corsHeaders, evidenceStore, json, options } from "../../_shared";

const env: any = (globalThis as any).process?.env || {};

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

    // Direct redirect to public Supabase Storage CDN (instant delivery, zero serverless latency)
    const publicUrl = `https://lhrdapdtcrjqlbjozmjc.supabase.co/storage/v1/object/public/evidence/${key}`;
    return Response.redirect(publicUrl, 307);
  } catch (error) {
    console.error("Error serving evidence image:", error);
    return json({ error: "Error al cargar la fotografía." }, 500);
  }
}
