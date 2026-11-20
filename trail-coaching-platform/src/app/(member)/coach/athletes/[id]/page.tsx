'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { TierStatus } from '@/types/domain';

export default function CoachAthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    currentUser,
    access,
    store,
    syncAthleteIntervals,
    updateAthleteProfileCoach,
    ensureDirectRoomWith,
  } = usePlatform();

  const athleteUser = store.users.find((u) => u.id === id);
  const profile = store.athleteProfiles.find((p) => p.userId === id);

  const [notesCoach, setNotesCoach] = useState(profile?.notesCoach || '');
  const [tierStatus, setTierStatus] = useState<TierStatus>(profile?.tierStatus || 'free');
  const [isFeatured, setIsFeatured] = useState<boolean>(Boolean(profile?.isShowcaseFeatured));
  const [showcaseQuote, setShowcaseQuote] = useState(profile?.showcaseQuote || '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  if (!currentUser || !access.canAccessCoachDashboard) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Accès réservé Coach</h1>
      </div>
    );
  }

  if (!athleteUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold">Athlète introuvable</h1>
        <Link href="/coach" className="text-sm font-semibold text-[#FF5A36] underline">
          &larr; Retour Cockpit Coach
        </Link>
      </div>
    );
  }

  const snapshots = store.intervalsSnapshots
    .filter((s) => s.userId === id)
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  const checkIns = store.checkIns
    .filter((c) => c.userId === id)
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));

  const handleSaveCoachUpdates = (e: React.FormEvent) => {
    e.preventDefault();
    updateAthleteProfileCoach(id, {
      notesCoach,
      tierStatus,
      isShowcaseFeatured: isFeatured,
      showcaseQuote,
    });
    setSavedMsg('Dossier athlète mis à jour.');
    setTimeout(() => setSavedMsg(null), 3500);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAthleteIntervals(id);
      setSavedMsg('Snapshot Intervals.icu synchronisé.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <Link
        href="/coach"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A]"
      >
        <ArrowLeft size={14} />
        <span>Retour au Cockpit Coach</span>
      </Link>

      <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#FF5A36] font-semibold">
            DOSSIER INDIVIDUEL ATHLÈTE
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-0.5">
            {athleteUser.displayName}
          </h1>
          <p className="font-mono text-xs text-slate-500 mt-1">
            {athleteUser.email} · ITRA {profile?.trailIndex ?? '-'} · VMA {profile?.vmaKmh ?? '-'} km/h · FC Repos {profile?.restingHr ?? '-'} bpm
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              const room = await ensureDirectRoomWith(id);
              router.push(`/messages?room=${room.id}`);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <MessageSquare size={13} />
            <span>Ouvrir le chat</span>
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Synchro...' : 'Synchro Intervals.icu'}</span>
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
          {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveCoachUpdates}
          className="bg-white rounded-lg border border-slate-200 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3">
            Paramètres, Tier &amp; Notes privées
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                Statut (tierStatus)
              </label>
              <select
                value={tierStatus}
                onChange={(e) => setTierStatus(e.target.value as TierStatus)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold bg-white"
              >
                <option value="pilot_showcase">pilot_showcase</option>
                <option value="coaching_paid">coaching_paid</option>
                <option value="plan_only">plan_only</option>
                <option value="free">free</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 p-2 rounded-md bg-[#F8FAFC] border border-slate-200 w-full text-xs font-semibold text-[#0F172A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[#14C38E]"
                />
                <span>Afficher sur Vitrine publique</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              Témoignage Vitrine (showcaseQuote)
            </label>
            <textarea
              rows={2}
              value={showcaseQuote}
              onChange={(e) => setShowcaseQuote(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              Notes privées Coach
            </label>
            <textarea
              rows={4}
              value={notesCoach}
              onChange={(e) => setNotesCoach(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-[#FF5A36] text-white text-xs font-semibold cursor-pointer"
          >
            Enregistrer
          </button>
        </form>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-2">
              Snapshots Intervals.icu ({snapshots.length})
            </h2>
            {snapshots.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun snapshot.</p>
            ) : (
              <div className="divide-y divide-slate-100 font-mono text-xs tabular-nums">
                {snapshots.map((s) => (
                  <div key={s.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-[#0F172A]">{s.snapshotDate}</span>
                    <span>
                      CTL {s.ctl ?? '-'} · ATL {s.atl ?? '-'} · TSB {s.tsb ?? '-'}
                    </span>
                    <span className="text-[#14C38E] font-semibold">
                      {s.weeklyDistanceKm ?? 0}km / +{s.weeklyElevationM ?? 0}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-2">
              Check-ins Terrain ({checkIns.length})
            </h2>
            {checkIns.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun check-in.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {checkIns.map((ci) => (
                  <div
                    key={ci.id}
                    className={`py-3 text-xs ${ci.painFlag ? 'pl-3 border-l-2 border-red-600' : ''}`}
                  >
                    <div className="flex justify-between font-mono font-semibold text-[#0F172A]">
                      <span>{ci.checkInDate}</span>
                      <span>
                        RPE {ci.rpe ?? '-'}/10 · FAT {ci.fatigueLevel ?? '-'}/5
                      </span>
                    </div>
                    {ci.painFlag && (
                      <p className="text-red-700 font-semibold mt-1">
                        Douleur : {ci.sensitiveArea || 'Signalée'}
                      </p>
                    )}
                    {ci.comment && <p className="text-slate-600 mt-1">{ci.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
