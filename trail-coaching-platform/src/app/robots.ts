import type { MetadataRoute } from 'next';
import { BRAND_CONFIG } from '@/config/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/athlete', '/athlete/', '/coach', '/coach/', '/community', '/api/', '/login'],
    },
    sitemap: `${BRAND_CONFIG.siteUrl}/sitemap.xml`,
  };
}
