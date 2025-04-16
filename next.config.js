/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set this to true to optimize for deployment with no native modules
  transpilePackages: ['canvas', 'pdf-img-convert'],
  
  // Disable use of unsafe-eval
  webpack: (config, { dev, isServer }) => {
    // Additional webpack config to avoid native module issues
    config.externals = [...(config.externals || []), 'canvas', 'pdf-img-convert'];
    return config;
  },
};

module.exports = nextConfig; 