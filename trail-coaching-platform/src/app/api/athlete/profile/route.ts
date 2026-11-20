import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { athleteProfilePatchSchema } from '@/lib/validation/schemas';

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = athleteProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Profil athlète invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, notesCoach, tierStatus, isShowcaseFeatured, showcaseQuote, ...rest } =
    parsed.data;

  if (userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Modification non autorisée sur ce profil athlète.' },
      { status: 403 }
    );
  }

  const touchesCoachProtectedField =
    notesCoach !== undefined ||
    tierStatus !== undefined ||
    isShowcaseFeatured !== undefined ||
    showcaseQuote !== undefined;

  if (touchesCoachProtectedField && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      {
        error:
          'Les notes coach, statuts et mises en avant pilotes sont réservés au coach.',
      },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    ...rest,
    userId,
    updatedAt: nowIso,
  };

  if (auth.session.isCoachOrAdmin) {
    if (notesCoach !== undefined) updatePayload.notesCoach = notesCoach;
    if (tierStatus !== undefined) updatePayload.tierStatus = tierStatus;
    if (isShowcaseFeatured !== undefined) {
      updatePayload.isShowcaseFeatured = isShowcaseFeatured;
    }
    if (showcaseQuote !== undefined) updatePayload.showcaseQuote = showcaseQuote;
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb
      .collection('athleteProfiles')
      .doc(userId)
      .set(updatePayload, { merge: true });
  }

  return NextResponse.json({ ok: true, profile: updatePayload });
}
