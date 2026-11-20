import type { MetadataRoute } from 'next';
import { BRAND_CONFIG, DEFAULT_FEATURE_FLAGS } from '@/config/brand';
import { createInitialDemoState } from '@/lib/seed/demoData';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = BRAND_CONFIG.siteUrl;
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/legal/mentions-legales`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/confidentialite`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/cgv-cgu`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  if (DEFAULT_FEATURE_FLAGS.programSalesEnabled) {
    routes.push({
      url: `${baseUrl}/catalog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });

    const publishedPlans = createInitialDemoState().trainingPlans.filter(
      (plan) => plan.status === 'published'
    );
    for (const plan of publishedPlans) {
      routes.push({
        url: `${baseUrl}/catalog/${plan.slug}`,
        lastModified: new Date(plan.updatedAt),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  return routes;
}
