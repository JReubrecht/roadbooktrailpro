'use client';

import React, { useState } from 'react';
import { Download, Lock, Trash2 } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

export default function AthleteSettingsPage() {
  const {
    currentUser,
    currentProfile,
    store,
    connectIntervalsAccount,
    disconnectIntervalsAccount,
    updateAthleteProfileCoach,
    exportUserDataRgpd,
    deleteAccountDataRgpd,
  } = usePlatform();

  const assignedCoach = currentProfile?.assignedCoachId
    ? store.users.find((u) => u.id === currentProfile.assignedCoachId) || null
    : null;
  const coachConn = assignedCoach
    ? store.intervalsConnections.find((c) => c.userId === assignedCoach.id) || null
    : null;
  const existingConn = currentUser
    ? store.intervalsConnections.find(
        (c) => c.userId === currentUser.id && c.connectionScope !== 'coach'
      )
    : undefined;

  const [intervalsAthleteId, setIntervalsAthleteId] = useState(
    currentProfile?.intervalsAthleteId || existingConn?.intervalsAthleteId || '0'
  );
  const [apiKey, setApiKey] = useState('');
  const [healthConsent, setHealthConsent] = useState(
    Boolean(currentUser?.consents?.healthDataConsentAt)
  );
  const [connecting, setConnecting] = useState(false);
  const [connMsg, setConnMsg] = useState<string | null>(null);
  const [connErr, setConnErr] = useState<string | null>(null);

  const [trailIndex, setTrailIndex] = useState(String(currentProfile?.trailIndex || 580));
  const [weightKg, setWeightKg] = useState(String(currentProfile?.weightKg || 68));
  const [vmaKmh, setVmaKmh] = useState(String(currentProfile?.vmaKmh || 15.5));
  const [restingHr, setRestingHr] = useState(String(currentProfile?.restingHr || 50));
  const [profileSaved, setProfileSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!currentUser) return null;

  const handleSavePhysio = (e: React.FormEvent) => {
    e.preventDefault();
    updateAthleteProfileCoach(currentUser.id, {
      trailIndex: Number(trailIndex) || undefined,
      weightKg: Number(weightKg) || undefined,
      vmaKmh: Number(vmaKmh) || undefined,
      restingHr: Number(restingHr) || undefined,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleConnectIntervals = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnErr(null);
    setConnMsg(null);
    if (!healthConsent) {
      setConnErr(
        'Le consentement explicite au traitement des données physiologiques (RGPD Art. 9) est requis.'
      );
      return;
    }

    setConnecting(true);
    try {
      const res = await connectIntervalsAccount({
        userId: currentUser.id,
        intervalsAthleteId,
        apiKey,
        healthDataConsent: true,
      });
      setApiKey('');
      setConnMsg(
        `Connexion établie pour ${res.athleteName || intervalsAthleteId} et chiffrée côté serveur (AES-256-GCM).`
      );
    } catch (err: unknown) {
      setConnErr(err instanceof Error ? err.message : 'Erreur connexion Intervals.icu.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* 1. Paramètres Physiologiques */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h1 className="text-lg font-bold text-[#0F172A] border-b border-slate-100 pb-3">
          Profil Physiologique Trail
        </h1>

        <form onSubmit={handleSavePhysio} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Index ITRA</label>
            <input
              type="number"
              value={trailIndex}
              onChange={(e) => setTrailIndex(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">Poids (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">VMA (km/h)</label>
            <input
              type="number"
              step="0.1"
              value={vmaKmh}
              onChange={(e) => setVmaKmh(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">FC Repos (bpm)</label>
            <input
              type="number"
              value={restingHr}
              onChange={(e) => setRestingHr(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono font-semibold"
            />
          </div>
          <div className="col-span-2 sm:col-span-4 flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
            >
              Enregistrer
            </button>
            {profileSaved && <span className="text-xs font-semibold text-[#14C38E]">Enregistré</span>}
          </div>
        </form>
      </section>

      {/* 2. Liaison Serveur Intervals.icu */}
      <section className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              {assignedCoach
                ? `Télémétrie gérée par votre coach (${assignedCoach.displayName})`
                : 'Liaison Intervals.icu (Serveur)'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {assignedCoach
                ? 'Votre coach accède directement à vos métriques depuis son compte Coach Intervals.icu : vous n’avez aucune clé API à saisir.'
                : 'Chiffrement AES-256-GCM côté serveur. Aucune clé API n’est conservée en clair côté navigateur.'}
            </p>
          </div>
          {(coachConn?.hasSecret || existingConn?.hasSecret) && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#14C38E] shrink-0">
              <Lock size={12} />{' '}
              {assignedCoach && coachConn?.hasSecret
                ? 'CLÉ COACH ACTIVE'
                : 'AES-256-GCM ACTIF'}
            </span>
          )}
        </div>

        {assignedCoach && (
          <div className="rounded-md bg-[#F8FAFC] border border-slate-200 border-l-2 border-l-[#14C38E] p-4 space-y-1.5 text-xs">
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px]">
              <span className="text-slate-500 uppercase">Coach référent</span>
              <span className="font-bold text-[#0F172A]">{assignedCoach.displayName}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px]">
              <span className="text-slate-500 uppercase">ID Intervals.icu associé</span>
              <span className="font-bold text-[#0F172A]">
                {currentProfile?.intervalsAthleteId || 'En attente d’association par le coach'}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px]">
              <span className="text-slate-500 uppercase">Statut liaison coach</span>
              <span
                className={
                  coachConn?.hasSecret
                    ? 'font-bold text-[#047857]'
                    : 'font-bold text-amber-700'
                }
              >
                {coachConn?.hasSecret
                  ? 'ACTIVE — aucune clé requise côté athlète'
                  : 'EN ATTENTE DE CLÉ COACH'}
              </span>
            </div>
          </div>
        )}

        {connErr && (
          <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
            {connErr}
          </div>
        )}
        {connMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border-l-2 border-[#14C38E] text-xs font-semibold text-[#047857]">
            {connMsg}
          </div>
        )}

        {assignedCoach ? (
          <details className="pt-1">
            <summary className="text-xs font-semibold text-slate-500 hover:text-[#0F172A] cursor-pointer select-none">
              Connexion personnelle avancée (optionnel — uniquement sans gestion coach)
            </summary>
            <form onSubmit={handleConnectIntervals} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                    ID Athlète Intervals.icu (ex: i123456 ou 0)
                  </label>
                  <input
                    type="text"
                    required
                    value={intervalsAthleteId}
                    onChange={(e) => setIntervalsAthleteId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                    API Key personnelle
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      existingConn?.hasSecret
                        ? '•••••••• (saisir pour remplacer)'
                        : 'API Key Developer Settings'
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-md bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={healthConsent}
                  onChange={(e) => setHealthConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#14C38E]"
                />
                <span>
                  <strong>Consentement RGPD Art. 9 :</strong> J&apos;autorise le traitement de mes données physiologiques Intervals.icu (CTL, ATL, FC, HRV, volume) dans le strict cadre de mon suivi trail.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold text-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {connecting ? 'Vérification...' : 'Connecter & chiffrer'}
                </button>

                {existingConn && (
                  <button
                    type="button"
                    onClick={() => disconnectIntervalsAccount(currentUser.id)}
                    className="px-3.5 py-2 rounded-md border border-slate-300 hover:border-red-500 text-red-700 text-xs font-semibold cursor-pointer"
                  >
                    Révoquer ma clé personnelle
                  </button>
                )}
              </div>
            </form>
          </details>
        ) : (
          <form onSubmit={handleConnectIntervals} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                  ID Athlète Intervals.icu (ex: i123456 ou 0)
                </label>
                <input
                  type="text"
                  required
                  value={intervalsAthleteId}
                  onChange={(e) => setIntervalsAthleteId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase text-slate-500 mb-1">
                  API Key personnelle
                </label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={existingConn?.hasSecret ? '•••••••• (saisir pour remplacer)' : 'API Key Developer Settings'}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-md bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={healthConsent}
                onChange={(e) => setHealthConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#14C38E]"
              />
              <span>
                <strong>Consentement RGPD Art. 9 :</strong> J&apos;autorise le traitement de mes données physiologiques Intervals.icu (CTL, ATL, FC, HRV, volume) dans le strict cadre de mon suivi trail.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={connecting}
                className="px-4 py-2 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold text-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {connecting ? 'Vérification...' : 'Connecter & chiffrer'}
              </button>

              {existingConn && (
                <button
                  type="button"
                  onClick={() => disconnectIntervalsAccount(currentUser.id)}
                  className="px-3.5 py-2 rounded-md border border-slate-300 hover:border-red-500 text-red-700 text-xs font-semibold cursor-pointer"
                >
                  Révoquer la connexion
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* 3. Centre RGPD */}
      <section id="rgpd-center" className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-[#0F172A]">Confidentialité &amp; Droits RGPD</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Portabilité de vos données (Article 20) et droit à l&apos;effacement (Article 17).
          </p>
        </div>

        <div className="rounded-md bg-[#F8FAFC] border border-slate-200 p-4 font-mono text-[11px] text-slate-600 space-y-1">
          <p>COMPTE : {currentUser.email}</p>
          <p>CONSENTEMENT RGPD : {currentUser.consents?.privacyAcceptedAt || 'HORODATÉ'}</p>
          <p>
            CONSENTEMENT PHYSIO ART.9 :{' '}
            {currentUser.consents?.healthDataConsentAt || 'NON ACCORDÉ'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportUserDataRgpd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
          >
            <Download size={14} />
            <span>Exporter mes données (JSON)</span>
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 text-red-700 hover:border-red-500 text-xs font-semibold cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Supprimer mon compte</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={deleteAccountDataRgpd}
                className="px-4 py-2 rounded-md bg-red-600 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmer l&apos;effacement
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 rounded-md border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
