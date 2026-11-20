import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  normalizeFirestoreDoc,
} from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const targetUid = auth.session.uid;

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const [
      userSnap,
      profileSnap,
      roadbooksSnap,
      checkInsSnap,
      ordersSnap,
      entitlementsSnap,
      connSnap,
      snapshotsSnap,
      postsSnap,
      roomsSnap,
      messagesSnap,
    ] = await Promise.all([
      adminDb.collection('users').doc(targetUid).get(),
      adminDb.collection('athleteProfiles').doc(targetUid).get(),
      adminDb.collection('roadbooks').where('userId', '==', targetUid).get(),
      adminDb.collection('checkIns').where('userId', '==', targetUid).get(),
      adminDb.collection('orders').where('userId', '==', targetUid).get(),
      adminDb.collection('entitlements').where('userId', '==', targetUid).get(),
      adminDb.collection('intervalsConnections').doc(targetUid).get(),
      adminDb.collection('intervalsSnapshots').where('userId', '==', targetUid).get(),
      adminDb.collection('communityPosts').where('userId', '==', targetUid).get(),
      adminDb.collection('chatRooms').where('memberIds', 'array-contains', targetUid).get(),
      adminDb.collection('chatMessages').where('senderId', '==', targetUid).get(),
    ]);

    let profileData: Record<string, unknown> | null = null;
    if (profileSnap.exists) {
      profileData = normalizeFirestoreDoc<Record<string, unknown>>(
        profileSnap.data()!,
        profileSnap.id
      );
      if (profileData) {
        delete profileData.notesCoach;
      }
    }

    let intervalsData: Record<string, unknown> | null = null;
    if (connSnap.exists) {
      intervalsData = normalizeFirestoreDoc<Record<string, unknown>>(
        connSnap.data()!,
        connSnap.id
      );
      if (intervalsData) {
        delete intervalsData.secretEncrypted;
      }
    }

    const bundle = {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      controller: 'MyKairn Trail Coaching',
      subjectUserId: targetUid,
      legalBasis:
        'RGPD Article 15 & Article 20 (Droit d’accès et portabilité des données personnelles).',
      data: {
        user: userSnap.exists
          ? normalizeFirestoreDoc(userSnap.data()!, userSnap.id)
          : null,
        athleteProfile: profileData,
        roadbooks: roadbooksSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
        checkIns: checkInsSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
        orders: ordersSnap.docs.map((d) => normalizeFirestoreDoc(d.data(), d.id)),
        entitlements: entitlementsSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
        intervalsConnection: intervalsData,
        intervalsSnapshots: snapshotsSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
        communityPosts: postsSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
        chatRooms: roomsSnap.docs.map((d) => normalizeFirestoreDoc(d.data(), d.id)),
        chatMessages: messagesSnap.docs.map((d) =>
          normalizeFirestoreDoc(d.data(), d.id)
        ),
      },
    };

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mykairn-rgpd-export-${targetUid}.json"`,
      },
    });
  }

  // Fallback dev sandbox local
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const sanitizedIntervals = Array.isArray(body.intervalsConnections)
    ? body.intervalsConnections.map((c) => {
        if (typeof c === 'object' && c !== null) {
          const copy = { ...(c as Record<string, unknown>) };
          delete copy.secretEncrypted;
          return copy;
        }
        return c;
      })
    : [];

  let sanitizedProfile = body.athleteProfile;
  if (typeof sanitizedProfile === 'object' && sanitizedProfile !== null) {
    sanitizedProfile = { ...(sanitizedProfile as Record<string, unknown>) };
    delete (sanitizedProfile as Record<string, unknown>).notesCoach;
  }

  const bundle = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    controller: 'MyKairn Trail Coaching',
    subjectUserId: targetUid,
    legalBasis:
      'RGPD Article 15 & Article 20 (Droit d’accès et portabilité des données personnelles).',
    data: {
      user: body.user ?? null,
      athleteProfile: sanitizedProfile ?? null,
      roadbooks: body.roadbooks ?? [],
      checkIns: body.checkIns ?? [],
      orders: body.orders ?? [],
      entitlements: body.entitlements ?? [],
      intervalsConnections: sanitizedIntervals,
      intervalsSnapshots: body.intervalsSnapshots ?? [],
      chatRooms: body.chatRooms ?? [],
      chatMessages: body.chatMessages ?? [],
    },
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mykairn-rgpd-export-${targetUid}.json"`,
    },
  });
}
