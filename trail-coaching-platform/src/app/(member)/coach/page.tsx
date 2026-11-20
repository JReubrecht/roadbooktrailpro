'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { computeCoachAlertsForAthlete } from '@/lib/access/entitlements';
import type { GrantType, EntitlementSource, TrainingPlan } from '@/types/domain';

export default function CoachDashboardPage() {
  const {
    currentUser,
    access,
    store,
    featureFlags,
    updateFeatureFlags,
    syncAthleteIntervals,
    grantEntitlement,
    revokeEntitlement,
    createOrUpdatePlan,
    resetDemoData,
  } = usePlatform();

  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const athletes = store.users.filter((u) => u.role === 'athlete');
  const [grantUserId, setGrantUserId] = useState<string>(athletes[0]?.id || 'athlete-free-demo');
  const [grantType, setGrantType] = useState<GrantType>('plan_access');
  const [grantPlanId, setGrantPlanId] = useState<string>(store.trainingPlans[0]?.id || '');
  const [grantSource, setGrantSource] = useState<EntitlementSource>('manual_grant');

  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanDist, setNewPlanDist] = useState('50');
  const [newPlanEle, setNewPlanEle] = useState('3000');
  const [newPlanPriceEur, setNewPlanPriceEur] = useState('79');

  const allAlerts = useMemo(() => {
    const collected = athletes.flatMap((ath) => {
      const latestSnap = store.intervalsSnapshots
        .filter((s) => s.userId === ath.id)
        .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
      return computeCoachAlertsForAthlete(ath.displayName, ath.id, latestSnap, store.checkIns);
    });
    const order = { critical: 0, warning: 1, info: 2 };
    return collected.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [athletes, store.intervalsSnapshots, store.checkIns]);

  if (!currentUser || !access.canAccessCoachDashboard) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg border border-slate-300 border-l-2 border-l-red-600 p-8 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
            <ShieldAlert size={18} />
            <span>Accès réservé au Coach / Admin</span>
          </div>
          <p className="text-sm text-slate-600">
            Activez « Vue Coach / Admin » dans le sélecteur en bas à gauche ou connectez-vous avec un compte coach autorisé.
          </p>
        </div>
      </div>
    );
  }

  const handleSyncAthlete = async (userId: string, name: string) => {
    setErrorBanner(null);
    setStatusBanner(null);
    setSyncingUserId(userId);
    try {
      const snap = await syncAthleteIntervals(userId);
      setStatusBanner(
        `Sync Intervals.icu : ${name} — CTL ${snap.ctl ?? '-'} · ATL ${snap.atl ?? '-'} · TSB ${snap.tsb ?? '-'}.`
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur synchronisation.');
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusBanner(null);
    try {
      await grantEntitlement({
        userId: grantUserId,
        grantType,
        trainingPlanId: grantType === 'plan_access' ? grantPlanId : undefined,
        source: grantSource,
      });
      setStatusBanner('Entitlement attribué avec succès.');
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur attribution droit.');
    }
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanTitle.trim()) return;
    const slug = newPlanTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const plan: TrainingPlan = {
      id: `plan-${Date.now()}`,
      slug: `${slug || 'programme'}-${Date.now().toString().slice(-4)}`,
      title: newPlanTitle.trim(),
      subtitle: `12 semaines · ~${newPlanDist} km / +${newPlanEle} m D+`,
      description: 'Programme structuré créé depuis le Cockpit Coach myKairn.',
      targetDistanceKm: Number(newPlanDist) || 50,
      targetElevationM: Number(newPlanEle) || 3000,
      durationWeeks: 12,
      level: 'Confirmé',
      priceCents: Math.round((Number(newPlanPriceEur) || 79) * 100),
      currency: 'EUR',
      status: 'published',
      content: {
        summary: 'Progression individualisable avec séances clés en côte et validation roadbook.',
        prerequisites: 'Base aérobie régulière 4h/semaine minimum.',
        nutritionGuidelines: '60 à 75 g glucides/h + hydratation électrolytes.',
        roadbookAdvice: 'Départ maîtrisé, gestion des pauses en ravitaillement.',
        weeklyStructure: [
          {
            weekNumber: 1,
            phase: 'Base',
            focus: 'Mise en place endurance & pied en descente',
            targetHours: 6,
            targetElevationM: 1200,
            keySessions: ['45 min EF', 'Côtes courtes 10 x 45s', 'Sortie longue 2h'],
          },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createOrUpdatePlan(plan);
    setNewPlanTitle('');
    setStatusBanner(`Plan « ${plan.title} » publié au catalogue.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            COCKPIT COACH &amp; SUPERVISION
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] mt-1">
            Athlètes, Alertes &amp; Entitlements
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/coach/brand"
            className="px-3.5 py-2 rounded-md bg-white border border-slate-300 hover:border-[#0F172A] text-xs font-semibold text-[#0F172A]"
          >
            Logo &amp; Charte graphique
          </Link>
          <button
            type="button"
            onClick={resetDemoData}
            className="px-3.5 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
          >
            Réinitialiser données pilotes
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {statusBanner}
        </div>
      )}
      {errorBanner && (
        <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
          {errorBanner}
        </div>
      )}

      {/* 0. Contrôle Admin : Vente de programmes */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
              Boutique &amp; Catalogue
            </span>
            <span
              className={
                featureFlags.programSalesEnabled
                  ? 'font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-[#047857] border border-emerald-200 font-semibold'
                  : 'font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
              }
            >
              {featureFlags.programSalesEnabled ? 'ACTIVE EN LIGNE' : 'MASQUÉE AU PUBLIC'}
            </span>
          </div>
          <h2 className="text-base font-bold text-[#0F172A]">
            Vente de programmes d&apos;entraînement
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            {featureFlags.programSalesEnabled
              ? 'La vitrine catalogue, les tarifs et le paiement des plans sont visibles par le grand public.'
              : 'La boutique publique est masquée par défaut. Vos brouillons de plans et les attributions manuelles aux athlètes pilotes restent pleinement opérationnels.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextVal = !featureFlags.programSalesEnabled;
            updateFeatureFlags({ programSalesEnabled: nextVal });
            setStatusBanner(
              nextVal
                ? 'Vente de programmes activée pour le public (/catalog, accueil, navigation).'
                : 'Vente de programmes masquée au public. Les accès pilotes restent actifs.'
            );
          }}
          className={`px-4 py-2 rounded-md text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
            featureFlags.programSalesEnabled
              ? 'border border-slate-300 bg-white hover:bg-slate-50 text-[#0F172A]'
              : 'bg-[#FF5A36] hover:bg-[#E34A28] text-white'
          }`}
        >
          {featureFlags.programSalesEnabled
            ? 'Masquer la vente au public'
            : 'Activer la vente au public'}
        </button>
      </section>

      {/* 1. Alertes */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Alertes prioritaires ({allAlerts.length})
        </h2>

        {allAlerts.length === 0 ? (
          <div className="bg-white border border-slate-200 border-l-2 border-l-[#14C38E] rounded-md p-4 text-xs font-semibold text-[#047857]">
            Aucune alerte douleur ou fatigue active.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
            {allAlerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/coach/athletes/${alert.userId}`}
                className={`p-4 flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors border-l-2 ${
                  alert.severity === 'critical'
                    ? 'border-l-red-600'
                    : alert.severity === 'warning'
                    ? 'border-l-amber-500'
                    : 'border-l-sky-500'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5 font-mono text-[11px]">
                    <span
                      className={`font-bold uppercase ${
                        alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {alert.severity === 'critical' ? 'CRITIQUE' : 'VIGILANCE'}
                    </span>
                    <span className="font-bold text-[#0F172A]">{alert.athleteName}</span>
                    <span className="text-slate-400">{alert.date}</span>
                  </div>
                  <p className="font-bold text-sm text-[#0F172A]">{alert.title}</p>
                  <p className="text-xs text-slate-600">{alert.detail}</p>
                </div>
                <ArrowRight size={15} className="text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 2. Tableau de supervision des athlètes */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Effectif suivi ({athletes.length})
        </h2>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Athlète</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">CTL</th>
                  <th className="px-4 py-3 font-semibold text-right">ATL</th>
                  <th className="px-4 py-3 font-semibold text-right">TSB</th>
                  <th className="px-4 py-3 font-semibold text-right">HRV</th>
                  <th className="px-4 py-3 font-semibold text-right">Vol 7j D+</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {athletes.map((ath) => {
                  const profile = store.athleteProfiles.find((p) => p.userId === ath.id);
                  const snap = store.intervalsSnapshots
                    .filter((s) => s.userId === ath.id)
                    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
                  const hasPain = store.checkIns.some((c) => c.userId === ath.id && c.painFlag);
                  const isSyncingThis = syncingUserId === ath.id;

                  return (
                    <tr key={ath.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#0F172A]">{ath.displayName}</div>
                        <div className="text-xs text-slate-500 truncate max-w-[240px]">
                          {profile?.showcaseGoalRace || ath.email}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px]">
                        <span className="uppercase font-semibold text-[#0F172A]">
                          {profile?.tierStatus || 'free'}
                        </span>
                        {hasPain && (
                          <span className="ml-2 text-red-600 font-bold">[DOULEUR]</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#0F172A]">
                        {snap?.ctl ?? '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#FF5A36]">
                        {snap?.atl ?? '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#0F172A]">
                        {snap?.tsb ?? '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                        {snap?.hrvRmssd ? `${snap.hrvRmssd} ms` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#14C38E]">
                        {snap?.weeklyElevationM ? `+${snap.weeklyElevationM} m` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSyncAthlete(ath.id, ath.displayName)}
                          disabled={isSyncingThis}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 hover:border-[#0F172A] text-xs font-semibold text-[#0F172A] cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSyncingThis ? 'animate-spin' : ''} />
                          <span>Sync</span>
                        </button>
                        <Link
                          href={`/coach/athletes/${ath.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold transition-colors"
                        >
                          <span>Dossier</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Entitlements + Plans & Prospects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3">
            Gestion des Droits (`entitlements`)
          </h2>

          <form onSubmit={handleGrantSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Athlète</label>
                <select
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-semibold bg-white"
                >
                  {athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Droit</label>
                <select
                  value={grantType}
                  onChange={(e) => setGrantType(e.target.value as GrantType)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-semibold bg-white"
                >
                  <option value="plan_access">plan_access</option>
                  <option value="coaching_access">coaching_access</option>
                  <option value="premium_tools">premium_tools</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {grantType === 'plan_access' && (
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Programme</label>
                  <select
                    value={grantPlanId}
                    onChange={(e) => setGrantPlanId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-semibold bg-white"
                  >
                    {store.trainingPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Source</label>
                <select
                  value={grantSource}
                  onChange={(e) => setGrantSource(e.target.value as EntitlementSource)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 font-semibold bg-white"
                >
                  <option value="manual_grant">manual_grant</option>
                  <option value="pilot_showcase">pilot_showcase</option>
                  <option value="subscription">subscription</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              Attribuer cet entitlement
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 max-h-44 overflow-y-auto divide-y divide-slate-100">
            {store.entitlements
              .filter((e) => e.isActive)
              .map((ent) => {
                const u = store.users.find((x) => x.id === ent.userId);
                return (
                  <div key={ent.id} className="flex items-center justify-between text-xs py-2">
                    <span>
                      <strong>{u?.displayName || ent.userId}</strong>{' '}
                      <span className="font-mono text-[11px] text-slate-500">
                        · {ent.grantType} ({ent.source})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeEntitlement(ent.id)}
                      className="font-mono text-[11px] text-red-600 font-semibold hover:underline cursor-pointer"
                    >
                      Révoquer
                    </button>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3">
            Publication Plan &amp; Prospects Vitrine
          </h2>

          <form onSubmit={handleCreatePlan} className="space-y-3 text-xs border-b border-slate-100 pb-5">
            <input
              type="text"
              required
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              placeholder="Titre du nouveau programme (ex: Prépa Trail 60 km)"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <div className="grid grid-cols-3 gap-2 font-mono">
              <input
                type="number"
                value={newPlanDist}
                onChange={(e) => setNewPlanDist(e.target.value)}
                placeholder="km"
                className="rounded-md border border-slate-300 px-2.5 py-2"
              />
              <input
                type="number"
                value={newPlanEle}
                onChange={(e) => setNewPlanEle(e.target.value)}
                placeholder="D+ m"
                className="rounded-md border border-slate-300 px-2.5 py-2"
              />
              <input
                type="number"
                value={newPlanPriceEur}
                onChange={(e) => setNewPlanPriceEur(e.target.value)}
                placeholder="EUR"
                className="rounded-md border border-slate-300 px-2.5 py-2"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FF5A36] text-white font-semibold cursor-pointer"
            >
              <Plus size={14} /> Publier au catalogue
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Demandes Vitrine ({store.coachingInquiries.length})
            </h3>
            {store.coachingInquiries.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune nouvelle demande pour l&apos;instant.</p>
            ) : (
              store.coachingInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="rounded-md bg-[#F8FAFC] border border-slate-200 border-l-2 border-l-[#FF5A36] p-3 text-xs space-y-1"
                >
                  <div className="flex justify-between font-semibold text-[#0F172A]">
                    <span>
                      {inq.name} ({inq.email})
                    </span>
                    <span className="font-mono text-[11px] text-[#FF5A36]">{inq.offerInterest}</span>
                  </div>
                  <p className="text-slate-600">{inq.goal}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
