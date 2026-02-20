/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Static export for Cloudflare Pages (ADR-0001)
};

module.exports = nextConfig;
