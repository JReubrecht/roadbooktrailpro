'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BrandLogo from '@/components/brand/BrandLogo';
import { usePlatform } from '@/context/PlatformContext';

export default function LoginPage() {
  const router = useRouter();
  const { store, isFirebaseLive, signInWithEmail, signUpWithEmail, signInWithGoogle, switchPersona } =
    usePlatform();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        const matched = store.users.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase()
        );
        const isCoach = matched?.role === 'coach' || matched?.role === 'admin';
        router.push(isCoach ? '/coach' : '/athlete');
      } else {
        await signUpWithEmail(email, password, displayName || email.split('@')[0], {
          rgpd: rgpdConsent,
          marketing: marketingOptIn,
        });
        router.push('/athlete');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec de l’authentification.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push('/athlete');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In indisponible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white rounded-lg border border-slate-200 p-8 space-y-6">
        <div className="space-y-2">
          <BrandLogo size="sm" />
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] pt-2">
            {mode === 'login' ? 'Accès Espace Membre & Abonné' : 'Créer un compte'}
          </h1>
          <p className="font-mono text-[11px] text-slate-500">
            {isFirebaseLive
              ? 'MODE PRODUCTION · FIREBASE AUTH'
              : 'MODE SANDBOX LOCALE · PREVIEW PILOTE'}
          </p>
        </div>

        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`pb-2.5 px-1 mr-6 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              mode === 'login'
                ? 'border-[#FF5A36] text-[#0F172A]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`pb-2.5 px-1 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
              mode === 'signup'
                ? 'border-[#FF5A36] text-[#0F172A]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            Création de compte
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border-l-2 border-red-600 text-xs font-semibold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom &amp; Nom
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Julie Martin"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="athlete@exemple.fr"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          {mode === 'signup' && (
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rgpdConsent}
                  onChange={(e) => setRgpdConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 accent-[#FF5A36]"
                />
                <span>
                  J&apos;accepte les{' '}
                  <Link href="/legal/cgv-cgu" className="text-[#0F172A] underline font-semibold">
                    CGU
                  </Link>{' '}
                  et la{' '}
                  <Link
                    href="/legal/confidentialite"
                    className="text-[#0F172A] underline font-semibold"
                  >
                    Politique RGPD
                  </Link>
                  . *
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#FF5A36]"
                />
                <span>Recevoir les actualités saisonnières trail.</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-md bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold text-sm disabled:opacity-50 cursor-pointer transition-colors"
          >
            {loading
              ? 'Authentification...'
              : mode === 'login'
              ? 'Entrer dans mon espace'
              : 'Créer mon compte'}
          </button>
        </form>

        {isFirebaseLive && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 rounded-md border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Continuer avec Google
          </button>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Accès rapide environnement pilote
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                switchPersona('coach-admin-1');
                router.push('/coach');
              }}
              className="py-2 px-3 rounded-md border border-slate-300 hover:border-[#0F172A] text-[#0F172A] text-xs font-semibold cursor-pointer"
            >
              Cockpit Coach
            </button>
            <button
              type="button"
              onClick={() => {
                switchPersona('pilot-claire');
                router.push('/athlete');
              }}
              className="py-2 px-3 rounded-md border border-slate-300 hover:border-[#14C38E] text-[#0F172A] text-xs font-semibold cursor-pointer"
            >
              Pilote (Claire)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
