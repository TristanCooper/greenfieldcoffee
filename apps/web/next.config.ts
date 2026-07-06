import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tailwind 4 is the default — no PostCSS plugin in next.config needed.
  // Workspace packages are resolved through the paths alias in tsconfig.json.
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;