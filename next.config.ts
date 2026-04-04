import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 标记 pdf-parse 为外部依赖，避免 webpack 打包
      config.externals = config.externals || [];
      config.externals.push('pdf-parse');
    }
    return config;
  },
};

export default nextConfig;
