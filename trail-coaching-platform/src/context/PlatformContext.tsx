'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '@/lib/firebase/client';
import { createInitialDemoState, type PlatformStoreState } from '@/lib/seed/demoData';
import { evaluateAccess, type EvaluatedAccess } from '@/lib/access/entitlements';
import {
  BRAND_CONFIG,
  DEFAULT_FEATURE_FLAGS,
  type PlatformFeatureFlags,
  type PromoBannerConfig,
} from '@/config/brand';
import type {
  AthleteProfile,
  ChatMessage,
  ChatMessageAttachment,
  ChatRoom,
  ChatRoomType,
  CheckIn,
  CoachingInquiry,
  CommunityPost,
  Entitlement,
  GrantType,
  EntitlementSource,
  IntervalsConnectionPublic,
  IntervalsSnapshot,
  Order,
  RoadbookDoc,
  TierStatus,
  TrainingPlan,
  UserDoc,
} from '@/types/domain';

const STORAGE_KEY = 'mykairn_coach_platform_state_v1';
const PERSONA_KEY = 'mykairn_coach_active_persona_v1';
const BANNER_KEY = 'mykairn_coach_promo_banner_v1';
const FLAGS_KEY = 'mykairn_coach_feature_flags_v1';

export type DemoPersonaId =
  | 'visitor'
  | 'pilot-claire'
  | 'pilot-thomas'
  | 'athlete-free-demo'
  | 'coach-admin-1';

interface PlatformContextValue {
  isReady: boolean;
  isFirebaseLive: boolean;
  store: PlatformStoreState;
  activePersonaId: DemoPersonaId | string;
  currentUser: UserDoc | null;
  currentProfile: AthleteProfile | null;
  access: EvaluatedAccess;
  promoBanner: PromoBannerConfig;
  customLogoUrl: string | null;
  featureFlags: PlatformFeatureFlags;
  totalUnreadMessages: number;

  // Actions Auth / Persona
  switchPersona: (personaId: DemoPersonaId) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    consents: { rgpd: boolean; marketing: boolean }
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logoutUser: () => Promise<void>;
  resetDemoData: () => void;

  // Actions Charte, Bannière & Modules Admin
  updatePromoBanner: (banner: PromoBannerConfig) => void;
  setCustomLogoDataUrl: (dataUrl: string | null) => void;
  updateFeatureFlags: (patch: Partial<PlatformFeatureFlags>) => void;

  // Actions Métier Coach / Athlète
  connectIntervalsAccount: (params: {
    userId: string;
    intervalsAthleteId: string;
    apiKey: string;
    healthDataConsent: true;
  }) => Promise<{ snapshot: IntervalsSnapshot | null; athleteName: string }>;
  disconnectIntervalsAccount: (userId: string) => void;
  syncAthleteIntervals: (userId: string) => Promise<IntervalsSnapshot>;
  submitCheckIn: (payload: Omit<CheckIn, 'id' | 'createdAt'>) => Promise<CheckIn>;
  grantEntitlement: (params: {
    userId: string;
    grantType: GrantType;
    trainingPlanId?: string;
    source: EntitlementSource;
    durationDays?: number;
  }) => Promise<Entitlement>;
  revokeEntitlement: (entitlementId: string) => void;
  updateAthleteProfileCoach: (userId: string, patch: Partial<AthleteProfile>) => void;
  createOrUpdatePlan: (plan: TrainingPlan) => void;
  simulateOrderCheckout: (params: {
    orderType: Order['orderType'];
    trainingPlanId?: string;
    amountCents: number;
  }) => Promise<{ order: Order; entitlement: Entitlement | null }>;
  addCommunityPost: (post: Omit<CommunityPost, 'id' | 'likesCount' | 'createdAt'>) => void;
  likeCommunityPost: (postId: string) => void;
  saveRoadbook: (rb: RoadbookDoc) => void;
  submitCoachingInquiry: (
    payload: Omit<CoachingInquiry, 'id' | 'createdAt'>
  ) => Promise<CoachingInquiry>;

