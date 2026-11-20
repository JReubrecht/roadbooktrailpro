import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCoachOrAdmin } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { entitlementGrantSchema } from '@/lib/validation/schemas';
import type { Entitlement, TierStatus } from '@/types/domain';

function computeTierStatus(
  grantType: Entitlement['grantType'],
  source: Entitlement['source']
): TierStatus {
  if (source === 'pilot_showcase') return 'pilot_showcase';
  if (grantType === 'coaching_access') return 'coaching_paid';
  if (grantType === 'plan_access') return 'plan_only';
  return 'free';
}

export async function POST(request: NextRequest) {
  const auth = await requireCoachOrAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = entitlementGrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, grantType, trainingPlanId, source, durationDays } = parsed.data;
  const now = new Date();
  const expiresAt = durationDays
    ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  const nowIso = now.toISOString();

  const entitlement: Entitlement = {
    id: `ent-${crypto.randomUUID()}`,
    userId,
    grantType,
    ...(trainingPlanId ? { trainingPlanId } : {}),
    source,
    startsAt: nowIso,
    isActive: true,
    ...(expiresAt ? { expiresAt } : {}),
    createdAt: nowIso,
  };

  const nextTier = computeTierStatus(grantType, source);

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const batch = adminDb.batch();
    batch.set(adminDb.collection('entitlements').doc(entitlement.id), entitlement);

    const profileRef = adminDb.collection('athleteProfiles').doc(userId);
    const profileSnap = await profileRef.get();
    const existingTier = profileSnap.exists
      ? (profileSnap.data()?.tierStatus as TierStatus | undefined)
      : undefined;
    const resolvedTier: TierStatus =
      existingTier === 'coaching_paid' && nextTier !== 'pilot_showcase'
        ? 'coaching_paid'
        : nextTier;

    batch.set(
      profileRef,
      {
        userId,
        tierStatus: resolvedTier,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    await batch.commit();
  }

  return NextResponse.json(
    { ok: true, entitlement, tierStatus: nextTier },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireCoachOrAdmin(request);
  if (!auth.ok) return auth.response;

  let entitlementId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!entitlementId) {
    try {
      const body = (await request.json()) as { id?: string; entitlementId?: string };
      entitlementId = (body.id || body.entitlementId || '').trim();
    } catch {
      // ignore empty body
    }
  }

  if (!entitlementId) {
    return NextResponse.json(
      { error: 'Identifiant entitlement requis.' },
      { status: 400 }
    );
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    const nowIso = new Date().toISOString();
    await adminDb
      .collection('entitlements')
      .doc(entitlementId)
      .set(
        {
          isActive: false,
          revokedAt: nowIso,
          revokedBy: auth.session.uid,
        },
        { merge: true }
      );
  }

  return NextResponse.json({ ok: true, id: entitlementId });
}
