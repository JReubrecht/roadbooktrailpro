import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import {
  deleteSandboxIntervalsSecret,
  getAdminDb,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let targetUserId = auth.session.uid;
  try {
    const body = (await request.json()) as { userId?: string };
    if (typeof body?.userId === 'string' && body.userId.trim()) {
      targetUserId = body.userId.trim();
    }
  } catch {
    // body optionnel : utilise auth.session.uid par défaut
  }

  if (targetUserId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Opération non autorisée sur ce compte.' },
      { status: 403 }
    );
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('intervalsConnections').doc(targetUserId).delete();
  } else {
    deleteSandboxIntervalsSecret(targetUserId);
  }

  return NextResponse.json({ ok: true, userId: targetUserId });
}
