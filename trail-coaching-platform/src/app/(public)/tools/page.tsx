import type { Metadata } from 'next';
import React from 'react';
import TrailToolsWorkspace from '@/components/trail/TrailToolsWorkspace';
import { BRAND_CONFIG } from '@/config/brand';

export const metadata: Metadata = {
  title: 'Roadbook GPX Express, Km-Effort & Nutrition Trail',
  description:
    'Outils trail gratuits sans inscription : import/export GPX, calculateur km-effort Minetti, prédiction chrono Riegel/ITRA, nuit SunCalc et simulateur nutrition & sodium.',
  alternates: {
    canonical: '/tools',
  },
  openGraph: {
    title: `Outils Trail Gratuits — Roadbook GPX & Calculateur | ${BRAND_CONFIG.appName}`,
    description:
      'Créez votre roadbook trail depuis votre fichier .gpx : profil altimétrique par pente, horaires cible/prudent, temps nocturnes et stratégie nutrition.',
    url: `${BRAND_CONFIG.siteUrl}/tools`,
  },
};

export default function PublicFreeTrailToolsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="pb-6 border-b border-slate-200">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#14C38E] font-semibold">
          BOÎTE À OUTILS TRAIL · GRATUIT &amp; SANS INSCRIPTION
        </p>
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1">
          Roadbook GPX Express &amp; Calculateurs
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Minetti (2002) · Loi d&apos;endurance ITRA · Cycle solaire SunCalc · Simulation nutritionnelle.
        </p>
      </div>

      <TrailToolsWorkspace mode="public" />
    </div>
  );
}
