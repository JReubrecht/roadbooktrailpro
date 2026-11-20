import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { BRAND_CONFIG } from '@/config/brand';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité & RGPD',
  description:
    'Protection des données personnelles et physiologiques (RGPD Art. 9), chiffrement AES-256-GCM des clés API Intervals.icu et droits d’export/effacement.',
  alternates: {
    canonical: '/legal/confidentialite',
  },
};

export default function PolitiqueConfidentialitePage() {
  const { legal } = BRAND_CONFIG;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-lg border border-slate-200 p-8 sm:p-10 space-y-6 text-sm text-slate-700 leading-relaxed">
        <div className="border-b border-slate-200 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            CONFORMITÉ UE 2016/679 · RGPD &amp; CNIL
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-1">
            Politique de Confidentialité
          </h1>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">1. Responsable du traitement</h2>
          <p>
            {legal.businessName} ({legal.ownerName}) traite vos données personnelles dans le respect du Règlement Général sur la Protection des Données (RGPD) et de la loi Informatique et Libertés.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">
            2. Données physiologiques &amp; Consentement explicite (Article 9 RGPD)
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Compte &amp; identité :</strong> nom, email, rôle et statut d&apos;accès (exécution du contrat).
            </li>
            <li>
              <strong>Données physiologiques (Intervals.icu &amp; Check-ins) :</strong> CTL, ATL, TSB, fréquence cardiaque, HRV, RPE, fatigue, courbatures et douleur. Traitement soumis à un <strong>consentement explicite</strong> avant connexion Intervals.icu.
            </li>
            <li>
              <strong>Chiffrement des secrets :</strong> les clés API Intervals.icu sont chiffrées côté serveur en <strong>AES-256-GCM</strong> et ne transitent jamais en clair côté navigateur après enregistrement.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">3. Conservation &amp; Droits</h2>
          <p>
            Les données de suivi actif sont conservées pendant l&apos;accompagnement et purgées au plus tard 24 mois après la dernière activité (12 mois pour les demandes de contact). Export JSON (Art. 20) et suppression (Art. 17) disponibles dans le{' '}
            <Link href="/athlete/settings#rgpd-center" className="text-[#FF5A36] font-semibold underline">
              Centre de Confidentialité
            </Link>{' '}
            ou par email à <strong>{legal.contactEmail}</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
