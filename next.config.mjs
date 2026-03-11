/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig = {
  ...(distDir ? { distDir } : {}),
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      config.externals.push('playwright', '@playwright/test');
    }

    if (dev) {
      const prevIgnored = config.watchOptions?.ignored;
      const ignoredListRaw = Array.isArray(prevIgnored)
        ? prevIgnored
        : prevIgnored
          ? [prevIgnored]
          : [];
      const ignoredList = ignoredListRaw.filter(
        (item) => typeof item === 'string' && item.trim().length > 0
      );

      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...ignoredList,
          '**/tests/**',
          '**/edge-cases/**',
          '**/reports/**',
          '**/.next/**',
          '**/.next-e2e/**',
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
