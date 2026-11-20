'use client';

import React from 'react';
import Link from 'next/link';
import { usePlatform } from '@/context/PlatformContext';

export default function HomeOffersSection() {
  const { store, featureFlags } = usePlatform();

  const selectOffer = (offer: 'race_audit' | 'coaching_1to1') => {
    window.dispatchEvent(new CustomEvent('mykairn:select-offer', { detail: offer }));
  };

  return (
    <section id="offres-coaching" className="max-w-7xl mx-auto px-4 sm:px-6 pt-20">
      <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            {featureFlags.programSalesEnabled
              ? '02 / Accompagnement & Programmes'
              : '02 / Coaching & Conseil'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1.5">
            {featureFlags.programSalesEnabled
              ? "Trois niveaux d'engagement adaptés à votre saison"
              : "Deux formules d'accompagnement trail"}
          </h2>
        </div>
        <p className="text-sm text-slate-500 max-w-md">
          Toutes les formules reposent sur la même rigueur d&apos;analyse et l&apos;accès aux outils myKairn.
        </p>
      </div>

      <div
        className={
          featureFlags.programSalesEnabled
            ? 'mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6'
            : 'mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl'
        }
      >
        {/* Offre 1 : Pack Stratégie Jour J */}
        <div className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Livrable Clé-en-Main · 1 Course
              </span>
              <span className="font-mono text-xl font-bold text-[#0F172A] tabular-nums shrink-0">
                89 €
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#0F172A] mt-4">
              Pack Stratégie Jour J &amp; Roadbook Sur-Mesure
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Trois livrables concrets basés sur votre historique multi-sources (Garmin, Coros, Suunto, Strava, FIT/GPX) pour verrouiller votre objectif majeur.
            </p>
            <ul className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-sm text-slate-700">
              <li>&mdash; Analyse écrite de votre historique charge &amp; zones FC/allure</li>
              <li>&mdash; Roadbook GPX calibré sur vos vraies allures, barrières horaires &amp; nuit</li>
              <li>&mdash; Plan nutrition / hydratation ravito par ravito + briefing visio 45 min</li>
            </ul>
            <p className="mt-5 rounded-md bg-[#F8FAFC] border border-slate-200 border-l-2 border-l-[#14C38E] px-3 py-2 text-xs text-[#0F172A] leading-relaxed">
              <strong>Passerelle 1-to-1 :</strong> 45 € déduits de votre 1er mois si vous poursuivez en Coaching Individuel sous 15 jours.
            </p>
          </div>
          <a
            href="#contact-bilan"
            onClick={() => selectOffer('race_audit')}
            className="mt-6 w-full inline-flex items-center justify-center py-2.5 px-4 rounded-md border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-sm font-semibold transition-colors"
          >
            Commander le Pack Stratégie
          </a>
        </div>

        {/* Offre 2 : Coaching 1-to-1 */}
        <div className="bg-white border border-slate-300 border-t-2 border-t-[#FF5A36] rounded-lg p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF5A36] font-semibold">
                Suivi Continu 1-to-1
              </span>
              <span className="font-mono text-xl font-bold text-[#0F172A] tabular-nums">
                129 € <span className="text-xs font-normal text-slate-500">/ mois</span>
              </span>
            </div>
            <h3 className="text-xl font-bold text-[#0F172A] mt-4">
              Coaching Individuel Trail &amp; Ultra
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Planification ajustée chaque semaine selon vos données d&apos;entraînement (charge, FC, allure, HRV — quelle que soit votre montre), votre emploi du temps et vos retours check-in.
            </p>
            <ul className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-sm text-slate-700">
              <li>&mdash; Analyse multi-sources (Garmin, Coros, Suunto, Polar, Strava) &amp; séances exportables sur montre</li>
              <li>&mdash; Veille charge/fatigue et alertes douleur en continu</li>
              <li>&mdash; Stratégie complète sur l&apos;ensemble des courses de la saison</li>
            </ul>
            <p className="mt-5 font-mono text-[11px] text-slate-500">
              Entrée après échange découverte visio de 15 min offert (compatibilité &amp; objectifs).
            </p>
          </div>
          <a
            href="#contact-bilan"
            onClick={() => selectOffer('coaching_1to1')}
            className="mt-6 w-full inline-flex items-center justify-center py-2.5 px-4 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-sm font-semibold transition-colors"
          >
            Candidater au suivi 1-to-1
          </a>
        </div>

        {/* Offre 3 : Catalogue Plans */}
        {featureFlags.programSalesEnabled && (
          <div className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Autonomie Guidée
                </span>
                <span className="font-mono text-xl font-bold text-[#0F172A] tabular-nums">
                  dès 39 €
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#0F172A] mt-4">
                Plans d&apos;Entraînement Structurés
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Programmes de 8 à 20 semaines (25 km à 100 Miles) avec trame hebdomadaire, travail spécifique D+ et conseils nutritionnels intégrés.
              </p>
              <ul className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 text-sm text-slate-700">
                <li>&mdash; Déblocage immédiat et permanent dans votre espace</li>
                <li>&mdash; Blocs Base, Build, Peak &amp; Taper détaillés</li>
                <li>&mdash; Protocoles week-ends chocs et gestion d&apos;allure</li>
              </ul>
            </div>
            <Link
              href="/catalog"
              className="mt-8 w-full inline-flex items-center justify-center py-2.5 px-4 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
            >
              Voir les {store.trainingPlans.filter((p) => p.status === 'published').length} plans au catalogue
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
