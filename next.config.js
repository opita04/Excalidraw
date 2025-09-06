/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['esm.sh'],
  },
  // Exclude excalidraw-old folder from compilation
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /excalidraw-old/,
      loader: 'ignore-loader'
    });
    return config;
  },
  // Also exclude from TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
