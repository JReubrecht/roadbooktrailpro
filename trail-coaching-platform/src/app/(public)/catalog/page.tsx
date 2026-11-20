import type { Metadata } from 'next';
import React from 'react';
import CatalogClient from '@/components/public/CatalogClient';
import { BRAND_CONFIG } from '@/config/brand';

export const metadata: Metadata = {
  title: "Catalogue Programmes d'Entraînement Trail",
  description:
    'Plans d’entraînement trail et ultra-trail structurés (25 km à 100 Miles) avec travail spécifique D+ et protocoles nutritionnels.',
  alternates: {
    canonical: '/catalog',
  },
  openGraph: {
    title: `Programmes d'Entraînement Trail | ${BRAND_CONFIG.appName}`,
    description:
      'Blocs progressifs de 8 à 20 semaines pour préparer vos objectifs trail et ultra-trail.',
    url: `${BRAND_CONFIG.siteUrl}/catalog`,
  },
};

export default function CatalogPage() {
  return <CatalogClient />;
}
