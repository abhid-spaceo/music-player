import type { NextConfig } from 'next';

/**
 * No remote image patterns: thumbnails are served straight from i.ytimg.com
 * with a plain <img>, so Vercel's Image Optimization meters stay at zero.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HSTS is what makes the Secure cookie flag and the Origin check
          // load-bearing — without it a single plaintext hop defeats both.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          // The admin surface must not be framable. `frame-src` allows the
          // YouTube player, which is the one iframe this app needs.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "frame-ancestors 'none'",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              "img-src 'self' data: https://i.ytimg.com",
              "script-src 'self' 'unsafe-inline' https://www.youtube.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "connect-src 'self'",
              "base-uri 'none'",
              "form-action 'self'",
            ].join('; '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
