import type { Metadata } from 'next';
import React from 'react';
import PlanDetailClient from '@/components/public/PlanDetailClient';
import { BRAND_CONFIG } from '@/config/brand';
import { createInitialDemoState } from '@/lib/seed/demoData';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const plan = createInitialDemoState().trainingPlans.find(
    (p) => p.slug === slug || p.id === slug
  );

  if (!plan) {
    return {
      title: 'Programme Trail',
      alternates: {
        canonical: `/catalog/${slug}`,
      },
    };
  }

  return {
    title: plan.title,
    description: plan.subtitle ? `${plan.subtitle} — ${plan.description}` : plan.description,
    alternates: {
      canonical: `/catalog/${plan.slug}`,
    },
    openGraph: {
      title: `${plan.title} | ${BRAND_CONFIG.appName}`,
      description: plan.description,
      url: `${BRAND_CONFIG.siteUrl}/catalog/${plan.slug}`,
    },
  };
}

export default async function PlanDetailPage({ params }: Props) {
  const { slug } = await params;
  return <PlanDetailClient slug={slug} />;
}
