import type { Metadata } from 'next';
import React from 'react';
import { BRAND_CONFIG } from '@/config/brand';

export const metadata: Metadata = {
  title: 'Mentions Légales',
  description: `Mentions légales, informations éditeur, carte professionnelle et hébergement de ${BRAND_CONFIG.appName}.`,
  alternates: {
    canonical: '/legal/mentions-legales',
  },
};

export default function MentionsLegalesPage() {
  const { legal } = BRAND_CONFIG;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-lg border border-slate-200 p-8 sm:p-10 space-y-6 text-sm text-slate-700 leading-relaxed">
        <div className="border-b border-slate-200 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            DOCUMENT RÉGLEMENTAIRE · LCEN N° 2004-575
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-1">
            Mentions Légales
          </h1>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">1. Éditeur du site</h2>
          <p>
            Le présent site est édité par <strong>{legal.businessName}</strong> ({legal.legalStatus}), représenté par{' '}
            <strong>{legal.ownerName}</strong>.
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs">
            <li>SIRET : {legal.siret}</li>
            <li>Qualification professionnelle (Code du Sport Art. L.212-1) : {legal.professionalCard}</li>
            <li>Adresse : {legal.address}</li>
            <li>Contact : {legal.contactEmail}</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">2. Hébergement</h2>
          <p>
            La plateforme applicative et ses bases de données sont hébergées par{' '}
            <strong>{legal.hostName}</strong> ({legal.hostAddress}), avec chiffrement en transit (TLS 1.3) et au repos.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">
            3. Avertissement Santé &amp; Pratique Sportive
          </h2>
          <p>
            Les programmes d&apos;entraînement, estimations d&apos;allure (km-effort, temps de passage) et recommandations nutritionnelles ont une vocation exclusivement sportive et informative. Ils ne se substituent en aucun cas à un avis médical. Il appartient à chaque pratiquant de vérifier son aptitude physique à la pratique du trail en compétition (PPS / certificat médical).
          </p>
        </section>
      </div>
    </div>
  );
}
