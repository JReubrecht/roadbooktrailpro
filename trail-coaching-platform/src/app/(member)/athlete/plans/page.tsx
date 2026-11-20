'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Lock } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { canAccessTrainingPlan } from '@/lib/access/entitlements';

export default function MemberPlansPage() {
  const { store, currentUser, currentProfile, access, featureFlags, simulateOrderCheckout } =
    usePlatform();
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!currentUser) return null;

  const published = store.trainingPlans.filter((p) => p.status === 'published');
  const unlocked = published.filter((p) =>
    canAccessTrainingPlan(p.id, currentUser, currentProfile, store.entitlements)
  );
  const locked = published.filter(
    (p) => !canAccessTrainingPlan(p.id, currentUser, currentProfile, store.entitlements)
  );

  const handleQuickUnlock = async (planId: string, priceCents: number) => {
    setErr(null);
    setMsg(null);
    setProcessingId(planId);
    try {
      await simulateOrderCheckout({
        orderType: 'plan_purchase',
        trainingPlanId: planId,
        amountCents: priceCents,
      });
      setMsg('Programme débloqué et ajouté à votre bibliothèque membre.');
      setExpandedPlanId(planId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur lors du déblocage.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="pb-4 border-b border-slate-200 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#FF5A36] font-semibold">
            BIBLIOTHÈQUE MEMBRE · {access.tierBadgeLabel}
          </p>
          <h1 className="text-2xl font-bold text-[#0F172A] mt-0.5">
            Mes Programmes d&apos;Entraînement
          </h1>
        </div>
        {featureFlags.programSalesEnabled && (
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#0F172A]"
          >
            <span>Voir la vitrine catalogue</span>
            <ArrowUpRight size={13} />
          </Link>
        )}
      </div>

      {msg && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
          {err}
        </div>
      )}

      {/* Plans Débloqués */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Programmes actifs &amp; débloqués ({unlocked.length})
        </h2>

        {unlocked.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-[#0F172A]">
              Aucun programme débloqué sur votre compte pour le moment.
            </p>
            <p className="text-xs text-slate-500">
              Souscrivez à un plan ci-dessous ou demandez au coach de vous attribuer un droit `plan_access`.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {unlocked.map((plan) => {
              const isExpanded = expandedPlanId === plan.id || unlocked.length === 1;
              return (
                <div
                  key={plan.id}
                  className="bg-white border border-slate-200 border-l-2 border-l-[#14C38E] rounded-lg overflow-hidden"
                >
                  <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-[#14C38E] font-bold">
                        ACCÈS ACTIF · {plan.durationWeeks} SEMAINES · {plan.level || 'TRAIL'}
                      </p>
                      <h3 className="text-lg font-bold text-[#0F172A] mt-0.5">{plan.title}</h3>
                      {plan.subtitle && (
                        <p className="text-xs text-slate-500 mt-0.5">{plan.subtitle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPlanId(isExpanded && unlocked.length > 1 ? null : plan.id)
                      }
                      className="px-3.5 py-2 rounded-md border border-slate-300 hover:border-[#0F172A] text-xs font-semibold text-[#0F172A] cursor-pointer"
                    >
                      {isExpanded ? 'Masquer la trame' : 'Ouvrir les semaines'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-[#F8FAFC] p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-white border border-slate-200 rounded-md p-4">
                          <p className="font-mono uppercase text-[10px] text-slate-400">
                            Stratégie Nutrition
                          </p>
                          <p className="text-slate-700 mt-1 leading-relaxed">
                            {plan.content.nutritionGuidelines}
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-md p-4">
                          <p className="font-mono uppercase text-[10px] text-slate-400">
                            Conseils Roadbook
                          </p>
                          <p className="text-slate-700 mt-1 leading-relaxed">
                            {plan.content.roadbookAdvice}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-200">
                        {plan.content.weeklyStructure.map((w) => (
                          <div key={w.weekNumber} className="p-4 space-y-2">
                            <div className="flex flex-wrap justify-between gap-2 text-xs">
                              <span className="font-bold text-[#0F172A]">
                                <span className="font-mono text-[#FF5A36] mr-2">
                                  S{String(w.weekNumber).padStart(2, '0')} · {w.phase.toUpperCase()}
                                </span>
                                {w.focus}
                              </span>
                              <span className="font-mono text-slate-500 tabular-nums">
                                {w.targetHours}h · +{w.targetElevationM}m D+
                              </span>
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {w.keySessions.map((s, idx) => (
                                <li
                                  key={idx}
                                  className="rounded border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-xs text-slate-700"
                                >
                                  &mdash; {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Programmes complémentaires non débloqués (visibles uniquement si la boutique est activée) */}
      {featureFlags.programSalesEnabled && locked.length > 0 && (
        <section className="space-y-4 pt-2">
          <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
            Autres programmes disponibles ({locked.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locked.map((plan) => (
              <div
                key={plan.id}
                className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">
                      {plan.level} · {plan.durationWeeks} SEM.
                    </span>
                    <span className="font-bold text-[#0F172A]">
                      {(plan.priceCents / 100).toFixed(0)} EUR
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[#0F172A] mt-2">{plan.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{plan.description}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Link
                    href={`/catalog/${plan.slug}`}
                    className="text-xs font-semibold text-slate-600 underline hover:text-[#0F172A]"
                  >
                    Détails
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleQuickUnlock(plan.id, plan.priceCents)}
                    disabled={processingId === plan.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <Lock size={12} />
                    <span>
                      {processingId === plan.id
                        ? 'Validation...'
                        : `Débloquer (${(plan.priceCents / 100).toFixed(0)} €)`}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
