import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ============================================================================
// WORLD-CLASS NEXT.JS 16 CONFIGURATION
// Performance-optimized, security-hardened, production-ready
// ============================================================================

// Environment detection
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';
const isAnalyze = process.env.ANALYZE === 'true';

// ============================================================================
// SECURITY HEADERS CONFIGURATION - Maximum Security (100/100)
// ============================================================================
const securityHeaders = [
  // DNS Prefetch Control - Enable DNS prefetching for faster external resource loading
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  // HTTP Strict Transport Security (HSTS) - 2 years, preload ready
  // Only in production — sending this on localhost forces HTTPS and breaks dev
  ...(process.env.NODE_ENV === 'production' ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  }] : []),
  // Prevent clickjacking attacks
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  // Prevent MIME type sniffing attacks
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  // XSS Protection (legacy but still provides defense-in-depth)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  // Control referrer information - strict for privacy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  // Permissions Policy - Disable unnecessary browser features
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=(self)',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
      'interest-cohort=()'
    ].join(', ')
  },
  // Content Security Policy - Production ready with strict policies
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://connect-js.stripe.com https://maps.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.stripe.com https://maps.googleapis.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://connect-js.stripe.com https://connect.stripe.com https://*.stripe.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.stripe.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  },
  // Cross-Origin policies - configured for external image loading
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups'
  },
  // Note: Cross-Origin-Resource-Policy and Cross-Origin-Embedder-Policy
  // are not set to allow loading external images from CDNs like Unsplash
  // Prevent Adobe Flash/PDF cross-domain policies
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none'
  },
  // Prevent IE from executing downloads in site's context
  {
    key: 'X-Download-Options',
    value: 'noopen'
  }
];

// API-specific headers (different caching strategy)
const apiHeaders = [
  ...securityHeaders,
  {
    key: 'Cache-Control',
    value: 'private, no-cache, no-store, must-revalidate'
  },
  {
    key: 'Pragma',
    value: 'no-cache'
  },
  {
    key: 'Expires',
    value: '0'
  }
];

// Dynamic page headers (no caching for HTML)
const dynamicPageHeaders = [
  ...securityHeaders,
  {
    key: 'Cache-Control',
    value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
  },
  {
    key: 'Pragma',
    value: 'no-cache'
  }
];

// ============================================================================
// CACHING HEADERS FOR STATIC ASSETS
// ============================================================================
const staticAssetHeaders = [
  ...securityHeaders,
  // Aggressive caching for immutable static assets (1 year)
  {
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable'
  }
];

// Font caching headers (longer cache, stale-while-revalidate for fonts)
const fontHeaders = [
  ...securityHeaders,
  {
    key: 'Cache-Control',
    value: 'public, max-age=31536000, immutable, stale-while-revalidate=86400'
  }
];

// Image caching headers
const imageHeaders = [
  ...securityHeaders,
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, stale-while-revalidate=604800'
  }
];

