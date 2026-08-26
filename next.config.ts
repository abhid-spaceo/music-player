import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy.
 *
 * Development needs two relaxations that must NEVER reach production:
 *  - `unsafe-eval`, because React's development build uses eval() to
 *    reconstruct stack traces.
 *  - `ws:` in connect-src, for the HMR socket.
 * Without them the app does not hydrate at all, which is how this was found.
 */
const csp = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  // The one iframe this app needs. nocookie is what we actually embed.
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  // Thumbnails are hotlinked from YouTube's CDN rather than re-encoded.
  "img-src 'self' data: https://i.ytimg.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.youtube.com https://www.youtube-nocookie.com`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "media-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Next 16 blocks cross-origin requests to dev resources (/_next/static, the
   * HMR socket) by default, and it treats 127.0.0.1 as a different origin from
   * localhost — so a browser pointed at 127.0.0.1 gets 403s on every JS chunk
   * and never hydrates. Development only; it has no effect on a build.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HSTS is what makes the Secure cookie flag and the Origin check
          // load-bearing. Production only — it would pin localhost to https.
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains',
                },
              ]),
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
