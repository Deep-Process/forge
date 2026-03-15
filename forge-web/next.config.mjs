import webpack from "next/dist/compiled/webpack/webpack-lib.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config) => {
    // elkjs conditionally requires 'web-worker' for Node.js Worker support.
    // We use the browser Worker API via workerUrl instead, so this import
    // is never needed. Ignore it to prevent build failures.
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^web-worker$/ }),
    );
    return config;
  },
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
