import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/server/rate-limit";

/**
 * Runs before every request (except static assets):
 *  - optional HTTPS enforcement (FORCE_HTTPS=true, for deployments behind a TLS proxy)
 *  - a per-IP request budget, stricter for state-changing requests
 *  - a strict, per-request nonce Content-Security-Policy on pages
 */

const isDev = process.env.NODE_ENV === "development";
const forceHttps = process.env.FORCE_HTTPS === "true";
const turnstile = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

function csp(nonce: string): string {
  const cf = turnstile ? " https://challenges.cloudflare.com" : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${cf}`,
    // Inline style *attributes* (React/Next) can't carry a nonce; scripts are what matter for XSS.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${cf}`,
    `frame-src ${turnstile ? "https://challenges.cloudflare.com" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(forceHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function tooMany(retryAfterSec: number) {
  return new NextResponse("Too many requests. Please slow down.", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSec), "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function proxy(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (forceHttps && proto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const ip = clientIp(request);
  const all = rateLimit(`req:${ip}`, 600, 60_000);
  if (!all.ok) return tooMany(all.retryAfterSec);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const writes = rateLimit(`write:${ip}`, 60, 60_000);
    if (!writes.ok) return tooMany(writes.retryAfterSec);
  }

  const isPage = !request.nextUrl.pathname.startsWith("/api/");
  let response: NextResponse;
  if (isPage) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const policy = csp(nonce);
    // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", policy);
  } else {
    response = NextResponse.next();
  }
  if (forceHttps || proto === "https") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
