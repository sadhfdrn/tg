
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
        hostname: 's4.anilist.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
       {
        source: "/api/anime-proxy",
        destination: "/api/anime-proxy",
      },
    ]
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
    
    // This is to fix the "Module not found: Can't resolve" error with browserslist
    // The error comes from a dynamic require in the browserslist dependency.
    config.externals = [...config.externals, {
      './browserslist-stats.json': 'commonjs ./browserslist-stats.json'
    }]
    config.resolve.alias['caniuse-lite'] = require.resolve('caniuse-lite');

    return config
  }
};

export default nextConfig;
