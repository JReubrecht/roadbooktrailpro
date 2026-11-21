import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
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

  const {
    userId,
    assignedCoachId,
    intervalsAthleteId,
    notesCoach,
    tierStatus,
    isShowcaseFeatured,
    showcaseQuote,
    ...rest
  } = parsed.data;

  if (userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Modification non autorisée sur ce profil athlète.' },
      { status: 403 }
    );
  }

  if (assignedCoachId !== undefined && !auth.session.isAdmin) {
    return NextResponse.json(
      {
        error:
          'L’attribution du coach référent est réservée à l’administrateur principal.',
      },
      { status: 403 }
    );
  }

  const touchesCoachProtectedField =
    notesCoach !== undefined ||
    tierStatus !== undefined ||
    isShowcaseFeatured !== undefined ||
    showcaseQuote !== undefined ||
    intervalsAthleteId !== undefined;

  if (touchesCoachProtectedField && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      {
        error:
          'Les notes coach, statuts, identifiant Intervals et mises en avant pilotes sont réservés au coach.',
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

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const profileRef = adminDb.collection('athleteProfiles').doc(userId);
    if (auth.session.role === 'coach') {
      const existingSnap = await profileRef.get();
      const existingCoachId = existingSnap.exists
        ? existingSnap.data()?.assignedCoachId
        : undefined;
      if (existingCoachId !== auth.session.uid) {
        return NextResponse.json(
          { error: 'Cet athlète est suivi par un autre coach.' },
          { status: 403 }
        );
      }
    }

    if (auth.session.isAdmin && assignedCoachId !== undefined) {
      updatePayload.assignedCoachId =
        assignedCoachId === null ? FieldValue.delete() : assignedCoachId;
    }

    if (auth.session.isCoachOrAdmin) {
      if (notesCoach !== undefined) updatePayload.notesCoach = notesCoach;
      if (tierStatus !== undefined) updatePayload.tierStatus = tierStatus;
      if (isShowcaseFeatured !== undefined) {
        updatePayload.isShowcaseFeatured = isShowcaseFeatured;
      }
      if (showcaseQuote !== undefined) updatePayload.showcaseQuote = showcaseQuote;
      if (intervalsAthleteId !== undefined) {
        const cleanId = intervalsAthleteId?.trim() || '';
        updatePayload.intervalsAthleteId = cleanId ? cleanId : FieldValue.delete();
      }
    }

    await profileRef.set(updatePayload, { merge: true });

    const responseProfile: Record<string, unknown> = { ...updatePayload };
    if (assignedCoachId === null) responseProfile.assignedCoachId = undefined;
    if (intervalsAthleteId === null || intervalsAthleteId === '') {
      responseProfile.intervalsAthleteId = undefined;
    }

    return NextResponse.json({ ok: true, profile: responseProfile });
  }

  if (auth.session.isAdmin && assignedCoachId !== undefined) {
    updatePayload.assignedCoachId = assignedCoachId ?? undefined;
  }
  if (auth.session.isCoachOrAdmin) {
    if (notesCoach !== undefined) updatePayload.notesCoach = notesCoach;
    if (tierStatus !== undefined) updatePayload.tierStatus = tierStatus;
    if (isShowcaseFeatured !== undefined) {
      updatePayload.isShowcaseFeatured = isShowcaseFeatured;
    }
    if (showcaseQuote !== undefined) updatePayload.showcaseQuote = showcaseQuote;
    if (intervalsAthleteId !== undefined) {
      updatePayload.intervalsAthleteId = intervalsAthleteId?.trim() || undefined;
    }
  }

  return NextResponse.json({ ok: true, profile: updatePayload });
}
