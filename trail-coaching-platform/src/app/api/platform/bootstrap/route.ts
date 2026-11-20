import { NextRequest, NextResponse } from 'next/server';
import {
  BRAND_CONFIG,
  DEFAULT_FEATURE_FLAGS,
  type PlatformFeatureFlags,
  type PromoBannerConfig,
} from '@/config/brand';
import { verifyServerSession } from '@/lib/auth/serverAuth';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  normalizeFirestoreDoc,
} from '@/lib/firebase/admin';
import type {
  AthleteProfile,
  ChatMessage,
  ChatRoom,
  CheckIn,
  CoachingInquiry,
  CommunityChallenge,
  CommunityPost,
  Entitlement,
  IntervalsConnectionPublic,
  IntervalsSnapshot,
  Order,
  RoadbookDoc,
  TrainingPlan,
  UserDoc,
} from '@/types/domain';

function sanitizePublicUser(user: UserDoc): UserDoc {
  return {
    id: user.id,
    email: '',
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sanitizePublicProfile(profile: AthleteProfile): AthleteProfile {
  const copy = { ...profile };
  delete copy.notesCoach;
  return copy;
}

function sanitizeIntervalsConnection(
  raw: Record<string, unknown>,
  docId: string
): IntervalsConnectionPublic {
  const doc = normalizeFirestoreDoc<Record<string, unknown>>(raw, docId);
  return {
    userId: String(doc.userId || docId),
    intervalsAthleteId: String(doc.intervalsAthleteId || ''),
    authMode: doc.authMode === 'oauth' ? 'oauth' : 'api_key',
    hasSecret: Boolean(doc.hasSecret || doc.secretEncrypted),
    syncStatus:
      doc.syncStatus === 'ok' ||
      doc.syncStatus === 'pending' ||
      doc.syncStatus === 'error'
        ? doc.syncStatus
        : 'pending',
    lastSyncedAt: typeof doc.lastSyncedAt === 'string' ? doc.lastSyncedAt : undefined,
    lastErrorMessage:
      typeof doc.lastErrorMessage === 'string' ? doc.lastErrorMessage : undefined,
    updatedAt:
      typeof doc.updatedAt === 'string'
        ? doc.updatedAt
        : new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await verifyServerSession(request);

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      mode: process.env.NODE_ENV === 'production' ? 'unconfigured' : 'sandbox',
      session,
      promoBanner: BRAND_CONFIG.promoBanner,
      featureFlags: DEFAULT_FEATURE_FLAGS,
      customLogoUrl: null,
    });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Firestore Admin indisponible.' },
      { status: 500 }
    );
  }

  try {
    const configSnap = await adminDb.collection('platformConfig').doc('global').get();
    const configData = configSnap.exists ? configSnap.data() || {} : {};
    const promoBanner: PromoBannerConfig = {
      ...BRAND_CONFIG.promoBanner,
      ...((configData.promoBanner as Partial<PromoBannerConfig>) || {}),
    };
    const featureFlags: PlatformFeatureFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...((configData.featureFlags as Partial<PlatformFeatureFlags>) || {}),
    };
    const customLogoUrl: string | null =
      typeof configData.customLogoUrl === 'string' ? configData.customLogoUrl : null;

    const plansQuery = session?.isCoachOrAdmin
      ? adminDb.collection('trainingPlans').get()
      : adminDb
          .collection('trainingPlans')
          .where('status', '==', 'published')
          .get();

    const postsQuery = adminDb
      .collection('communityPosts')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const challengesQuery = adminDb.collection('communityChallenges').get();

    const [plansSnap, postsSnap, challengesSnap] = await Promise.all([
      plansQuery,
      postsQuery,
      challengesQuery,
    ]);

    const trainingPlans = plansSnap.docs.map((d) =>
      normalizeFirestoreDoc<TrainingPlan>(d.data(), d.id)
    );
    const communityPosts = postsSnap.docs.map((d) =>
      normalizeFirestoreDoc<CommunityPost>(d.data(), d.id)
    );
    const communityChallenges = challengesSnap.docs.map((d) =>
      normalizeFirestoreDoc<CommunityChallenge>(d.data(), d.id)
    );

    let roadbooks: RoadbookDoc[] = [];
    if (session?.isCoachOrAdmin) {
      const rbSnap = await adminDb.collection('roadbooks').get();
      roadbooks = rbSnap.docs.map((d) =>
        normalizeFirestoreDoc<RoadbookDoc>(d.data(), d.id)
      );
    } else if (session) {
      const [publicRbSnap, ownRbSnap] = await Promise.all([
        adminDb.collection('roadbooks').where('isPublic', '==', true).get(),
        adminDb.collection('roadbooks').where('userId', '==', session.uid).get(),
      ]);
      const rbMap = new Map<string, RoadbookDoc>();
      for (const d of [...publicRbSnap.docs, ...ownRbSnap.docs]) {
        rbMap.set(d.id, normalizeFirestoreDoc<RoadbookDoc>(d.data(), d.id));
      }
      roadbooks = Array.from(rbMap.values());
    } else {
      const publicRbSnap = await adminDb
        .collection('roadbooks')
        .where('isPublic', '==', true)
        .get();
      roadbooks = publicRbSnap.docs.map((d) =>
        normalizeFirestoreDoc<RoadbookDoc>(d.data(), d.id)
      );
    }

    let users: UserDoc[] = [];
    let athleteProfiles: AthleteProfile[] = [];
    let orders: Order[] = [];
    let entitlements: Entitlement[] = [];
    let intervalsConnections: IntervalsConnectionPublic[] = [];
    let intervalsSnapshots: IntervalsSnapshot[] = [];
    let checkIns: CheckIn[] = [];
    let coachingInquiries: CoachingInquiry[] = [];
    let chatRooms: ChatRoom[] = [];
    let chatMessages: ChatMessage[] = [];

    if (session?.isCoachOrAdmin) {
      const [
        usersSnap,
        profilesSnap,
        ordersSnap,
        entSnap,
        connsSnap,
        snapsSnap,
        checkInsSnap,
        inquiriesSnap,
        roomsSnap,
        msgsSnap,
      ] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('athleteProfiles').get(),
        adminDb.collection('orders').get(),
        adminDb.collection('entitlements').get(),
        adminDb.collection('intervalsConnections').get(),
        adminDb.collection('intervalsSnapshots').get(),
        adminDb.collection('checkIns').get(),
        adminDb.collection('coachingInquiries').get(),
        adminDb.collection('chatRooms').get(),
        adminDb.collection('chatMessages').orderBy('createdAt', 'desc').limit(300).get(),
      ]);

      users = usersSnap.docs.map((d) =>
        normalizeFirestoreDoc<UserDoc>(d.data(), d.id)
      );
      athleteProfiles = profilesSnap.docs.map((d) =>
        normalizeFirestoreDoc<AthleteProfile>(d.data(), d.id)
      );
      orders = ordersSnap.docs
        .map((d) => normalizeFirestoreDoc<Order>(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      entitlements = entSnap.docs.map((d) =>
        normalizeFirestoreDoc<Entitlement>(d.data(), d.id)
      );
      intervalsConnections = connsSnap.docs.map((d) =>
        sanitizeIntervalsConnection(d.data(), d.id)
      );
      intervalsSnapshots = snapsSnap.docs
        .map((d) => normalizeFirestoreDoc<IntervalsSnapshot>(d.data(), d.id))
        .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
      checkIns = checkInsSnap.docs
        .map((d) => normalizeFirestoreDoc<CheckIn>(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      coachingInquiries = inquiriesSnap.docs
        .map((d) => normalizeFirestoreDoc<CoachingInquiry>(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      chatRooms = roomsSnap.docs
        .map((d) => normalizeFirestoreDoc<ChatRoom>(d.data(), d.id))
        .sort((a, b) =>
          (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)
        );
      chatMessages = msgsSnap.docs
        .map((d) => normalizeFirestoreDoc<ChatMessage>(d.data(), d.id))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } else if (session) {
      const [
        ownUserSnap,
        ownProfileSnap,
        featuredProfilesSnap,
        coachUsersSnap,
        ordersSnap,
        entSnap,
        connSnap,
        snapsSnap,
        checkInsSnap,
        roomsSnap,
      ] = await Promise.all([
        adminDb.collection('users').doc(session.uid).get(),
        adminDb.collection('athleteProfiles').doc(session.uid).get(),
        adminDb
          .collection('athleteProfiles')
          .where('isShowcaseFeatured', '==', true)
          .get(),
        adminDb.collection('users').where('role', '==', 'coach').get(),
        adminDb.collection('orders').where('userId', '==', session.uid).get(),
        adminDb.collection('entitlements').where('userId', '==', session.uid).get(),
        adminDb.collection('intervalsConnections').doc(session.uid).get(),
        adminDb
          .collection('intervalsSnapshots')
          .where('userId', '==', session.uid)
          .get(),
        adminDb.collection('checkIns').where('userId', '==', session.uid).get(),
        adminDb
          .collection('chatRooms')
          .where('memberIds', 'array-contains', session.uid)
          .get(),
      ]);

      const userMap = new Map<string, UserDoc>();
      if (ownUserSnap.exists) {
        userMap.set(
          session.uid,
          normalizeFirestoreDoc<UserDoc>(ownUserSnap.data()!, session.uid)
        );
      }
      for (const cDoc of coachUsersSnap.docs) {
        if (!userMap.has(cDoc.id)) {
          userMap.set(
            cDoc.id,
            sanitizePublicUser(normalizeFirestoreDoc<UserDoc>(cDoc.data(), cDoc.id))
          );
        }
      }

      const profileMap = new Map<string, AthleteProfile>();
      if (ownProfileSnap.exists) {
        profileMap.set(
          session.uid,
          sanitizePublicProfile(
            normalizeFirestoreDoc<AthleteProfile>(ownProfileSnap.data()!, session.uid)
          )
        );
      }

      const extraUserIdsToFetch = new Set<string>();
      for (const pDoc of featuredProfilesSnap.docs) {
        const p = sanitizePublicProfile(
          normalizeFirestoreDoc<AthleteProfile>(pDoc.data(), pDoc.id)
        );
        if (!profileMap.has(p.userId)) {
          profileMap.set(p.userId, p);
        }
        if (!userMap.has(p.userId)) {
          extraUserIdsToFetch.add(p.userId);
        }
      }

      chatRooms = roomsSnap.docs
        .map((d) => normalizeFirestoreDoc<ChatRoom>(d.data(), d.id))
        .sort((a, b) =>
          (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)
        );

      for (const r of chatRooms) {
        for (const mId of r.memberIds || []) {
          if (!userMap.has(mId)) {
            extraUserIdsToFetch.add(mId);
          }
        }
      }

      if (extraUserIdsToFetch.size > 0) {
        const extraSnaps = await Promise.all(
          Array.from(extraUserIdsToFetch).map((uid) =>
            adminDb.collection('users').doc(uid).get()
          )
        );
        for (const uDoc of extraSnaps) {
          if (uDoc.exists && !userMap.has(uDoc.id)) {
            userMap.set(
              uDoc.id,
              sanitizePublicUser(normalizeFirestoreDoc<UserDoc>(uDoc.data()!, uDoc.id))
            );
          }
        }
      }

      users = Array.from(userMap.values());
      athleteProfiles = Array.from(profileMap.values());
      orders = ordersSnap.docs
        .map((d) => normalizeFirestoreDoc<Order>(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      entitlements = entSnap.docs.map((d) =>
        normalizeFirestoreDoc<Entitlement>(d.data(), d.id)
      );
      if (connSnap.exists) {
        intervalsConnections = [
          sanitizeIntervalsConnection(connSnap.data()!, connSnap.id),
        ];
      }
      intervalsSnapshots = snapsSnap.docs
        .map((d) => normalizeFirestoreDoc<IntervalsSnapshot>(d.data(), d.id))
        .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
      checkIns = checkInsSnap.docs
        .map((d) => normalizeFirestoreDoc<CheckIn>(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      if (chatRooms.length > 0) {
        const roomIds = chatRooms.map((r) => r.id);
        const messageDocs: ChatMessage[] = [];
        for (let i = 0; i < roomIds.length; i += 25) {
          const chunk = roomIds.slice(i, i + 25);
          const msgSnap = await adminDb
            .collection('chatMessages')
            .where('roomId', 'in', chunk)
            .get();
          for (const md of msgSnap.docs) {
            messageDocs.push(normalizeFirestoreDoc<ChatMessage>(md.data(), md.id));
          }
        }
        chatMessages = messageDocs.sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );
      }
    } else {
      const featuredProfilesSnap = await adminDb
        .collection('athleteProfiles')
        .where('isShowcaseFeatured', '==', true)
        .get();

      athleteProfiles = featuredProfilesSnap.docs.map((d) =>
        sanitizePublicProfile(normalizeFirestoreDoc<AthleteProfile>(d.data(), d.id))
      );

      if (athleteProfiles.length > 0) {
        const userSnaps = await Promise.all(
          athleteProfiles.map((p) => adminDb.collection('users').doc(p.userId).get())
        );
        users = userSnaps
          .filter((d) => d.exists)
          .map((d) =>
            sanitizePublicUser(normalizeFirestoreDoc<UserDoc>(d.data()!, d.id))
          );
      }
    }

    return NextResponse.json({
      mode: 'firebase_admin',
      session,
      promoBanner,
      featureFlags,
      customLogoUrl,
      store: {
        users,
        athleteProfiles,
        trainingPlans,
        roadbooks,
        orders,
        entitlements,
        intervalsConnections,
        intervalsSnapshots,
        checkIns,
        communityChallenges,
        communityPosts,
        coachingInquiries,
        chatRooms,
        chatMessages,
      },
    });
  } catch (err) {
    console.error('[GET /api/platform/bootstrap] Erreur:', err);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des données plateforme.' },
      { status: 500 }
    );
  }
}
