/** @type {import('next').NextConfig} */
const nextConfig = {
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
        (item) =>
          (typeof item === 'string' && item.trim().length > 0) ||
          item instanceof RegExp
      );

      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...ignoredList,
          '**/tests/**',
          '**/edge-cases/**',
          '**/reports/**',
          '**/.next/**',
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
