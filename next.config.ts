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
    ],
  },
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['@/assets'] = path.join(__dirname, 'src/assets');
      
      // This is a workaround to make sure the assets are copied to the server build
      const assetsPath = path.join(__dirname, 'src', 'assets');
      config.module.rules.push({
        test: /\.(svg)$/,
        include: [assetsPath],
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'static/assets/', // a path in .next/server/
              publicPath: '/_next/static/assets/' // a path that can be accessed from the browser
            }
          }
        ]
      })
    }
    return config
  }
};

export default nextConfig;
