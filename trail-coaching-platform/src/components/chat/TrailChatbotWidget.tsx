'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Bot, MessageSquare, RotateCcw, Send, X } from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';

interface ChatbotMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedLinks?: Array<{ label: string; href: string }>;
}

const PUBLIC_PROMPTS = [
  'Estimer 50 km / 3000 m D+',
  'Repères nutrition glucides & sel',
  'Quelles montres sont compatibles ?',
  'Coaching 1-to-1 ou Pack Jour J ?',
];

const MEMBER_PROMPTS = [
  'Analyser ma charge CTL / TSB actuelle',
  'Estimer 70 km / 4200 m D+',
  'Poser un ravito sur ma carte GPX',
  'Comment écrire au coach / groupes ?',
];

export default function TrailChatbotWidget() {
  const { currentUser, store, featureFlags, isReady } = usePlatform();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionSeq, setSessionSeq] = useState(0);
  const [messages, setMessages] = useState<ChatbotMsg[]>([]);

  const endRef = useRef<HTMLDivElement | null>(null);

  const athleteSummary = useMemo(() => {
    if (!currentUser) return undefined;
    const latestSnap = store.intervalsSnapshots
      .filter((s) => s.userId === currentUser.id)
      .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];
    const latestCheckIn = store.checkIns
      .filter((c) => c.userId === currentUser.id)
      .sort((a, b) => b.checkInDate.localeCompare(a.checkInDate))[0];

    return {
      displayName: currentUser.displayName,
      ctl: latestSnap?.ctl,
      atl: latestSnap?.atl,
      tsb: latestSnap?.tsb,
      weeklyDistanceKm: latestSnap?.weeklyDistanceKm,
      weeklyElevationM: latestSnap?.weeklyElevationM,
      hasPainAlert: Boolean(latestCheckIn?.painFlag),
    };
  }, [currentUser, store.intervalsSnapshots, store.checkIns]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  if (!isReady) return null;

  const quickPrompts = currentUser ? MEMBER_PROMPTS : PUBLIC_PROMPTS;

  const sendQuestion = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    const userMsg: ChatbotMsg = {
      id: `cb-${sessionSeq}-u-${messages.length}`,
      role: 'user',
      content: clean,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: nextHistory.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          contextMode: currentUser ? 'member' : 'public',
          programSalesEnabled: featureFlags.programSalesEnabled,
          athleteSummary,
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `cb-${sessionSeq}-a-${prev.length}`,
          role: 'assistant',
          content: res.ok
            ? data.reply
            : data.error || "Impossible d'obtenir une réponse pour le moment.",
          suggestedLinks: res.ok ? data.suggestedLinks : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `cb-${sessionSeq}-err-${prev.length}`,
          role: 'assistant',
          content:
            'Connexion momentanément indisponible. Vous pouvez accéder directement aux outils ou au formulaire de contact.',
          suggestedLinks: [{ label: 'Outils GPX gratuits', href: '/tools' }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 no-print font-sans flex flex-col items-end">
      {open && (
        <div className="mb-2.5 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[80vh] bg-white border border-slate-300 rounded-lg shadow-xl flex flex-col overflow-hidden">
          {/* En-tête */}
          <div className="px-4 py-3 bg-[#0F172A] text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-[#FF5A36]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Assistant Trail myKairn</p>
                <p className="font-mono text-[10px] text-[#14C38E] flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#14C38E]" />
                  <span>ASSISTANT TRAIL · EN LIGNE</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setSessionSeq((prev) => prev + 1);
                  }}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Réinitialiser la conversation"
                  aria-label="Réinitialiser"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Fermer"
                aria-label="Fermer l'assistant"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Zone de messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                {currentUser
                  ? `Bonjour ${currentUser.displayName}. Posez une question sur un chrono km-effort, la nutrition, vos métriques ou la messagerie coach.`
                  : 'Bonjour. Je peux estimer un chrono trail, détailler nos repères nutrition, vérifier la compatibilité de votre montre ou présenter nos formules.'}
              </p>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendQuestion(prompt)}
                      className="text-left px-2.5 py-1.5 rounded border border-slate-200 bg-[#F8FAFC] hover:border-[#FF5A36] hover:text-[#0F172A] text-[11px] font-semibold text-slate-700 cursor-pointer transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#0F172A] text-white font-medium'
                      : 'bg-white border border-slate-200 text-[#0F172A]'
                  }`}
                >
                  {msg.content}

                  {msg.suggestedLinks && msg.suggestedLinks.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {msg.suggestedLinks.map((lnk) => (
                        <Link
                          key={`${msg.id}-${lnk.href}`}
                          href={lnk.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F8FAFC] border border-slate-300 hover:border-[#FF5A36] text-[11px] font-semibold text-[#0F172A] transition-colors"
                        >
                          <span>{lnk.label}</span>
                          <ArrowUpRight size={11} className="text-[#FF5A36]" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-500">
                ANALYSE EN COURS...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion(input);
            }}
            className="p-3 border-t border-slate-200 bg-white space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: 55 km 3200 d+ ou tarifs..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#0F172A]"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white disabled:opacity-50 cursor-pointer transition-colors shrink-0"
                aria-label="Envoyer la question"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="font-mono text-[10px] text-slate-400 text-center">
              Outil informatif · Ne remplace pas un avis médical.
            </p>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold shadow-md cursor-pointer transition-colors"
        aria-label="Ouvrir l'Assistant Trail"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-[#14C38E]" />
        <MessageSquare size={14} className="text-[#FF5A36]" />
        <span>Assistant Trail</span>
      </button>
    </div>
  );
}
