import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import {
  getAdminDb,
  isFirebaseAdminConfigured,
  setSandboxIntervalsSecret,
} from '@/lib/firebase/admin';
import {
  fetchCoachIntervalsRosterServer,
  fetchIntervalsSnapshotServer,
  verifyIntervalsConnectionServer,
} from '@/lib/intervals/client';
import { encryptIntervalsSecret } from '@/lib/intervals/crypto';
import { intervalsConnectSchema } from '@/lib/validation/schemas';
import type {
  IntervalsCoachedAthlete,
  IntervalsConnectionPublic,
} from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = intervalsConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, intervalsAthleteId, apiKey, connectionScope } = parsed.data;

  if (connectionScope === 'coach') {
    if (!auth.session.isCoachOrAdmin) {
      return NextResponse.json(
        { error: 'La connexion de clé Coach est réservée aux coachs et administrateurs.' },
        { status: 403 }
      );
    }
    if (userId !== auth.session.uid && !auth.session.isAdmin) {
      return NextResponse.json(
        { error: 'Vous ne pouvez configurer que votre propre clé API Coach.' },
        { status: 403 }
      );
    }
  } else if (userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Vous ne pouvez connecter que votre propre compte Intervals.icu.' },
      { status: 403 }
    );
  }

  let verification;
  try {
    verification = await verifyIntervalsConnectionServer(intervalsAthleteId, apiKey);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Impossible de vérifier les identifiants Intervals.icu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const secretEncrypted = encryptIntervalsSecret(apiKey);
  const nowIso = new Date().toISOString();

  if (connectionScope === 'coach') {
    let coachedAthletes: IntervalsCoachedAthlete[] = [];
    try {
      coachedAthletes = await fetchCoachIntervalsRosterServer(
        apiKey,
        verification.resolvedAthleteId
      );
    } catch {
      coachedAthletes = [];
    }

    const publicConnection: IntervalsConnectionPublic = {
      userId,
      intervalsAthleteId: verification.resolvedAthleteId,
      authMode: 'api_key',
      connectionScope: 'coach',
      coachedAthletesCount: coachedAthletes.length,
      hasSecret: true,
      syncStatus: 'ok',
      lastSyncedAt: nowIso,
      updatedAt: nowIso,
    };

    if (isFirebaseAdminConfigured()) {
      const adminDb = getAdminDb();
      if (!adminDb) {
        return NextResponse.json(
          { error: 'Firestore Admin indisponible.' },
          { status: 500 }
        );
      }
      await adminDb.collection('intervalsConnections').doc(userId).set({
        ...publicConnection,
        secretEncrypted,
      });
    } else {
      setSandboxIntervalsSecret(userId, secretEncrypted);
    }

    return NextResponse.json({
      ok: true,
      verification,
      connection: publicConnection,
      snapshot: null,
      coachedAthletes,
    });
  }

  // Flux athlète individuel (optionnel, ex. athlète autonome sans coach)
  const snapshot = await fetchIntervalsSnapshotServer(
    userId,
    verification.resolvedAthleteId,
    apiKey
  );

  const publicConnection: IntervalsConnectionPublic = {
    userId,
    intervalsAthleteId: verification.resolvedAthleteId,
    authMode: 'api_key',
    connectionScope: 'athlete',
    hasSecret: true,
    syncStatus: 'ok',
    lastSyncedAt: nowIso,
    updatedAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const batch = adminDb.batch();
    batch.set(adminDb.collection('intervalsConnections').doc(userId), {
      ...publicConnection,
      secretEncrypted,
    });
    batch.set(adminDb.collection('intervalsSnapshots').doc(snapshot.id), snapshot);
    batch.set(
      adminDb.collection('athleteProfiles').doc(userId),
      {
        userId,
        intervalsAthleteId: verification.resolvedAthleteId,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    batch.set(
      adminDb.collection('users').doc(userId),
      {
        consents: {
          healthDataConsentAt: nowIso,
        },
        updatedAt: nowIso,
      },
      { merge: true }
    );
    await batch.commit();
  } else {
    setSandboxIntervalsSecret(userId, secretEncrypted);
  }

  // secretEncrypted n'est JAMAIS renvoyé au client
  return NextResponse.json({
    ok: true,
    verification,
    connection: publicConnection,
    snapshot,
  });
}
