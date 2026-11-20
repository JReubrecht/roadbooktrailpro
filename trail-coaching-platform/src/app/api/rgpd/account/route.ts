import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/auth/serverAuth';
import {
  deleteSandboxIntervalsSecret,
  getAdminAuth,
  getAdminDb,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const uid = auth.session.uid;

  if (!isFirebaseAdminConfigured()) {
    deleteSandboxIntervalsSecret(uid);
    return NextResponse.json({
      ok: true,
      mode: 'sandbox',
      deletedUserId: uid,
    });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin indisponible.' },
      { status: 500 }
    );
  }

  try {
    const [
      roadbooksSnap,
      checkInsSnap,
      ordersSnap,
      entitlementsSnap,
      snapshotsSnap,
      postsSnap,
      messagesSnap,
      roomsSnap,
    ] = await Promise.all([
      adminDb.collection('roadbooks').where('userId', '==', uid).get(),
      adminDb.collection('checkIns').where('userId', '==', uid).get(),
      adminDb.collection('orders').where('userId', '==', uid).get(),
      adminDb.collection('entitlements').where('userId', '==', uid).get(),
      adminDb.collection('intervalsSnapshots').where('userId', '==', uid).get(),
      adminDb.collection('communityPosts').where('userId', '==', uid).get(),
      adminDb.collection('chatMessages').where('senderId', '==', uid).get(),
      adminDb.collection('chatRooms').where('memberIds', 'array-contains', uid).get(),
    ]);

    const refsToDelete: DocumentReference[] = [
      adminDb.collection('users').doc(uid),
      adminDb.collection('athleteProfiles').doc(uid),
      adminDb.collection('intervalsConnections').doc(uid),
      ...roadbooksSnap.docs.map((d) => d.ref),
      ...checkInsSnap.docs.map((d) => d.ref),
      ...ordersSnap.docs.map((d) => d.ref),
      ...entitlementsSnap.docs.map((d) => d.ref),
      ...snapshotsSnap.docs.map((d) => d.ref),
      ...postsSnap.docs.map((d) => d.ref),
      ...messagesSnap.docs.map((d) => d.ref),
    ];

    // Firestore batch accepte max 500 écritures par lot
    for (let i = 0; i < refsToDelete.length; i += 400) {
      const chunk = refsToDelete.slice(i, i + 400);
      const batch = adminDb.batch();
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    for (let i = 0; i < roomsSnap.docs.length; i += 400) {
      const chunk = roomsSnap.docs.slice(i, i + 400);
      const batch = adminDb.batch();
      for (const roomDoc of chunk) {
        batch.update(roomDoc.ref, {
          memberIds: FieldValue.arrayRemove(uid),
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
    }

    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      mode: 'firebase_admin',
      deletedUserId: uid,
    });
  } catch (err) {
    console.error('[DELETE /api/rgpd/account] Erreur:', err);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression complète du compte.' },
      { status: 500 }
    );
  }
}
