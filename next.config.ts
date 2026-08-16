import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // On the single-domain deployment (Vercel), redirect all bare app paths to /app/...
    // This handles any Server Components that still use bare next/link hrefs.
    const appRoutes = [
      'dashboard',
      'inventory',
      'parties',
      'settings',
      'closing',
      'reports',
      'pos',
      'transactions',
      'onboarding',
    ]
    return appRoutes.flatMap((route) => [
      {
        source: `/${route}`,
        destination: `/app/${route}`,
        permanent: false,
      },
      {
        source: `/${route}/:path*`,
        destination: `/app/${route}/:path*`,
        permanent: false,
      },
    ])
  },
};

export default nextConfig;
