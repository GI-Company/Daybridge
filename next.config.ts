import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key:'X-Content-Type-Options', value:'nosniff' },
        { key:'X-Frame-Options', value:'DENY' },
        { key:'Referrer-Policy', value:'no-referrer' },
        { key:'Permissions-Policy', value:'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
        { key:'Strict-Transport-Security', value:'max-age=31536000; includeSubDomains' },
        { key:'Cross-Origin-Opener-Policy', value:'same-origin' },
        { key:'X-DNS-Prefetch-Control', value:'off' },
      ],
    }];
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
