
import type {NextConfig} from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'animeowl.me',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gogocdn.net',
        port: '',
        pathname: '/**',
      }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/anime-proxy/:path*',
        destination: 'https://luffy.animeowl.me/:path*',
      },
    ]
  },
  output: 'standalone',
  webpack: (config, { isServer, webpack }) => {
    config.externals.push({
      'canvas': 'commonjs canvas',
      'bufferutil': 'commonjs bufferutil',
      'utf-8-validate': 'commonjs utf-8-validate',
    });
    config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource'
    });
    config.plugins.push(new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }));
    return config
  }
};

export default nextConfig;
