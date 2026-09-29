import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Production: exported as static files and served by the FastAPI app (see run.py),
// so the API is same-origin at /api. Dev: `next dev` proxies /api to uvicorn.
const nextConfig: NextConfig = isDev
  ? {
      async rewrites() {
        const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
        return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
      },
    }
  : { output: "export", images: { unoptimized: true } };

export default nextConfig;
