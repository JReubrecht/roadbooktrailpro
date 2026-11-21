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
import { normalizeRoadbookFromFirestore } from '@/lib/firebase/roadbookAdapter';
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

function normalizeUserDoc(
  rawData: Record<string, unknown>,
  docId: string
): UserDoc {
  const doc = normalizeFirestoreDoc<Record<string, unknown>>(rawData, docId);
  const nowIso = new Date().toISOString();
  const email = typeof doc.email === 'string' ? doc.email : '';
  const displayName =
    typeof doc.displayName === 'string' && doc.displayName.trim()
      ? doc.displayName.trim()
      : typeof doc.name === 'string' && doc.name.trim()
      ? doc.name.trim()
      : email.includes('@')
      ? email.split('@')[0]
      : 'Athlète MyKairn';
  const role =
    doc.role === 'admin' || doc.role === 'coach' || doc.role === 'athlete'
      ? doc.role
      : 'athlete';
  const createdAt =
    typeof doc.createdAt === 'string' && doc.createdAt ? doc.createdAt : nowIso;
  const updatedAt =
    typeof doc.updatedAt === 'string' && doc.updatedAt
      ? doc.updatedAt
      : createdAt;

  return {
    ...(doc as unknown as UserDoc),
    id: String(doc.id || docId),
    email,
    displayName,
    role,
    createdAt,
    updatedAt,
  };
}

