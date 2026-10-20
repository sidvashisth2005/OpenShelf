import "server-only";
import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/**
 * Client IP + user agent for audit logs and rate limiting. Assumes the app sits
 * behind a reverse proxy that sets X-Forwarded-For (Vercel, nginx, Caddy...).
 */
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}
