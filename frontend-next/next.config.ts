import type { NextConfig } from "next";

// Browser talks to one origin; /api/* is proxied to the Python backend (auth + chat).
const API_TARGET = process.env.API_TARGET ?? "http://localhost:5002";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
