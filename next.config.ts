import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com",
              `connect-src 'self'${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""} https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://va.vercel-scripts.com`,
              "worker-src 'self' blob:",
              "child-src blob:",
              "font-src 'self'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