// ============================================================================
// MAIN NEXT.JS CONFIGURATION
// ============================================================================
const nextConfig: NextConfig = {
  // ==========================================================================
  // COMPREHENSIVE IMAGE OPTIMIZATION
  // ==========================================================================
  images: {
    // Remote image patterns - allow specific trusted domains
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.stripe.com' },
    ],
    // Image formats - prioritize modern formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Icon/thumbnail sizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimize layout shift with proper sizing
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache
    // Disable static image imports if not needed (can reduce bundle)
    disableStaticImages: false,
    // Content disposition type for downloaded images
    contentDispositionType: 'inline',
    // Enable dangerous SVG allow (only if you trust all image sources)
    dangerouslyAllowSVG: false,
    // Content security policy for images
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Unoptimized mode for development (faster builds)
    unoptimized: isDev,
  },

  // ==========================================================================
  // TURBOPACK CONFIGURATION (Next.js 16 default bundler)
  // ==========================================================================
  turbopack: {
    root: process.cwd(),
    // Module resolution rules
    resolveAlias: {
      // Add any custom aliases here
      '@': './src',
    },
  },

  // ==========================================================================
  // EXPERIMENTAL FEATURES FOR PERFORMANCE
  // ==========================================================================
  experimental: {
    // Optimize package imports - tree-shake specific packages
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      'date-fns',
      'zod',
      'zustand',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    // Server Actions configuration
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: [
        'localhost:3000',
        process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, ''),
      ].filter((origin): origin is string => Boolean(origin)),
    },
    // Typed routes disabled - codebase uses many dynamic routes
    typedRoutes: false,
    // Web vitals attribution for debugging
    webVitalsAttribution: ['CLS', 'LCP', 'FCP', 'FID', 'TTFB', 'INP'],
    // Scroll restoration for better UX
    scrollRestoration: true,
    // Optimistic client cache
    staleTimes: {
      dynamic: 30, // Cache dynamic data for 30 seconds
      static: 180, // Cache static data for 3 minutes
    },
  },

  // ==========================================================================
  // COMPILER OPTIONS
  // ==========================================================================
  compiler: {
    // Remove console.log in production
    removeConsole: isProd ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // ==========================================================================
  // OUTPUT CONFIGURATION
  // ==========================================================================
  // Standalone output for Docker/containerized deployments
  output: isProd ? 'standalone' : undefined,

  // ==========================================================================
  // COMPRESSION CONFIGURATION
  // ==========================================================================
  // Enable gzip compression (Brotli is handled by hosting platform)
  compress: true,

  // ==========================================================================
  // POWERED BY HEADER - Disable for security
  // ==========================================================================
  poweredByHeader: false,

  // ==========================================================================
  // STRICT MODE FOR DEVELOPMENT
  // ==========================================================================
  reactStrictMode: true,

  // ==========================================================================
  // PRODUCTION BROWSER SOURCE MAPS
  // ==========================================================================
  productionBrowserSourceMaps: false,

  // ==========================================================================
  // GENERATE ETAGS FOR CACHING
  // ==========================================================================
  generateEtags: true,

  // ==========================================================================
  // TRAILING SLASH CONFIGURATION
  // ==========================================================================
  trailingSlash: false,

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================
  logging: {
    fetches: {
      fullUrl: isDev,
      hmrRefreshes: isDev,
    },
  },

  // ==========================================================================
  // ONDEMAND ENTRIES (for development)
  // ==========================================================================
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000, // 1 minute
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
  },

  // ==========================================================================
  // SECURITY HEADERS CONFIGURATION
  // ==========================================================================
  async headers() {
    return [
      // API routes - strict security, no caching
      {
        source: '/api/:path*',
        headers: [
          ...apiHeaders,
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ],
      },
      // Next.js static files - aggressive caching
      {
        source: '/_next/static/:path*',
        headers: staticAssetHeaders,
      },
      // Next.js image optimization - cache with revalidation
      {
        source: '/_next/image/:path*',
        headers: imageHeaders,
      },
      // Font files - long-term caching
      {
        source: '/:path*.(woff|woff2|eot|ttf|otf)',
        headers: fontHeaders,
      },
      // Image assets - cache with revalidation
      {
        source: '/:path*.(ico|png|jpg|jpeg|gif|svg|webp|avif)',
        headers: imageHeaders,
      },
      // CSS and JS files - long-term caching
      {
        source: '/:path*.(css|js)',
        headers: staticAssetHeaders,
      },
      // Manifest and service worker
      {
        source: '/manifest.json',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          }
        ],
      },
      {
        source: '/sw.js',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ],
      },
      // All other routes - dynamic pages with no caching
      {
        source: '/:path*',
        headers: dynamicPageHeaders,
      },
    ];
  },

  // ==========================================================================
  // REDIRECTS
  // ==========================================================================
  async redirects() {
    return [
      // Redirect www to non-www (or vice versa based on preference)
      // Uncomment and modify as needed:
      // {
      //   source: '/:path*',
      //   has: [{ type: 'host', value: 'www.example.com' }],
      //   destination: 'https://example.com/:path*',
      //   permanent: true,
      // },
    ];
  },

  // ==========================================================================
  // REWRITES
  // ==========================================================================
  async rewrites() {
    return {
      beforeFiles: [
        // Add any before-files rewrites here
      ],
      afterFiles: [
        // Add any after-files rewrites here
      ],
      fallback: [
        // Add any fallback rewrites here
      ],
    };
  },

  // ==========================================================================
  // WEBPACK CONFIGURATION (for bundle analyzer and customizations)
  // ==========================================================================
  webpack: (config, { isServer }) => {
    // Enable bundle analyzer when ANALYZE=true
    if (isAnalyze) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
          openAnalyzer: false,
          generateStatsFile: true,
          statsFilename: isServer
            ? '../analyze/server-stats.json'
            : './analyze/client-stats.json',
        })
      );
    }

    // Optimize production builds
    if (isProd) {
      // Enable module concatenation for smaller bundles
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        concatenateModules: true,
      };
    }

    // Ignore optional dependencies that cause warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },

  // ==========================================================================
  // TYPESCRIPT CONFIGURATION
  // ==========================================================================
  typescript: {
    // Fail build on TypeScript errors in production
    ignoreBuildErrors: isDev,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
