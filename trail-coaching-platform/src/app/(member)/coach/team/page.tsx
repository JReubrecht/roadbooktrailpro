'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { IntervalsCoachedAthlete, UserRole } from '@/types/domain';

export default function CoachTeamAndIntervalsPage() {
  const {
    currentUser,
    access,
    store,
    connectIntervalsAccount,
    disconnectIntervalsAccount,
    fetchCoachIntervalsRoster,
    syncAthleteIntervals,
    updateAthleteProfileCoach,
    createCoachMember,
    updateCoachMember,
    removeCoachRole,
    assignAthleteToCoach,
  } = usePlatform();

  const existingCoachConn = useMemo(() => {
    if (!currentUser) return null;
    return (
      store.intervalsConnections.find(
        (c) =>
          c.userId === currentUser.id &&
          (c.connectionScope === 'coach' || access.canAccessCoachDashboard)
      ) || null
    );
  }, [store.intervalsConnections, currentUser, access.canAccessCoachDashboard]);

  const [coachIntervalsId, setCoachIntervalsId] = useState('0');
  const [coachApiKey, setCoachApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSource, setRosterSource] = useState<'live' | 'sandbox' | null>(null);
  const [roster, setRoster] = useState<IntervalsCoachedAthlete[]>([]);
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({});
  const [athleteIdDrafts, setAthleteIdDrafts] = useState<Record<string, string>>({});

  // Formulaire ajout coach (Admin uniquement)
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'coach' | 'admin'>('coach');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [newBio, setNewBio] = useState('');
  const [creatingCoach, setCreatingCoach] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!currentUser || !access.canAccessCoachDashboard) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg border border-slate-300 border-l-2 border-l-red-600 p-8 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
            <ShieldAlert size={18} />
            <span>Accès réservé aux Coachs &amp; Administrateurs</span>
          </div>
          <p className="text-sm text-slate-600">
            Connectez-vous avec un compte coach ou administrateur autorisé pour gérer votre clé Intervals.icu et votre équipe.
          </p>
        </div>
      </div>
    );
  }

  const staffUsers = store.users.filter((u) => u.role === 'coach' || u.role === 'admin');
  const athletes = store.users.filter((u) => u.role === 'athlete');

  const handleConnectCoachKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusBanner(null);
    setConnecting(true);
    try {
      const res = await connectIntervalsAccount({
        userId: currentUser.id,
        intervalsAthleteId: coachIntervalsId.trim() || '0',
        apiKey: coachApiKey,
        connectionScope: 'coach',
      });
      setCoachApiKey('');
      if (res.coachedAthletes && res.coachedAthletes.length > 0) {
        setRoster(res.coachedAthletes);
        setRosterSource('live');
      }
      setStatusBanner(
        `Clé API Coach enregistrée (${res.athleteName || currentUser.displayName}) — ${
          res.coachedAthletes?.length ?? 0
        } athlète(s) détecté(s) sur Intervals.icu.`
      );
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Erreur connexion clé Coach Intervals.icu.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleLoadRoster = async () => {
    setErrorBanner(null);
    setStatusBanner(null);
    setLoadingRoster(true);
    try {
      const result = await fetchCoachIntervalsRoster(currentUser.id);
      setRoster(result.athletes);
      setRosterSource(result.source);
      setStatusBanner(
        `${result.athletes.length} athlète(s) récupéré(s) depuis votre compte Intervals.icu (${
          result.source === 'sandbox' ? 'aperçu démo' : 'API live'
        }).`
      );
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Impossible de charger la liste Intervals.icu.'
      );
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleAssociateAndSync = async (
    intervalsItem: IntervalsCoachedAthlete,
    targetUserId: string
  ) => {
    if (!targetUserId) {
      setErrorBanner('Sélectionnez un athlète myKairn à associer.');
      return;
    }
    setErrorBanner(null);
    setStatusBanner(null);
    setBusyKey(`link-${intervalsItem.intervalsAthleteId}`);
    try {
      const existingProfile = store.athleteProfiles.find((p) => p.userId === targetUserId);
      if (access.isAdmin && !existingProfile?.assignedCoachId) {
        await assignAthleteToCoach(targetUserId, currentUser.id);
      }
      updateAthleteProfileCoach(targetUserId, {
        intervalsAthleteId: intervalsItem.intervalsAthleteId,
      });
      const snap = await syncAthleteIntervals(targetUserId);
      const targetUser = athletes.find((a) => a.id === targetUserId);
      setStatusBanner(
        `${targetUser?.displayName || targetUserId} associé à ${
          intervalsItem.intervalsAthleteId
        } et synchronisé (CTL ${snap.ctl ?? '-'} · TSB ${snap.tsb ?? '-'}).`
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Échec de l’association / synchro.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusBanner(null);
    setCreatingCoach(true);
    try {
      const created = await createCoachMember({
        email: newEmail.trim(),
        displayName: newName.trim(),
        role: newRole,
        coachSpecialty: newSpecialty.trim() || undefined,
        coachBio: newBio.trim() || undefined,
      });
      setNewEmail('');
      setNewName('');
      setNewSpecialty('');
      setNewBio('');
      setNewRole('coach');
      setStatusBanner(
        `${created.displayName} ajouté à l’équipe (${created.role.toUpperCase()}).`
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Impossible d’ajouter ce coach.');
    } finally {
      setCreatingCoach(false);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setErrorBanner(null);
    setStatusBanner(null);
    setBusyKey(`role-${userId}`);
    try {
      await updateCoachMember(userId, { role });
      setStatusBanner(`Rôle mis à jour (${role.toUpperCase()}).`);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleActive = async (userId: string, nextActive: boolean) => {
    setErrorBanner(null);
    setStatusBanner(null);
    setBusyKey(`active-${userId}`);
    try {
      await updateCoachMember(userId, { coachActive: nextActive });
      setStatusBanner(nextActive ? 'Coach réactivé.' : 'Coach marqué inactif.');
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveCoach = async (userId: string) => {
    setErrorBanner(null);
    setStatusBanner(null);
    setBusyKey(`remove-${userId}`);
    try {
      await removeCoachRole(userId);
      setConfirmRemoveId(null);
      setStatusBanner('Accès coach retiré et athlètes désassignés.');
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <Link
            href="/coach"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F172A] mb-2"
          >
            <ArrowLeft size={13} />
            <span>Retour au Cockpit Coach</span>
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FF5A36] font-semibold">
            MULTI-COACHS &amp; HUB INTERVALS.ICU
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] mt-1">
            Équipe Coachs &amp; Synchronisation Centralisée
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Une seule clé API par coach permet d’importer et de synchroniser directement l’ensemble de ses athlètes Intervals.icu, sans aucune manipulation technique côté athlète.
          </p>
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

      {/* 1. Hub Intervals.icu du Coach connecté */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-[#FF5A36]" />
              <h2 className="text-lg font-bold text-[#0F172A]">
                Ma Clé API Coach Intervals.icu
              </h2>
              <span
                className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                  existingCoachConn?.hasSecret
                    ? 'bg-emerald-50 text-[#047857] border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {existingCoachConn?.hasSecret ? 'CLÉ COACH ACTIVE' : 'NON CONNECTÉE'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Compte connecté : <strong>{currentUser.displayName}</strong> — chiffrement AES-256-GCM côté serveur. Les athlètes qui vous sont assignés n’ont pas besoin de saisir de clé API.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadRoster}
              disabled={loadingRoster}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loadingRoster ? 'animate-spin' : ''} />
              <span>
                {loadingRoster
                  ? 'Importation...'
                  : 'Charger mes athlètes Intervals.icu'}
              </span>
            </button>
            {existingCoachConn && (
              <button
                type="button"
                onClick={() => {
                  disconnectIntervalsAccount(currentUser.id);
                  setRoster([]);
                  setStatusBanner('Clé API Coach révoquée.');
                }}
                className="px-3 py-2 rounded-md border border-slate-300 hover:border-red-500 text-red-700 text-xs font-semibold cursor-pointer"
              >
                Révoquer la clé
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleConnectCoachKey} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              ID Coach Intervals.icu (0 par défaut)
            </label>
            <input
              type="text"
              value={coachIntervalsId}
              onChange={(e) => setCoachIntervalsId(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
              Clé API Coach (intervals.icu/settings)
            </label>
            <input
              type="password"
              required
              value={coachApiKey}
              onChange={(e) => setCoachApiKey(e.target.value)}
              placeholder={
                existingCoachConn?.hasSecret
                  ? '•••••••• (saisir pour remplacer)'
                  : 'Developer Settings API Key'
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={connecting}
              className="w-full py-2 px-4 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {connecting ? 'Vérification...' : 'Enregistrer & chiffrer la clé Coach'}
            </button>
          </div>
        </form>

        {roster.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Athlètes détectés sur votre compte Intervals.icu ({roster.length})
              </p>
              {rosterSource && (
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {rosterSource === 'sandbox' ? 'APERÇU SANDBOX' : 'SOURCE LIVE INTERVALS'}
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5">Athlète Intervals</th>
                    <th className="px-4 py-2.5">ID</th>
                    <th className="px-4 py-2.5 text-right">CTL / ATL</th>
                    <th className="px-4 py-2.5">Profil myKairn associé</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.map((item) => {
                    const matchedProfile = store.athleteProfiles.find(
                      (p) =>
                        p.intervalsAthleteId?.toLowerCase() ===
                        item.intervalsAthleteId.toLowerCase()
                    );
                    const matchedUser = matchedProfile
                      ? athletes.find((a) => a.id === matchedProfile.userId)
                      : undefined;
                    const selectedUid =
                      linkTargets[item.intervalsAthleteId] ??
                      matchedUser?.id ??
                      athletes[0]?.id ??
                      '';
                    const isBusy = busyKey === `link-${item.intervalsAthleteId}`;

                    return (
                      <tr key={item.intervalsAthleteId} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#0F172A]">{item.name}</div>
                          {item.email && (
                            <div className="text-[11px] text-slate-500">{item.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#0F172A] tabular-nums">
                          {item.intervalsAthleteId}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                          {item.ctl ?? '-'} / {item.atl ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={selectedUid}
                            onChange={(e) =>
                              setLinkTargets((prev) => ({
                                ...prev,
                                [item.intervalsAthleteId]: e.target.value,
                              }))
                            }
                            className="rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-medium"
                          >
                            {athletes.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.displayName} ({a.email})
                              </option>
                            ))}
                          </select>
                          {matchedUser && (
                            <p className="font-mono text-[10px] text-[#047857] mt-1">
                              Déjà lié à {matchedUser.displayName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={isBusy || !selectedUid}
                            onClick={() => handleAssociateAndSync(item, selectedUid)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#0F172A] hover:bg-[#14C38E] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 size={12} />
                            <span>
                              {isBusy ? 'Synchro...' : 'Associer & Synchroniser'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 2. Annuaire & Gestion de l'équipe Coachs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#0F172A]" />
              <h2 className="text-base font-bold text-[#0F172A]">
                Équipe d’Encadrement ({staffUsers.length})
              </h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {access.isAdmin ? 'DROITS ADMIN COMPLETS' : 'LECTURE ÉQUIPE'}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {staffUsers.map((coach) => {
              const coachConn = store.intervalsConnections.find(
                (c) => c.userId === coach.id
              );
              const assignedCount = store.athleteProfiles.filter(
                (p) => p.assignedCoachId === coach.id
              ).length;
              const isSelf = coach.id === currentUser.id;
              const activeFlag = coach.coachActive !== false;

              return (
                <div
                  key={coach.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">
                        {coach.displayName}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded font-semibold ${
                          coach.role === 'admin'
                            ? 'bg-[#0F172A] text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {coach.role === 'admin' ? 'ADMIN' : 'COACH'}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded font-semibold ${
                          coachConn?.hasSecret
                            ? 'bg-emerald-50 text-[#047857] border border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {coachConn?.hasSecret ? 'CLÉ INTERVALS OK' : 'SANS CLÉ INTERVALS'}
                      </span>
                      {!activeFlag && (
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                          INACTIF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {(access.isAdmin || isSelf) && coach.email ? `${coach.email} · ` : ''}
                      {coach.coachSpecialty || 'Coach Trail'} ·{' '}
                      <strong className="font-mono text-[#0F172A]">
                        {assignedCount}
                      </strong>{' '}
                      athlète(s) suivi(s)
                    </p>
                    {coach.coachBio && (
                      <p className="text-xs text-slate-600">{coach.coachBio}</p>
                    )}
                  </div>

                  {access.isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyKey === `role-${coach.id}`}
                        onClick={() =>
                          handleRoleChange(
                            coach.id,
                            coach.role === 'admin' ? 'coach' : 'admin'
                          )
                        }
                        className="px-2.5 py-1.5 rounded border border-slate-300 hover:border-[#0F172A] text-[11px] font-semibold text-[#0F172A] cursor-pointer"
                      >
                        {coach.role === 'admin' ? 'Passer Coach' : 'Passer Admin'}
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `active-${coach.id}`}
                        onClick={() => handleToggleActive(coach.id, !activeFlag)}
                        className="px-2.5 py-1.5 rounded border border-slate-300 hover:border-[#0F172A] text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        {activeFlag ? 'Désactiver' : 'Réactiver'}
                      </button>
                      {!isSelf &&
                        (confirmRemoveId === coach.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyKey === `remove-${coach.id}`}
                              onClick={() => handleRemoveCoach(coach.id)}
                              className="px-2.5 py-1.5 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Confirmer retrait
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-2 py-1.5 rounded border border-slate-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(coach.id)}
                            className="px-2.5 py-1.5 rounded border border-slate-300 hover:border-red-500 text-red-700 text-[11px] font-semibold cursor-pointer"
                          >
                            Retirer
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Formulaire Ajout Coach (Admin uniquement) */}
        <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus size={16} className="text-[#FF5A36]" />
            <h2 className="text-base font-bold text-[#0F172A]">
              Ajouter / Promouvoir un Coach
            </h2>
          </div>

          {!access.isAdmin ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              Seul l’administrateur principal peut créer de nouveaux comptes coachs, attribuer le rôle Admin ou répartir les athlètes entre coachs.
            </p>
          ) : (
            <form onSubmit={handleCreateCoach} className="space-y-3 text-xs">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Marc Alpin"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                  Email professionnel
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="coach@mykairn.fr"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                    Rôle
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'coach' | 'admin')}
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2 bg-white font-semibold"
                  >
                    <option value="coach">Coach Équipe</option>
                    <option value="admin">Admin Principal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                    Spécialité
                  </label>
                  <input
                    type="text"
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="Ultra / Skyrunning"
                    className="w-full rounded-md border border-slate-300 px-2.5 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                  Bio courte
                </label>
                <textarea
                  rows={2}
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Présentation rapide visible par les athlètes..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={creatingCoach}
                className="w-full py-2.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold cursor-pointer disabled:opacity-50 transition-colors"
              >
                {creatingCoach ? 'Création...' : 'Ajouter ce coach'}
              </button>
            </form>
          )}
        </section>
      </div>

      {/* 3. Répartition des Athlètes & Liaison Intervals (Admin uniquement) */}
      {access.isAdmin && (
        <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-[#14C38E]" />
              <h2 className="text-base font-bold text-[#0F172A]">
                Répartition des Athlètes &amp; Identifiants Intervals.icu ({athletes.length})
              </h2>
            </div>
            <span className="font-mono text-[10px] uppercase text-slate-400">
              PILOTAGE ADMIN
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Athlète</th>
                  <th className="px-4 py-2.5">Coach Référent</th>
                  <th className="px-4 py-2.5">ID Intervals.icu</th>
                  <th className="px-4 py-2.5 text-right">Synchro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {athletes.map((ath) => {
                  const profile = store.athleteProfiles.find((p) => p.userId === ath.id);
                  const draftId =
                    athleteIdDrafts[ath.id] ?? profile?.intervalsAthleteId ?? '';
                  const isSyncing = busyKey === `sync-${ath.id}`;

                  return (
                    <tr key={ath.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#0F172A]">{ath.displayName}</div>
                        <div className="text-[11px] text-slate-500">
                          {profile?.showcaseGoalRace || ath.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={profile?.assignedCoachId || ''}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            try {
                              await assignAthleteToCoach(ath.id, val);
                              setStatusBanner(
                                `Coach référent mis à jour pour ${ath.displayName}.`
                              );
                            } catch (err: unknown) {
                              setErrorBanner(
                                err instanceof Error
                                  ? err.message
                                  : 'Attribution impossible.'
                              );
                            }
                          }}
                          className="rounded border border-slate-300 px-2.5 py-1.5 text-xs bg-white font-semibold"
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
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={draftId}
                            onChange={(e) =>
                              setAthleteIdDrafts((prev) => ({
                                ...prev,
                                [ath.id]: e.target.value,
                              }))
                            }
                            placeholder="ex: i412890"
                            className="w-28 rounded border border-slate-300 px-2.5 py-1 font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateAthleteProfileCoach(ath.id, {
                                intervalsAthleteId: draftId.trim() || undefined,
                              });
                              setStatusBanner(
                                `ID Intervals.icu enregistré pour ${ath.displayName}.`
                              );
                            }}
                            className="px-2.5 py-1 rounded border border-slate-300 hover:border-[#0F172A] text-[11px] font-semibold cursor-pointer"
                          >
                            Valider
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isSyncing}
                          onClick={async () => {
                            setErrorBanner(null);
                            setBusyKey(`sync-${ath.id}`);
                            try {
                              const snap = await syncAthleteIntervals(ath.id);
                              setStatusBanner(
                                `Sync ${ath.displayName} OK — CTL ${snap.ctl ?? '-'} · TSB ${
                                  snap.tsb ?? '-'
                                }.`
                              );
                            } catch (err: unknown) {
                              setErrorBanner(
                                err instanceof Error ? err.message : 'Erreur synchro.'
                              );
                            } finally {
                              setBusyKey(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                          <span>Sync</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
