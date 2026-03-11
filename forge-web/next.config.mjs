/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const apiDest = process.env.FORGE_API_INTERNAL_URL || "http://forge-api:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiDest}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${apiDest}/health`,
      },
    ];
  },
};

export default nextConfig;
