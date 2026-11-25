import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// No external scripts, frames, plugins or form targets. Inline scripts/styles stay allowed because Next.js
// emits inline bootstrap scripts (a nonce-based policy would make every page dynamic).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 4 MB files plus the multipart envelope; Vercel itself cuts the request off at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  partialPrefetching: true,
  poweredByHeader: false,
  // pdfkit reads its own data files from node_modules at run time, so it must not be bundled.
  // postgres ships a workerd-specific build that must be used on Cloudflare Workers.
  serverExternalPackages: ["pdfkit", "postgres"],
  // quote-pdf.ts reads these from disk at run time. Without this the serverless bundle omits them
  // and every quote PDF fails in production (works locally, 500 on Vercel).
  outputFileTracingIncludes: {
    "/api/quotes/[id]/pdf": ["./public/fonts/**/*", "./public/brand/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