function sanitizePublicUser(user: UserDoc): UserDoc {
  const isStaff = user.role === 'coach' || user.role === 'admin';
  return {
    id: user.id,
    email: '',
    displayName: user.displayName,
    role: user.role,
    ...(isStaff && user.coachSpecialty ? { coachSpecialty: user.coachSpecialty } : {}),
    ...(isStaff && user.coachBio ? { coachBio: user.coachBio } : {}),
    ...(isStaff && user.coachActive !== undefined ? { coachActive: user.coachActive } : {}),
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
    connectionScope:
      doc.connectionScope === 'coach' || doc.connectionScope === 'athlete'
        ? doc.connectionScope
        : undefined,
    coachedAthletesCount:
      typeof doc.coachedAthletesCount === 'number' ? doc.coachedAthletesCount : undefined,
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
    if (session?.isAdmin) {
      const rbSnap = await adminDb.collection('roadbooks').get();
      roadbooks = rbSnap.docs.map((d) =>
        normalizeRoadbookFromFirestore(d.data(), d.id, 450)
      );
    } else if (session) {
      const [publicRbSnap, ownRbSnap] = await Promise.all([
        adminDb.collection('roadbooks').where('isPublic', '==', true).get(),
        adminDb.collection('roadbooks').where('userId', '==', session.uid).get(),
      ]);
      const rbMap = new Map<string, RoadbookDoc>();
      for (const d of [...publicRbSnap.docs, ...ownRbSnap.docs]) {
        rbMap.set(d.id, normalizeRoadbookFromFirestore(d.data(), d.id, 450));
      }
      roadbooks = Array.from(rbMap.values());
    } else {
      const publicRbSnap = await adminDb
        .collection('roadbooks')
        .where('isPublic', '==', true)
        .get();
      roadbooks = publicRbSnap.docs.map((d) =>
        normalizeRoadbookFromFirestore(d.data(), d.id, 450)
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

    if (session?.isAdmin) {
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
        normalizeUserDoc(d.data(), d.id)
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
    } else if (session?.role === 'coach') {
      const [
        staffUsersSnap,
        assignedProfilesSnap,
        featuredProfilesSnap,
        ownConnSnap,
        inquiriesSnap,
        roomsSnap,
      ] = await Promise.all([
        adminDb.collection('users').where('role', 'in', ['coach', 'admin']).get(),
        adminDb
          .collection('athleteProfiles')
          .where('assignedCoachId', '==', session.uid)
          .get(),
        adminDb
          .collection('athleteProfiles')
          .where('isShowcaseFeatured', '==', true)
          .get(),
        adminDb.collection('intervalsConnections').doc(session.uid).get(),
        adminDb.collection('coachingInquiries').get(),
        adminDb
          .collection('chatRooms')
          .where('memberIds', 'array-contains', session.uid)
          .get(),
      ]);

      const profileMap = new Map<string, AthleteProfile>();
      const assignedAthleteIds: string[] = [];

      for (const pDoc of assignedProfilesSnap.docs) {
        const p = normalizeFirestoreDoc<AthleteProfile>(pDoc.data(), pDoc.id);
        profileMap.set(p.userId, p);
        assignedAthleteIds.push(p.userId);
      }
      for (const pDoc of featuredProfilesSnap.docs) {
        if (!profileMap.has(pDoc.id)) {
          const p = sanitizePublicProfile(
            normalizeFirestoreDoc<AthleteProfile>(pDoc.data(), pDoc.id)
          );
          profileMap.set(p.userId, p);
        }
      }
      athleteProfiles = Array.from(profileMap.values());

      const userMap = new Map<string, UserDoc>();
      for (const sDoc of staffUsersSnap.docs) {
        const u = normalizeUserDoc(sDoc.data(), sDoc.id);
        userMap.set(
          u.id,
          u.id === session.uid ? u : sanitizePublicUser(u)
        );
      }

      chatRooms = roomsSnap.docs
        .map((d) => normalizeFirestoreDoc<ChatRoom>(d.data(), d.id))
        .sort((a, b) =>
          (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)
        );

      const extraUserIds = new Set<string>(assignedAthleteIds);
      for (const p of athleteProfiles) {
        if (!userMap.has(p.userId)) extraUserIds.add(p.userId);
      }
      for (const r of chatRooms) {
        for (const mId of r.memberIds || []) {
          if (!userMap.has(mId)) extraUserIds.add(mId);
        }
      }

      if (extraUserIds.size > 0) {
        const extraSnaps = await Promise.all(
          Array.from(extraUserIds).map((uid) =>
            adminDb.collection('users').doc(uid).get()
          )
        );
        for (const uDoc of extraSnaps) {
          if (!uDoc.exists) continue;
          const full = normalizeUserDoc(uDoc.data()!, uDoc.id);
          userMap.set(
            uDoc.id,
            assignedAthleteIds.includes(uDoc.id) ? full : sanitizePublicUser(full)
          );
        }
      }
      users = Array.from(userMap.values());

      if (ownConnSnap.exists) {
        intervalsConnections = [
          sanitizeIntervalsConnection(ownConnSnap.data()!, ownConnSnap.id),
        ];
      }

      coachingInquiries = inquiriesSnap.docs
        .map((d) => normalizeFirestoreDoc<CoachingInquiry>(d.data(), d.id))
        .filter((inq) => !inq.assignedCoachId || inq.assignedCoachId === session.uid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const scopedIds = Array.from(new Set([session.uid, ...assignedAthleteIds]));
      if (scopedIds.length > 0) {
        for (let i = 0; i < scopedIds.length; i += 25) {
          const chunk = scopedIds.slice(i, i + 25);
          const [ordSnap, entSnap, snapSnap, ciSnap, rbSnap] = await Promise.all([
            adminDb.collection('orders').where('userId', 'in', chunk).get(),
            adminDb.collection('entitlements').where('userId', 'in', chunk).get(),
            adminDb
              .collection('intervalsSnapshots')
              .where('userId', 'in', chunk)
              .get(),
            adminDb.collection('checkIns').where('userId', 'in', chunk).get(),
            adminDb.collection('roadbooks').where('userId', 'in', chunk).get(),
          ]);

          for (const d of ordSnap.docs) {
            orders.push(normalizeFirestoreDoc<Order>(d.data(), d.id));
          }
          for (const d of entSnap.docs) {
            entitlements.push(normalizeFirestoreDoc<Entitlement>(d.data(), d.id));
          }
          for (const d of snapSnap.docs) {
            intervalsSnapshots.push(
              normalizeFirestoreDoc<IntervalsSnapshot>(d.data(), d.id)
            );
          }
          for (const d of ciSnap.docs) {
            checkIns.push(normalizeFirestoreDoc<CheckIn>(d.data(), d.id));
          }
          for (const d of rbSnap.docs) {
            const rb = normalizeRoadbookFromFirestore(d.data(), d.id, 450);
            if (!roadbooks.some((r) => r.id === rb.id)) {
              roadbooks.push(rb);
            }
          }
        }
        orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        intervalsSnapshots.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
        checkIns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

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
    } else if (session) {
      const [
        ownUserSnap,
        ownProfileSnap,
        featuredProfilesSnap,
        staffUsersSnap,
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
        adminDb.collection('users').where('role', 'in', ['coach', 'admin']).get(),
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
          normalizeUserDoc(ownUserSnap.data()!, session.uid)
        );
      }
      for (const cDoc of staffUsersSnap.docs) {
        if (!userMap.has(cDoc.id)) {
          userMap.set(
            cDoc.id,
            sanitizePublicUser(normalizeUserDoc(cDoc.data(), cDoc.id))
          );
        }
      }

      const profileMap = new Map<string, AthleteProfile>();
      let ownAssignedCoachId: string | undefined;
      if (ownProfileSnap.exists) {
        const ownProf = sanitizePublicProfile(
          normalizeFirestoreDoc<AthleteProfile>(ownProfileSnap.data()!, session.uid)
        );
        ownAssignedCoachId = ownProf.assignedCoachId;
        profileMap.set(session.uid, ownProf);
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
              sanitizePublicUser(normalizeUserDoc(uDoc.data()!, uDoc.id))
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
        intervalsConnections.push(
          sanitizeIntervalsConnection(connSnap.data()!, connSnap.id)
        );
      }
      if (ownAssignedCoachId && ownAssignedCoachId !== session.uid) {
        const coachConnSnap = await adminDb
          .collection('intervalsConnections')
          .doc(ownAssignedCoachId)
          .get();
        if (coachConnSnap.exists) {
          intervalsConnections.push({
            ...sanitizeIntervalsConnection(coachConnSnap.data()!, coachConnSnap.id),
            connectionScope: 'coach',
          });
        }
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
            sanitizePublicUser(normalizeUserDoc(d.data()!, d.id))
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
