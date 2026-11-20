import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { notifyCoachPainAlert } from '@/lib/notifications/email';
import { checkInCreateSchema } from '@/lib/validation/schemas';
import type { CheckIn } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = checkInCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données check-in invalides', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Vous ne pouvez enregistrer un check-in que pour votre compte.' },
      { status: 403 }
    );
  }

  const checkIn: CheckIn = {
    id: `ci-${crypto.randomUUID()}`,
    userId: parsed.data.userId,
    checkInDate: parsed.data.checkInDate,
    intervalsActivityId: parsed.data.intervalsActivityId,
    rpe: parsed.data.rpe,
    fatigueLevel: parsed.data.fatigueLevel,
    sorenessLevel: parsed.data.sorenessLevel,
    sensitiveArea: parsed.data.sensitiveArea,
    painFlag: parsed.data.painFlag,
    comment: parsed.data.comment,
    createdAt: new Date().toISOString(),
  };

  let athleteName = auth.session.displayName;
  let athleteEmail = auth.session.email;

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('checkIns').doc(checkIn.id).set(checkIn);

    if (checkIn.painFlag && checkIn.userId !== auth.session.uid) {
      const uSnap = await adminDb.collection('users').doc(checkIn.userId).get();
      if (uSnap.exists) {
        const uData = uSnap.data() || {};
        if (typeof uData.displayName === 'string' && uData.displayName.trim()) {
          athleteName = uData.displayName.trim();
        }
        if (typeof uData.email === 'string') {
          athleteEmail = uData.email;
        }
      }
    }
  }

  if (checkIn.painFlag) {
    await notifyCoachPainAlert({
      athleteName,
      athleteEmail,
      sensitiveArea: checkIn.sensitiveArea,
      comment: checkIn.comment,
      fatigueLevel: checkIn.fatigueLevel,
      rpe: checkIn.rpe,
      checkInDate: checkIn.checkInDate,
    });
  }

  return NextResponse.json({ ok: true, checkIn }, { status: 201 });
}
