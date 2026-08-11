import { env } from "cloudflare:workers";
import { corsHeaders, json, options, requireMobileUser } from "../../_shared";

export const OPTIONS = options;

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  const current = await requireMobileUser(request);
  if (!current) return json({ error: "Sesión no válida." }, 401);
  const { key: keyParts } = await context.params;
  const key = keyParts.join("/");
  if (!key.startsWith(`${current.familyId}/`)) return json({ error: "No tienes acceso a esta fotografía." }, 403);

  const object = await env.EVIDENCE?.get(key);
  if (!object) return json({ error: "Fotografía no encontrada." }, 404);
  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
