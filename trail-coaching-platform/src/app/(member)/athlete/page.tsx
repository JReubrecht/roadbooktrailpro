'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock, RefreshCw, ArrowRight } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import { canAccessTrainingPlan } from '@/lib/access/entitlements';

export default function AthleteDashboardPage() {
  const { currentUser, currentProfile, access, store, featureFlags, syncAthleteIntervals } =
    usePlatform();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4">
          <Lock className="mx-auto text-[#FF5A36]" size={24} />
          <h1 className="text-xl font-bold text-[#0F172A]">Espace Athlète</h1>
          <p className="text-sm text-slate-600">
            Connectez-vous ou utilisez le sélecteur « Aperçu » en bas à gauche pour inspecter un profil athlète.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold"
            >
              Connexion
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

  const snapshots = store.intervalsSnapshots
    .filter((s) => s.userId === currentUser.id)
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
  const latestSnap = snapshots[0] || null;
  const connection = store.intervalsConnections.find((c) => c.userId === currentUser.id) || null;
  const checkIns = store.checkIns
    .filter((c) => c.userId === currentUser.id)
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  const unlockedPlans = store.trainingPlans.filter((p) =>
    canAccessTrainingPlan(p.id, currentUser, currentProfile, store.entitlements)
  );
  const roadbooks = store.roadbooks.filter((r) => r.userId === currentUser.id || r.isPublic);

  const handleSync = async () => {
    setSyncErr(null);
    setSyncMsg(null);
    setSyncing(true);
    try {
      const snap = await syncAthleteIntervals(currentUser.id);
      setSyncMsg(
        `Synchronisation effectuée au ${snap.snapshotDate} (CTL ${snap.ctl ?? '-'} · TSB ${snap.tsb ?? '-'}).`
      );
    } catch (err: unknown) {
      setSyncErr(err instanceof Error ? err.message : 'Erreur synchronisation.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* En-tête Athlète */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-[#FF5A36] font-semibold">{access.tierBadgeLabel}</span>
            {currentProfile?.trailIndex && (
              <span className="text-slate-500">ITRA {currentProfile.trailIndex}</span>
            )}
            {connection && (
              <span className="text-slate-400">INTERVALS {connection.intervalsAthleteId}</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
            {currentUser.displayName}
          </h1>
          <p className="text-sm text-slate-500">
            {currentProfile?.showcaseGoalRace || 'Suivi physiologique, retours terrain et programmes.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/messages"
            className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:border-[#0F172A] text-[#0F172A] text-xs font-semibold transition-colors"
          >
            Messagerie Coach
          </Link>
          <Link
            href="/athlete/check-in"
            className="px-4 py-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold transition-colors"
          >
            Check-in (30s)
          </Link>
          {access.canSyncIntervals && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Synchro...' : 'Synchro Intervals.icu'}</span>
            </button>
          )}
          <Link
            href="/athlete/settings"
            className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-semibold"
          >
            Paramètres &amp; RGPD
          </Link>
        </div>
      </div>

      {syncMsg && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {syncMsg}
        </div>
      )}
      {syncErr && (
        <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
          {syncErr}
        </div>
      )}

      {/* Télémétrie Intervals.icu */}
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Télémétrie Intervals.icu (7 derniers jours)
        </h2>

        {!latestSnap ? (
          <div className="bg-white rounded-lg border border-dashed border-slate-300 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-[#0F172A]">
              Aucun snapshot Intervals.icu synchronisé pour ce compte.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Renseignez votre ID athlète et clé API dans vos paramètres (chiffrement AES-256-GCM côté serveur).
            </p>
            <Link
              href="/athlete/settings"
              className="inline-block px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold"
            >
              Connecter Intervals.icu &rarr;
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase text-slate-400">Fitness (CTL)</p>
              <p className="font-mono text-3xl font-bold text-[#0F172A] tabular-nums mt-1">
                {latestSnap.ctl ?? '-'}
              </p>
              <p className="font-mono text-[11px] text-slate-500 mt-1">
                Ramp {latestSnap.rampRate !== undefined ? `+${latestSnap.rampRate}` : '-'}
              </p>
            </div>
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase text-slate-400">Fatigue (ATL)</p>
              <p className="font-mono text-3xl font-bold text-[#FF5A36] tabular-nums mt-1">
                {latestSnap.atl ?? '-'}
              </p>
              <p className="font-mono text-[11px] text-slate-500 mt-1">
                Compliance {latestSnap.compliancePct ?? '-'}%
              </p>
            </div>
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase text-slate-400">Forme (TSB)</p>
              <p
                className={`font-mono text-3xl font-bold tabular-nums mt-1 ${
                  (latestSnap.tsb ?? 0) <= -20
                    ? 'text-red-600'
                    : (latestSnap.tsb ?? 0) >= 0
                    ? 'text-[#14C38E]'
                    : 'text-[#0F172A]'
                }`}
              >
                {latestSnap.tsb !== undefined
                  ? latestSnap.tsb > 0
                    ? `+${latestSnap.tsb}`
                    : latestSnap.tsb
                  : '-'}
              </p>
              <p className="font-mono text-[11px] text-slate-500 mt-1">
                HRV {latestSnap.hrvRmssd ?? '-'} ms · FC {latestSnap.restingHrObserved ?? '-'}
              </p>
            </div>
            <div className="p-5">
              <p className="font-mono text-[10px] uppercase text-slate-400">Volume 7 jours</p>
              <p className="font-mono text-2xl font-bold text-[#0F172A] tabular-nums mt-1">
                {latestSnap.weeklyDistanceKm ?? 0} km
              </p>
              <p className="font-mono text-[11px] font-semibold text-[#14C38E] mt-1 tabular-nums">
                +{latestSnap.weeklyElevationM ?? 0} m D+ · {latestSnap.weeklyDurationMin ?? 0} min
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Plans + Check-ins + Roadbooks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-[#0F172A]">
              Programmes ({unlockedPlans.length})
            </h3>
            {featureFlags.programSalesEnabled && (
              <Link href="/catalog" className="text-xs font-semibold text-[#FF5A36] hover:underline">
                Catalogue
              </Link>
            )}
          </div>
          {unlockedPlans.length === 0 ? (
            <div className="text-xs text-slate-500 space-y-2">
              <p>
                {featureFlags.programSalesEnabled
                  ? `Aucun plan débloqué sur ce compte (${access.tierBadgeLabel}).`
                  : 'Aucun programme attribué par votre coach pour le moment.'}
              </p>
              {featureFlags.programSalesEnabled && (
                <Link href="/athlete/plans" className="inline-flex items-center gap-1 font-semibold text-[#0F172A] underline">
                  Voir les programmes disponibles <ArrowRight size={12} />
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {unlockedPlans.map((plan) => (
                <Link
                  key={plan.id}
                  href="/athlete/plans"
                  className="block py-3 first:pt-0 last:pb-0 hover:text-[#FF5A36]"
                >
                  <p className="font-semibold text-sm text-[#0F172A]">{plan.title}</p>
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                    {plan.durationWeeks} SEM. · +{plan.targetElevationM ?? 0} M D+
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-[#0F172A]">
              Check-ins récents ({checkIns.length})
            </h3>
            <Link href="/athlete/check-in" className="text-xs font-semibold text-[#14C38E] hover:underline">
              + Ajouter
            </Link>
          </div>
          {checkIns.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun retour enregistré.</p>
          ) : (
            <div className="space-y-3">
              {checkIns.slice(0, 4).map((ci) => (
                <div
                  key={ci.id}
                  className={`rounded-md border p-3 text-xs ${
                    ci.painFlag
                      ? 'bg-red-50/50 border-slate-200 border-l-2 border-l-red-600'
                      : 'bg-[#F8FAFC] border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] font-semibold text-[#0F172A]">
                    <span>{ci.checkInDate}</span>
                    <span>
                      RPE {ci.rpe ?? '-'}/10 · FAT {ci.fatigueLevel ?? '-'}/5
                    </span>
                  </div>
                  {ci.painFlag && (
                    <p className="text-red-700 font-semibold mt-1">
                      Douleur : {ci.sensitiveArea || 'Zone non précisée'}
                    </p>
                  )}
                  {ci.comment && <p className="text-slate-600 mt-1 line-clamp-2">{ci.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-[#0F172A]">Roadbooks</h3>
            <Link href="/athlete/roadbook" className="text-xs font-semibold text-[#FF5A36] hover:underline">
              Studio GPX
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {roadbooks.map((rb) => (
              <Link key={rb.id} href="/athlete/roadbook" className="block py-3 first:pt-0 last:pb-0">
                <p className="font-semibold text-sm text-[#0F172A] hover:text-[#FF5A36]">{rb.name}</p>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5 tabular-nums">
                  {rb.officialDistanceKm ?? '-'} KM · +{rb.officialElevationM ?? '-'} M D+ · ITRA {rb.itraIndex}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
