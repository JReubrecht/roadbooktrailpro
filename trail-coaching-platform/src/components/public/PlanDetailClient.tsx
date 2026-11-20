'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { canAccessTrainingPlan } from '@/lib/access/entitlements';

export default function PlanDetailClient({ slug }: { slug: string }) {
  const {
    store,
    currentUser,
    currentProfile,
    access,
    featureFlags,
    updateFeatureFlags,
    simulateOrderCheckout,
  } = usePlatform();
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const plan = store.trainingPlans.find((p) => p.slug === slug || p.id === slug);

  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Programme introuvable</h1>
        <Link href="/" className="text-sm font-semibold text-[#FF5A36] underline">
          &larr; Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const isUnlocked = canAccessTrainingPlan(
    plan.id,
    currentUser,
    currentProfile,
    store.entitlements
  );

  // Bloquer la vue boutique si désactivée au public (sauf admin ou athlète possédant déjà ce droit)
  if (!featureFlags.programSalesEnabled && !access.canAccessCoachDashboard && !isUnlocked) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20">
        <div className="bg-white border border-slate-200 rounded-lg p-8 space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            PROGRAMME BIENTÔT DISPONIBLE
          </p>
          <h1 className="text-2xl font-bold text-[#0F172A]">{plan.title}</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            La vente directe de programmes est temporairement fermée au public pendant notre phase pilote. Demandez un accompagnement coaching individuel ou utilisez nos calculateurs gratuits.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/#contact-bilan"
              className="px-4 py-2 rounded-md bg-[#FF5A36] text-white text-xs font-semibold"
            >
              Contacter le coach
            </Link>
            <Link
              href="/tools"
              className="px-4 py-2 rounded-md border border-slate-300 text-xs font-semibold text-[#0F172A]"
            >
              Outils Gratuits
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleCheckout = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setProcessing(true);
    try {
      await simulateOrderCheckout({
        orderType: 'plan_purchase',
        trainingPlanId: plan.id,
        amountCents: plan.priceCents,
      });
      setStatusMsg('Accès activé : le programme complet est désormais débloqué dans votre espace.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors du déblocage.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {!featureFlags.programSalesEnabled && access.canAccessCoachDashboard && (
        <div className="bg-[#0F172A] text-white rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-mono">
            APERÇU ADMIN &mdash; Vente publique masquée aux visiteurs.
          </span>
          <button
            type="button"
            onClick={() => updateFeatureFlags({ programSalesEnabled: true })}
            className="px-3 py-1.5 rounded bg-[#14C38E] text-[#0F172A] font-bold cursor-pointer"
          >
            Activer la vente de programmes
          </button>
        </div>
      )}

      <Link
        href="/catalog"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A]"
      >
        <ArrowLeft size={14} />
        <span>Retour au catalogue</span>
      </Link>

      <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1.5 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#FF5A36] font-semibold">
              {plan.level || 'PROGRAMME TRAIL'} · {plan.durationWeeks} SEMAINES
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
              {plan.title}
            </h1>
            {plan.subtitle && <p className="text-sm text-slate-500">{plan.subtitle}</p>}
          </div>

          <div className="text-right font-mono tabular-nums">
            <p className="text-2xl font-bold text-[#0F172A]">
              {(plan.priceCents / 100).toFixed(0)} EUR
            </p>
            <p className="text-[11px] text-slate-400">ACCÈS PERMANENT</p>
          </div>
        </div>

        <p className="text-sm sm:text-base text-slate-700 leading-relaxed">{plan.description}</p>

        {errorMsg && (
          <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
            {errorMsg}{' '}
            {!currentUser && (
              <Link href="/login" className="underline ml-1">
                Se connecter
              </Link>
            )}
          </div>
        )}
        {statusMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
            {statusMsg}
          </div>
        )}

        {!isUnlocked ? (
          <div className="rounded-md bg-[#F8FAFC] border border-slate-300 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="text-[#FF5A36] shrink-0 mt-0.5" size={18} />
              <div>
                <h2 className="font-bold text-sm text-[#0F172A]">
                  Contenu complet soumis à entitlement `plan_access`
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Validez l&apos;achat simulé (prêt pour Stripe Checkout) ou testez un profil Pilote / Coach.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={processing}
              className="px-5 py-2.5 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50"
            >
              {processing ? 'Validation...' : `Débloquer (${(plan.priceCents / 100).toFixed(0)} €)`}
            </button>
          </div>
        ) : (
          <div className="rounded-md bg-emerald-50/70 border-l-2 border-[#14C38E] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[#047857]">
            <span>Entitlement actif — Accès complet à la trame d&apos;entraînement débloqué.</span>
            <Link href="/athlete/plans" className="text-[#0F172A] underline font-bold hover:text-[#FF5A36]">
              Ouvrir dans Mon Espace Membre &rarr;
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Structure &amp; Prérequis
          </h3>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">{plan.content.summary}</p>
          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
            <strong>Prérequis :</strong> {plan.content.prerequisites}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Nutrition &amp; Roadbook
          </h3>
          <p className="text-sm text-slate-700 mt-2 leading-relaxed">
            {isUnlocked
              ? plan.content.nutritionGuidelines
              : 'Réservé aux détenteurs du programme (entitlement plan_access).'}
          </p>
          {isUnlocked && (
            <p className="text-xs text-[#047857] font-medium mt-3 pt-3 border-t border-slate-100">
              <strong>Pacing :</strong> {plan.content.roadbookAdvice}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0F172A]">Blocs Hebdomadaires Clés</h2>
          {!isUnlocked && (
            <span className="font-mono text-[11px] text-[#FF5A36]">APERÇU SEMAINE 1</span>
          )}
        </div>

        <div className="divide-y divide-slate-200">
          {plan.content.weeklyStructure.map((week, idx) => {
            const lockedWeek = !isUnlocked && idx > 0;
            return (
              <div key={week.weekNumber} className={`p-5 ${lockedWeek ? 'bg-slate-50/70 opacity-75' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[#0F172A]">
                      S{String(week.weekNumber).padStart(2, '0')} · {week.phase.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-[#0F172A]">{week.focus}</span>
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {week.targetHours}h · +{week.targetElevationM} m D+
                  </span>
                </div>

                {lockedWeek ? (
                  <p className="mt-2 font-mono text-xs text-slate-400 flex items-center gap-1.5">
                    <Lock size={12} /> CONTENU VERROUILLÉ
                  </p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {week.keySessions.map((session, sIdx) => (
                      <li
                        key={sIdx}
                        className="rounded-md bg-[#F8FAFC] border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      >
                        &mdash; {session}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
