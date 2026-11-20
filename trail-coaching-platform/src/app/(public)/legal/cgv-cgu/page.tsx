import type { Metadata } from 'next';
import React from 'react';
import { BRAND_CONFIG } from '@/config/brand';

export const metadata: Metadata = {
  title: 'CGV / CGU',
  description: `Conditions Générales de Vente et d’Utilisation des services de coaching trail et outils en ligne ${BRAND_CONFIG.appName}.`,
  alternates: {
    canonical: '/legal/cgv-cgu',
  },
};

export default function CgvCguPage() {
  const { legal } = BRAND_CONFIG;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-lg border border-slate-200 p-8 sm:p-10 space-y-6 text-sm text-slate-700 leading-relaxed">
        <div className="border-b border-slate-200 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            CONDITIONS CONTRACTUELLES · CODE DE LA CONSOMMATION
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-1">
            Conditions Générales de Vente &amp; d&apos;Utilisation (CGV / CGU)
          </h1>
        </div>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">1. Prestations</h2>
          <p>
            Les présentes conditions régissent l&apos;accès aux outils gratuits en ligne, la vente de programmes d&apos;entraînement numériques et les abonnements de coaching individuel proposés par <strong>{legal.businessName}</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">
            2. Contenus numériques &amp; Rétractation (Art. L.221-28)
          </h2>
          <p>
            Les programmes d&apos;entraînement débloqués immédiatement après commande constituent des contenus numériques non fournis sur support matériel. L&apos;accès immédiat au programme avant expiration du délai de 14 jours implique le renoncement exprès au droit de rétractation conformément à l&apos;article L.221-28 13° du Code de la consommation. Les suivis mensuels sont résiliables sans engagement avant l&apos;échéance suivante.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#0F172A]">3. Propriété intellectuelle &amp; Médiation</h2>
          <p>
            Plans, séances et supports roadbook sont réservés à un usage strictement individuel. Médiation de la consommation disponible via contact préalable à {legal.contactEmail} (Articles L.616-1 et R.616-1).
          </p>
        </section>
      </div>
    </div>
  );
}
