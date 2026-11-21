'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, RefreshCw, ShieldAlert } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { AthleteProfile, TierStatus, UserDoc } from '@/types/domain';

interface AthleteCoachFormProps {
  athleteId: string;
  profile: AthleteProfile | undefined;
  isAdmin: boolean;
  staffUsers: UserDoc[];
  onSaveProfile: (patch: Partial<AthleteProfile>) => void;
  onAssignCoach: (coachId: string | null) => Promise<void>;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

function AthleteCoachForm({
  athleteId,
  profile,
  isAdmin,
  staffUsers,
  onSaveProfile,
  onAssignCoach,
  onSaved,
  onError,
}: AthleteCoachFormProps) {
  const [notesCoach, setNotesCoach] = useState(profile?.notesCoach || '');
  const [tierStatus, setTierStatus] = useState<TierStatus>(profile?.tierStatus || 'free');
  const [isFeatured, setIsFeatured] = useState<boolean>(Boolean(profile?.isShowcaseFeatured));
  const [showcaseQuote, setShowcaseQuote] = useState(profile?.showcaseQuote || '');
  const [intervalsAthleteId, setIntervalsAthleteId] = useState(
    profile?.intervalsAthleteId || ''
  );
  const [assignedCoachId, setAssignedCoachId] = useState(profile?.assignedCoachId || '');
  const [saving, setSaving] = useState(false);

  const assignedCoachName =
    staffUsers.find((c) => c.id === (assignedCoachId || profile?.assignedCoachId))
      ?.displayName || 'Non assigné';

  const handleSaveCoachUpdates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nextCoachId = assignedCoachId || null;
      const prevCoachId = profile?.assignedCoachId || null;
      if (isAdmin && nextCoachId !== prevCoachId) {
        await onAssignCoach(nextCoachId);
      }
      onSaveProfile({
        notesCoach,
        tierStatus,
        isShowcaseFeatured: isFeatured,
        showcaseQuote,
        intervalsAthleteId: intervalsAthleteId.trim() || undefined,
      });
      onSaved(`Dossier athlète (${athleteId}) mis à jour.`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Erreur mise à jour dossier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveCoachUpdates}
      className="bg-white rounded-lg border border-slate-200 p-6 space-y-4"
    >
      <h2 className="text-base font-bold text-[#0F172A] border-b border-slate-100 pb-3">
        Paramètres, Intervals, Référent &amp; Notes privées
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            ID Athlète Intervals.icu
          </label>
          <input
            type="text"
            value={intervalsAthleteId}
            onChange={(e) => setIntervalsAthleteId(e.target.value)}
            placeholder="ex: i412890"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono font-semibold"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Synchronisé automatiquement via la clé API du coach référent.
          </p>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
            Coach référent
          </label>
          {isAdmin ? (
            <select
              value={assignedCoachId}
              onChange={(e) => setAssignedCoachId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold bg-white"
            >
              <option value="">Non assigné</option>
              {staffUsers
                .filter((c) => c.coachActive !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} ({c.role === 'admin' ? 'Admin' : 'Coach'})
                  </option>
                ))}
            </select>
          ) : (
            <div className="w-full rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#0F172A]">
              {assignedCoachName}
            </div>
          )}
        </div>
      </div>

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
        disabled={saving}
        className="px-4 py-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  );
}

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
    assignAthleteToCoach,
    ensureDirectRoomWith,
  } = usePlatform();

  const athleteUser = store.users.find((u) => u.id === id);
  const profile = store.athleteProfiles.find((p) => p.userId === id);
  const staffUsers = store.users.filter((u) => u.role === 'coach' || u.role === 'admin');

  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  if (!access.isAdmin && profile?.assignedCoachId !== currentUser.id) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg border border-slate-300 border-l-2 border-l-red-600 p-8 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
            <ShieldAlert size={18} />
            <span>Dossier suivi par un autre coach</span>
          </div>
          <p className="text-sm text-slate-600">
            Cet athlète n&apos;est pas assigné à votre portefeuille. Demandez à l&apos;administrateur principal de modifier la répartition depuis Équipe &amp; Intervals.
          </p>
          <Link
            href="/coach"
            className="inline-block text-xs font-semibold text-[#FF5A36] underline"
          >
            &larr; Retour au Cockpit Coach
          </Link>
        </div>
      </div>
    );
  }

  const snapshots = store.intervalsSnapshots
    .filter((s) => s.userId === id)
    .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));

  const checkIns = store.checkIns
    .filter((c) => c.userId === id)
    .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));

  const handleSync = async () => {
    setErrorMsg(null);
    setSavedMsg(null);
    setSyncing(true);
    try {
      await syncAthleteIntervals(id);
      setSavedMsg('Snapshot Intervals.icu synchronisé via la clé Coach.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur synchronisation Intervals.icu.');
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
            {athleteUser.email} · Intervals {profile?.intervalsAthleteId || 'non lié'} · ITRA{' '}
            {profile?.trailIndex ?? '-'} · VMA {profile?.vmaKmh ?? '-'} km/h · FC Repos{' '}
            {profile?.restingHr ?? '-'} bpm
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
      {errorMsg && (
        <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AthleteCoachForm
          key={`${id}-${profile?.updatedAt || 'init'}`}
          athleteId={id}
          profile={profile}
          isAdmin={access.isAdmin}
          staffUsers={staffUsers}
          onSaveProfile={(patch) => updateAthleteProfileCoach(id, patch)}
          onAssignCoach={(coachId) => assignAthleteToCoach(id, coachId)}
          onSaved={(msg) => {
            setErrorMsg(null);
            setSavedMsg(msg);
            setTimeout(() => setSavedMsg(null), 3500);
          }}
          onError={(msg) => setErrorMsg(msg)}
        />

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
