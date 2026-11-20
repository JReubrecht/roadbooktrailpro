'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { canAccessTrainingPlan } from '@/lib/access/entitlements';

export default function CatalogClient() {
  const { store, currentUser, currentProfile, access, featureFlags, updateFeatureFlags } =
    usePlatform();
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  // Vente de programmes masquée pour les visiteurs/athlètes tant que l'admin ne l'a pas activée
  if (!featureFlags.programSalesEnabled && !access.canAccessCoachDashboard) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="bg-white border border-slate-200 rounded-lg p-8 sm:p-10 space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            CATALOGUE EN PRÉPARATION
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A]">
            Les programmes d&apos;entraînement autonomes ouvriront prochainement
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Actuellement, la plateforme privilégie le coaching individuel sur mesure, les audits de course et le suivi de notre groupe pilote. Nos outils scientifiques GPX &amp; Nutrition restent accessibles gratuitement.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/#contact-bilan"
              className="px-4 py-2.5 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold transition-colors"
            >
              Demander un accompagnement coaching
            </Link>
            <Link
              href="/tools"
              className="px-4 py-2.5 rounded-md border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-xs font-semibold transition-colors"
            >
              Outils Trail Gratuits
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const publishedPlans = store.trainingPlans.filter((p) => {
    if (p.status !== 'published') return false;
    if (levelFilter !== 'ALL' && p.level !== levelFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
      {!featureFlags.programSalesEnabled && access.canAccessCoachDashboard && (
        <div className="bg-[#0F172A] text-white rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-mono">
            APERÇU ADMIN &mdash; La vente de programmes est actuellement <strong>MASQUÉE AU PUBLIC</strong>.
          </span>
          <button
            type="button"
            onClick={() => updateFeatureFlags({ programSalesEnabled: true })}
            className="px-3 py-1.5 rounded bg-[#14C38E] text-[#0F172A] font-bold cursor-pointer"
          >
            Activer la vente au public
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            CATALOGUE PROGRAMMES TRAIL &amp; ULTRA
          </p>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#0F172A] mt-1">
            Plans d&apos;Entraînement Structurés
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Blocs progressifs de 8 à 20 semaines avec séances spécifiques en côte, protocoles nutritionnels et stratégie roadbook.
          </p>
        </div>

        <div className="flex flex-wrap border-b border-slate-200 gap-4">
          {['ALL', 'Découverte', 'Intermédiaire', 'Confirmé', 'Expert Ultra'].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`pb-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                levelFilter === lvl
                  ? 'border-[#FF5A36] text-[#0F172A]'
                  : 'border-transparent text-slate-500 hover:text-[#0F172A]'
              }`}
            >
              {lvl === 'ALL' ? 'Tous' : lvl}
            </button>
          ))}
        </div>
      </div>

      {publishedPlans.length === 0 ? (
        <div className="rounded-lg bg-white border border-slate-200 p-12 text-center text-sm text-slate-500">
          Aucun programme publié pour ce niveau.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publishedPlans.map((plan) => {
            const unlocked = canAccessTrainingPlan(
              plan.id,
              currentUser,
              currentProfile,
              store.entitlements
            );
            return (
              <div
                key={plan.id}
                className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 p-7 flex flex-col justify-between transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="uppercase tracking-wider text-slate-500">
                      {plan.level || 'TRAIL'} · {plan.durationWeeks} SEM.
                    </span>
                    {unlocked ? (
                      <span className="uppercase font-bold text-[#14C38E]">DÉBLOQUÉ</span>
                    ) : (
                      <span className="font-bold text-[#0F172A] tabular-nums">
                        {(plan.priceCents / 100).toFixed(0)} EUR
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-[#0F172A]">{plan.title}</h2>
                    {plan.subtitle && (
                      <p className="text-xs font-medium text-slate-500 mt-1">{plan.subtitle}</p>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">{plan.description}</p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {plan.targetDistanceKm ? `~${plan.targetDistanceKm} km` : ''}{' '}
                    {plan.targetElevationM ? `· +${plan.targetElevationM} m D+` : ''}
                  </span>
                  <Link
                    href={`/catalog/${plan.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
                  >
                    <span>{unlocked ? 'Ouvrir le programme' : 'Consulter'}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