  // Messagerie Coach ↔ Athlètes & Groupes
  createChatRoom: (params: {
    type: ChatRoomType;
    name: string;
    description?: string;
    memberIds: string[];
    isCoachOnlyPost?: boolean;
  }) => Promise<ChatRoom>;
  ensureDirectRoomWith: (otherUserId: string) => Promise<ChatRoom>;
  sendChatMessage: (params: {
    roomId: string;
    content: string;
    attachment?: ChatMessageAttachment;
  }) => Promise<ChatMessage>;
  markChatRoomRead: (roomId: string) => void;
  updateChatRoom: (
    roomId: string,
    patch: {
      name?: string;
      description?: string;
      pinnedMessage?: string;
      memberIds?: string[];
    }
  ) => void;
  leaveOrDeleteChatRoom: (roomId: string) => void;

  exportUserDataRgpd: () => Promise<void>;
  deleteAccountDataRgpd: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue | undefined>(undefined);

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform doit être utilisé à l’intérieur de PlatformProvider.');
  }
  return ctx;
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<PlatformStoreState>(() => createInitialDemoState());
  const [activePersonaId, setActivePersonaId] = useState<string>('visitor');
  const [promoBanner, setPromoBanner] = useState<PromoBannerConfig>(BRAND_CONFIG.promoBanner);
  const [customLogoUrl, setCustomLogoUrlState] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<PlatformFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [isReady, setIsReady] = useState(false);

  // Hydratation locale asynchrone après montage (évite tout hydration mismatch SSR/client)
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const savedStore = window.localStorage.getItem(STORAGE_KEY);
        if (savedStore) {
          const parsed = JSON.parse(savedStore) as Partial<PlatformStoreState>;
          if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.trainingPlans)) {
            const fallback = createInitialDemoState();
            setStore({
              ...fallback,
              ...parsed,
              chatRooms: Array.isArray(parsed.chatRooms) ? parsed.chatRooms : fallback.chatRooms,
              chatMessages: Array.isArray(parsed.chatMessages)
                ? parsed.chatMessages
                : fallback.chatMessages,
            });
          }
        }
        const savedPersona = window.localStorage.getItem(PERSONA_KEY);
        if (savedPersona) {
          setActivePersonaId(savedPersona);
        }
        const savedBanner = window.localStorage.getItem(BANNER_KEY);
        if (savedBanner) {
          setPromoBanner(JSON.parse(savedBanner) as PromoBannerConfig);
        }
        const savedFlags = window.localStorage.getItem(FLAGS_KEY);
        if (savedFlags) {
          setFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, ...(JSON.parse(savedFlags) as Partial<PlatformFeatureFlags>) });
        }
        const savedLogo = window.localStorage.getItem('mykairn_custom_logo_dataurl');
        if (savedLogo) {
          setCustomLogoUrlState(savedLogo);
        }
      } catch {
        // ignore invalid storage
      }
      setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistance locale automatique
  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore quota error
    }
  }, [store, isReady]);

  // Synchronisation Firebase Auth si configuré dans .env.local
  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) return;
    const auth = firebaseAuth;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) return;

      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const isAdminEmail = fbUser.email ? adminEmails.includes(fbUser.email.toLowerCase()) : false;

      let resolvedUser: UserDoc = {
        id: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Athlète',
        role: isAdminEmail ? 'coach' : 'athlete',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (firestoreDb) {
        try {
          const userSnap = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as Partial<UserDoc>;
            resolvedUser = {
              ...resolvedUser,
              ...data,
              id: fbUser.uid,
              role: (data.role as UserDoc['role']) || resolvedUser.role,
            };
          } else {
            await setDoc(doc(firestoreDb, 'users', fbUser.uid), resolvedUser);
          }
        } catch (err) {
          console.warn('[Firebase Auth] Lecture profil users impossible:', err);
        }
      }

      setStore((prev) => {
        const exists = prev.users.some((u) => u.id === resolvedUser.id);
        const nextUsers = exists
          ? prev.users.map((u) => (u.id === resolvedUser.id ? resolvedUser : u))
          : [...prev.users, resolvedUser];

        const hasProfile = prev.athleteProfiles.some((p) => p.userId === resolvedUser.id);
        const nextProfiles = hasProfile
          ? prev.athleteProfiles
          : [
              ...prev.athleteProfiles,
              {
                userId: resolvedUser.id,
                tierStatus: (isAdminEmail ? 'coaching_paid' : 'free') as TierStatus,
                isShowcaseFeatured: false,
                updatedAt: new Date().toISOString(),
              },
            ];

        return { ...prev, users: nextUsers, athleteProfiles: nextProfiles };
      });
      setActivePersonaId(resolvedUser.id);
    });

    return () => unsub();
  }, []);

  const currentUser = useMemo<UserDoc | null>(() => {
    if (activePersonaId === 'visitor') return null;
    return store.users.find((u) => u.id === activePersonaId) || null;
  }, [store.users, activePersonaId]);

  const currentProfile = useMemo<AthleteProfile | null>(() => {
    if (!currentUser) return null;
    return store.athleteProfiles.find((p) => p.userId === currentUser.id) || null;
  }, [store.athleteProfiles, currentUser]);

  const access = useMemo(
    () => evaluateAccess(currentUser, currentProfile, store.entitlements),
    [currentUser, currentProfile, store.entitlements]
  );

  const switchPersona = (personaId: DemoPersonaId) => {
    setActivePersonaId(personaId);
    try {
      window.localStorage.setItem(PERSONA_KEY, personaId);
    } catch {
      // ignore
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (isFirebaseConfigured && firebaseAuth) {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      return;
    }
    // Mode local hors Firebase : retrouve ou crée l'utilisateur par email
    const existing = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      setActivePersonaId(existing.id);
      return;
    }
    throw new Error('Aucun compte trouvé avec cet email en mode démonstration. Créez un compte ci-dessous.');
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    consents: { rgpd: boolean; marketing: boolean }
  ) => {
    if (!consents.rgpd) {
      throw new Error('Le consentement à la politique de confidentialité RGPD est requis.');
    }
    const nowIso = new Date().toISOString();

    if (isFirebaseConfigured && firebaseAuth) {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const newUser: UserDoc = {
        id: cred.user.uid,
        email,
        displayName,
        role: 'athlete',
        consents: {
          termsAcceptedAt: nowIso,
          privacyAcceptedAt: nowIso,
          marketingOptIn: consents.marketing,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'users', cred.user.uid), newUser);
        await setDoc(doc(firestoreDb, 'athleteProfiles', cred.user.uid), {
          userId: cred.user.uid,
          tierStatus: 'free',
          isShowcaseFeatured: false,
          updatedAt: nowIso,
        });
      }
      return;
    }

    const uid = `user-${Date.now()}`;
    const newUser: UserDoc = {
      id: uid,
      email,
      displayName,
      role: 'athlete',
      consents: {
        termsAcceptedAt: nowIso,
        privacyAcceptedAt: nowIso,
        marketingOptIn: consents.marketing,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const newProfile: AthleteProfile = {
      userId: uid,
      tierStatus: 'free',
      isShowcaseFeatured: false,
      updatedAt: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      athleteProfiles: [...prev.athleteProfiles, newProfile],
    }));
    setActivePersonaId(uid);
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      throw new Error('Google Sign-In nécessite la configuration Firebase dans .env.local.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(firebaseAuth, provider);
  };

  const logoutUser = async () => {
    if (isFirebaseConfigured && firebaseAuth) {
      await signOut(firebaseAuth);
    }
    switchPersona('visitor');
  };

  const resetDemoData = () => {
    const fresh = createInitialDemoState();
    setStore(fresh);
    switchPersona('coach-admin-1');
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
  };

  const updatePromoBanner = (banner: PromoBannerConfig) => {
    setPromoBanner(banner);
    try {
      window.localStorage.setItem(BANNER_KEY, JSON.stringify(banner));
    } catch {
      // ignore
    }
  };

  const setCustomLogoDataUrl = (dataUrl: string | null) => {
    setCustomLogoUrlState(dataUrl);
    try {
      if (dataUrl) {
        window.localStorage.setItem('mykairn_custom_logo_dataurl', dataUrl);
      } else {
        window.localStorage.removeItem('mykairn_custom_logo_dataurl');
      }
    } catch {
      // ignore
    }
  };

  const connectIntervalsAccount = async (params: {
    userId: string;
    intervalsAthleteId: string;
    apiKey: string;
    healthDataConsent: true;
  }) => {
    const res = await fetch('/api/intervals/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        intervalsAthleteId: params.intervalsAthleteId,
        apiKey: params.apiKey,
        authMode: 'api_key',
        healthDataConsent: params.healthDataConsent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Connexion Intervals.icu échouée.');
    }

    const conn = data.connection as IntervalsConnectionPublic & { secretEncrypted: string };
    const snap = data.snapshot as IntervalsSnapshot | null;
    const nowIso = new Date().toISOString();

    setStore((prev) => {
      const nextConns = [
        ...prev.intervalsConnections.filter((c) => c.userId !== params.userId),
        conn,
      ];
      const nextSnaps = snap
        ? [...prev.intervalsSnapshots.filter((s) => s.id !== snap.id), snap]
        : prev.intervalsSnapshots;
      const nextUsers = prev.users.map((u) =>
        u.id === params.userId
          ? {
              ...u,
              consents: {
                ...(u.consents || { marketingOptIn: false }),
                healthDataConsentAt: nowIso,
              },
              updatedAt: nowIso,
            }
          : u
      );
      return {
        ...prev,
        intervalsConnections: nextConns,
        intervalsSnapshots: nextSnaps,
        users: nextUsers,
      };
    });

    return { snapshot: snap, athleteName: data.verification?.athleteName || '' };
  };

  const disconnectIntervalsAccount = (userId: string) => {
    setStore((prev) => ({
      ...prev,
      intervalsConnections: prev.intervalsConnections.filter((c) => c.userId !== userId),
    }));
  };

  const syncAthleteIntervals = async (userId: string): Promise<IntervalsSnapshot> => {
    const conn = store.intervalsConnections.find((c) => c.userId === userId);
    const res = await fetch('/api/intervals/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        intervalsAthleteId: conn?.intervalsAthleteId || '0',
        secretEncrypted: conn?.secretEncrypted,
        demoMode: !conn?.secretEncrypted,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStore((prev) => ({
        ...prev,
        intervalsConnections: prev.intervalsConnections.map((c) =>
          c.userId === userId
            ? { ...c, syncStatus: 'error', lastErrorMessage: data.error }
            : c
        ),
      }));
      throw new Error(data.error || 'Synchronisation Intervals.icu impossible.');
    }

    const snap = data.snapshot as IntervalsSnapshot;
    setStore((prev) => ({
      ...prev,
      intervalsSnapshots: [
        ...prev.intervalsSnapshots.filter((s) => s.id !== snap.id),
        snap,
      ],
      intervalsConnections: prev.intervalsConnections.map((c) =>
        c.userId === userId
          ? {
              ...c,
              syncStatus: 'ok',
              lastSyncedAt: data.lastSyncedAt,
              lastErrorMessage: undefined,
            }
          : c
      ),
    }));
    return snap;
  };

  const submitCheckIn = async (payload: Omit<CheckIn, 'id' | 'createdAt'>): Promise<CheckIn> => {
    const res = await fetch('/api/check-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de la sauvegarde du check-in.');
    }

    const saved = data.checkIn as CheckIn;
    setStore((prev) => ({
      ...prev,
      checkIns: [saved, ...prev.checkIns],
    }));

    if (isFirebaseConfigured && firestoreDb) {
      setDoc(doc(firestoreDb, 'checkIns', saved.id), saved).catch(() => {});
    }
    return saved;
  };

  const grantEntitlement = async (params: {
    userId: string;
    grantType: GrantType;
    trainingPlanId?: string;
    source: EntitlementSource;
    durationDays?: number;
  }): Promise<Entitlement> => {
    const res = await fetch('/api/entitlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorRole: currentUser?.role === 'admin' ? 'admin' : 'coach',
        ...params,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Impossible d'attribuer ce droit.");
    }

    const ent = data.entitlement as Entitlement;
    setStore((prev) => ({
      ...prev,
      entitlements: [ent, ...prev.entitlements],
      athleteProfiles: prev.athleteProfiles.map((p) => {
        if (p.userId !== params.userId) return p;
        const nextTier: TierStatus =
          params.source === 'pilot_showcase'
            ? 'pilot_showcase'
            : params.grantType === 'coaching_access'
            ? 'coaching_paid'
            : p.tierStatus === 'free'
            ? 'plan_only'
            : p.tierStatus;
        return { ...p, tierStatus: nextTier, updatedAt: new Date().toISOString() };
      }),
    }));
    return ent;
  };

  const revokeEntitlement = (entitlementId: string) => {
    setStore((prev) => ({
      ...prev,
      entitlements: prev.entitlements.map((e) =>
        e.id === entitlementId ? { ...e, isActive: false } : e
      ),
    }));
  };

  const updateAthleteProfileCoach = (userId: string, patch: Partial<AthleteProfile>) => {
    setStore((prev) => ({
      ...prev,
      athleteProfiles: prev.athleteProfiles.map((p) =>
        p.userId === userId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      ),
    }));
  };

  const createOrUpdatePlan = (plan: TrainingPlan) => {
    setStore((prev) => {
      const exists = prev.trainingPlans.some((p) => p.id === plan.id);
      return {
        ...prev,
        trainingPlans: exists
          ? prev.trainingPlans.map((p) => (p.id === plan.id ? plan : p))
          : [plan, ...prev.trainingPlans],
      };
    });
  };

  const updateFeatureFlags = (patch: Partial<PlatformFeatureFlags>) => {
    if (!currentUser || (currentUser.role !== 'coach' && currentUser.role !== 'admin')) {
      throw new Error('Action réservée aux administrateurs / coachs.');
    }
    setFeatureFlags((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const simulateOrderCheckout = async (params: {
    orderType: Order['orderType'];
    trainingPlanId?: string;
    amountCents: number;
  }) => {
    if (!currentUser) {
      throw new Error('Veuillez sélectionner ou créer un compte athlète avant de débloquer une offre.');
    }
    if (params.orderType === 'plan_purchase' && !featureFlags.programSalesEnabled) {
      throw new Error("La vente publique de programmes d'entraînement n'est pas encore activée par l'administrateur.");
    }

    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        ...params,
        simulateImmediatePayment: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Échec du traitement de commande.');
    }

    const order = data.order as Order;
    const ent = data.entitlement as Entitlement | null;

    setStore((prev) => ({
      ...prev,
      orders: [order, ...prev.orders],
      entitlements: ent ? [ent, ...prev.entitlements] : prev.entitlements,
      athleteProfiles: prev.athleteProfiles.map((p) => {
        if (p.userId !== currentUser.id) return p;
        const nextTier: TierStatus =
          params.orderType === 'coaching_subscription'
            ? 'coaching_paid'
            : p.tierStatus === 'free'
            ? 'plan_only'
            : p.tierStatus;
        return { ...p, tierStatus: nextTier, updatedAt: new Date().toISOString() };
      }),
    }));

    return { order, entitlement: ent };
  };

  const addCommunityPost = (post: Omit<CommunityPost, 'id' | 'likesCount' | 'createdAt'>) => {
    const created: CommunityPost = {
      ...post,
      id: `post-${Date.now()}`,
      likesCount: 0,
      createdAt: new Date().toISOString(),
    };
    setStore((prev) => ({
      ...prev,
      communityPosts: [created, ...prev.communityPosts],
    }));
  };

  const likeCommunityPost = (postId: string) => {
    setStore((prev) => ({
      ...prev,
      communityPosts: prev.communityPosts.map((p) =>
        p.id === postId ? { ...p, likesCount: p.likesCount + 1 } : p
      ),
    }));
  };

  const saveRoadbook = (rb: RoadbookDoc) => {
    setStore((prev) => {
      const exists = prev.roadbooks.some((r) => r.id === rb.id);
      return {
        ...prev,
        roadbooks: exists
          ? prev.roadbooks.map((r) => (r.id === rb.id ? rb : r))
          : [rb, ...prev.roadbooks],
      };
    });
  };

  const submitCoachingInquiry = async (
    payload: Omit<CoachingInquiry, 'id' | 'createdAt'>
  ): Promise<CoachingInquiry> => {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Impossible d'envoyer votre demande.");
    }
    const inquiry = data.inquiry as CoachingInquiry;
    setStore((prev) => ({
      ...prev,
      coachingInquiries: [inquiry, ...prev.coachingInquiries],
    }));
    return inquiry;
  };

  const totalUnreadMessages = useMemo(() => {
    if (!currentUser) return 0;
    const uid = currentUser.id;
    const isCoach = currentUser.role === 'coach' || currentUser.role === 'admin';
    return store.chatRooms.reduce((acc, room) => {
      if (!isCoach && !room.memberIds.includes(uid)) return acc;
      return acc + (room.unreadBy?.[uid] || 0);
    }, 0);
  }, [store.chatRooms, currentUser]);

  const createChatRoom = async (params: {
    type: ChatRoomType;
    name: string;
    description?: string;
    memberIds: string[];
    isCoachOnlyPost?: boolean;
  }): Promise<ChatRoom> => {
    if (!currentUser) {
      throw new Error('Connexion requise pour créer un salon.');
    }
    const isCoachOrAdmin = currentUser.role === 'coach' || currentUser.role === 'admin';
    if ((params.type === 'announcement' || params.isCoachOnlyPost) && !isCoachOrAdmin) {
      throw new Error('Seul le coach peut créer un canal d’annonces.');
    }

    const uniqueMembers = Array.from(new Set([currentUser.id, ...params.memberIds]));
    if (params.type === 'direct' && uniqueMembers.length === 2) {
      const existing = store.chatRooms.find(
        (r) =>
          r.type === 'direct' &&
          r.memberIds.length === 2 &&
          uniqueMembers.every((uid) => r.memberIds.includes(uid))
      );
      if (existing) return existing;
    }

    const res = await fetch('/api/chat/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        memberIds: uniqueMembers,
        createdBy: currentUser.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Création du salon impossible.');
    }

    const room = data.room as ChatRoom;
    setStore((prev) => ({
      ...prev,
      chatRooms: [room, ...prev.chatRooms],
    }));
    if (isFirebaseConfigured && firestoreDb) {
      setDoc(doc(firestoreDb, 'chatRooms', room.id), room).catch(() => {});
    }
    return room;
  };

  const ensureDirectRoomWith = async (otherUserId: string): Promise<ChatRoom> => {
    if (!currentUser) {
      throw new Error('Connexion requise.');
    }
    const targetUser = store.users.find((u) => u.id === otherUserId);
    return createChatRoom({
      type: 'direct',
      name: targetUser?.displayName || 'Discussion directe',
      memberIds: [currentUser.id, otherUserId],
    });
  };

  const sendChatMessage = async (params: {
    roomId: string;
    content: string;
    attachment?: ChatMessageAttachment;
  }): Promise<ChatMessage> => {
    if (!currentUser) {
      throw new Error('Connexion requise pour envoyer un message.');
    }
    const targetRoom = store.chatRooms.find((r) => r.id === params.roomId);
    if (!targetRoom) {
      throw new Error('Salon introuvable.');
    }
    const isCoachOrAdmin = currentUser.role === 'coach' || currentUser.role === 'admin';
    if (targetRoom.isCoachOnlyPost && !isCoachOrAdmin) {
      throw new Error('Seul le coach peut publier dans ce canal d’annonces.');
    }

    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: params.roomId,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderRole: currentUser.role,
        content: params.content,
        attachment: params.attachment,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Impossible d'envoyer le message.");
    }

    const msg = data.message as ChatMessage;
    const preview =
      targetRoom.type === 'direct'
        ? msg.content.slice(0, 140)
        : `${msg.senderName} : ${msg.content}`.slice(0, 140);

    setStore((prev) => ({
      ...prev,
      chatMessages: [...prev.chatMessages, msg],
      chatRooms: prev.chatRooms.map((r) => {
        if (r.id !== params.roomId) return r;
        const nextUnread: Record<string, number> = { ...(r.unreadBy || {}) };
        for (const uid of r.memberIds) {
          nextUnread[uid] = uid === currentUser.id ? 0 : (nextUnread[uid] || 0) + 1;
        }
        return {
          ...r,
          lastMessageAt: msg.createdAt,
          lastMessagePreview: preview,
          unreadBy: nextUnread,
        };
      }),
    }));

    if (isFirebaseConfigured && firestoreDb) {
      setDoc(doc(firestoreDb, 'chatMessages', msg.id), msg).catch(() => {});
    }
    return msg;
  };

  const markChatRoomRead = (roomId: string) => {
    if (!currentUser) return;
    const uid = currentUser.id;
    setStore((prev) => {
      const target = prev.chatRooms.find((r) => r.id === roomId);
      if (!target || (target.unreadBy?.[uid] || 0) === 0) return prev;
      return {
        ...prev,
        chatRooms: prev.chatRooms.map((r) =>
          r.id === roomId
            ? { ...r, unreadBy: { ...(r.unreadBy || {}), [uid]: 0 } }
            : r
        ),
      };
    });
  };

  const updateChatRoom = (
    roomId: string,
    patch: {
      name?: string;
      description?: string;
      pinnedMessage?: string;
      memberIds?: string[];
    }
  ) => {
    if (!currentUser) return;
    const isCoachOrAdmin = currentUser.role === 'coach' || currentUser.role === 'admin';
    setStore((prev) => ({
      ...prev,
      chatRooms: prev.chatRooms.map((r) => {
        if (r.id !== roomId) return r;
        if (!isCoachOrAdmin && r.createdBy !== currentUser.id) return r;
        const nextMembers = patch.memberIds
          ? Array.from(new Set([r.createdBy, ...patch.memberIds]))
          : r.memberIds;
        return {
          ...r,
          ...patch,
          memberIds: nextMembers,
        };
      }),
    }));
  };

  const leaveOrDeleteChatRoom = (roomId: string) => {
    if (!currentUser) return;
    const uid = currentUser.id;
    const isCoachOrAdmin = currentUser.role === 'coach' || currentUser.role === 'admin';
    setStore((prev) => {
      const room = prev.chatRooms.find((r) => r.id === roomId);
      if (!room || room.type === 'direct') return prev;
      if (isCoachOrAdmin || room.createdBy === uid) {
        return {
          ...prev,
          chatRooms: prev.chatRooms.filter((r) => r.id !== roomId),
          chatMessages: prev.chatMessages.filter((m) => m.roomId !== roomId),
        };
      }
      return {
        ...prev,
        chatRooms: prev.chatRooms.map((r) =>
          r.id === roomId ? { ...r, memberIds: r.memberIds.filter((id) => id !== uid) } : r
        ),
      };
    });
  };

  const exportUserDataRgpd = async () => {
    if (!currentUser) return;
    const uid = currentUser.id;
    const payload = {
      user: currentUser,
      athleteProfile: currentProfile,
      intervalsConnection:
        store.intervalsConnections.find((c) => c.userId === uid) || null,
      intervalsSnapshots: store.intervalsSnapshots.filter((s) => s.userId === uid),
      checkIns: store.checkIns.filter((c) => c.userId === uid),
      roadbooks: store.roadbooks.filter((r) => r.userId === uid),
      orders: store.orders.filter((o) => o.userId === uid),
      entitlements: store.entitlements.filter((e) => e.userId === uid),
      chatMessages: store.chatMessages.filter((m) => m.senderId === uid),
    };

    const res = await fetch('/api/rgpd/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("Échec de l'export RGPD.");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mykairn-rgpd-export-${uid}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccountDataRgpd = async () => {
    if (!currentUser) return;
    const uid = currentUser.id;
    setStore((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== uid),
      athleteProfiles: prev.athleteProfiles.filter((p) => p.userId !== uid),
      intervalsConnections: prev.intervalsConnections.filter((c) => c.userId !== uid),
      intervalsSnapshots: prev.intervalsSnapshots.filter((s) => s.userId !== uid),
      checkIns: prev.checkIns.filter((c) => c.userId === uid ? false : true),
      entitlements: prev.entitlements.filter((e) => e.userId !== uid),
      roadbooks: prev.roadbooks.filter((r) => r.userId !== uid),
      chatMessages: prev.chatMessages.filter((m) => m.senderId !== uid),
      chatRooms: prev.chatRooms.map((r) => ({
        ...r,
        memberIds: r.memberIds.filter((id) => id !== uid),
      })),
    }));
    await logoutUser();
  };

  const value: PlatformContextValue = {
    isReady,
    isFirebaseLive: isFirebaseConfigured,
    store,
    activePersonaId,
    currentUser,
    currentProfile,
    access,
    promoBanner,
    customLogoUrl,
    featureFlags,
    totalUnreadMessages,
    switchPersona,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logoutUser,
    resetDemoData,
    updatePromoBanner,
    setCustomLogoDataUrl,
    updateFeatureFlags,
    connectIntervalsAccount,
    disconnectIntervalsAccount,
    syncAthleteIntervals,
    submitCheckIn,
    grantEntitlement,
    revokeEntitlement,
    updateAthleteProfileCoach,
    createOrUpdatePlan,
    simulateOrderCheckout,
    addCommunityPost,
    likeCommunityPost,
    saveRoadbook,
    submitCoachingInquiry,
    createChatRoom,
    ensureDirectRoomWith,
    sendChatMessage,
    markChatRoomRead,
    updateChatRoom,
    leaveOrDeleteChatRoom,
    exportUserDataRgpd,
    deleteAccountDataRgpd,
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}
