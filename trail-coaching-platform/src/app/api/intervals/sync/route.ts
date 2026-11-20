import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import {
  getAdminDb,
  getSandboxIntervalsSecret,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import { fetchIntervalsSnapshotServer } from '@/lib/intervals/client';
import { decryptIntervalsSecret } from '@/lib/intervals/crypto';
import { intervalsSyncSchema } from '@/lib/validation/schemas';
import type { IntervalsSnapshot } from '@/types/domain';

function buildSandboxSnapshot(userId: string): IntervalsSnapshot {
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  return {
    id: `${userId}_${todayIso}`,
    userId,
    snapshotDate: todayIso,
    ctl: 68,
    atl: 62,
    tsb: 6,
    rampRate: 2.1,
    weeklyDistanceKm: 58.4,
    weeklyElevationM: 2450,
    weeklyDurationMin: 410,
    wellnessReadiness: 81,
    restingHrObserved: 47,
    hrvRmssd: 66,
    compliancePct: 92,
    fetchedAt: now.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = intervalsSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, demoMode } = parsed.data;

  if (userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Synchronisation non autorisée pour cet athlète.' },
      { status: 403 }
    );
  }

  if (demoMode && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'La synchronisation simulée est désactivée en production.' },
      { status: 400 }
    );
  }

  let storedAthleteId = parsed.data.intervalsAthleteId?.trim() || '0';
  let secretEncrypted: string | null = null;

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    const connSnap = await adminDb.collection('intervalsConnections').doc(userId).get();
    if (connSnap.exists) {
      const data = connSnap.data() || {};
      if (typeof data.intervalsAthleteId === 'string' && data.intervalsAthleteId.trim()) {
        storedAthleteId = data.intervalsAthleteId.trim();
      }
      if (typeof data.secretEncrypted === 'string' && data.secretEncrypted.trim()) {
        secretEncrypted = data.secretEncrypted.trim();
      }
    }
  } else {
    secretEncrypted = getSandboxIntervalsSecret(userId);
  }

  const effectiveDemoMode = Boolean(
    demoMode && process.env.NODE_ENV !== 'production' && !secretEncrypted
  );

  let apiKey: string | undefined;
  if (secretEncrypted) {
    try {
      apiKey = decryptIntervalsSecret(secretEncrypted);
    } catch {
      return NextResponse.json(
        { error: 'Impossible de déchiffrer le secret Intervals.icu côté serveur.' },
        { status: 500 }
      );
    }
  } else if (!effectiveDemoMode) {
    return NextResponse.json(
      { error: 'Aucune clé API Intervals.icu connectée sur ce compte.' },
      { status: 400 }
    );
  }

  try {
    const snapshot = apiKey
      ? await fetchIntervalsSnapshotServer(userId, storedAthleteId, apiKey)
      : buildSandboxSnapshot(userId);

    const nowIso = new Date().toISOString();

    if (isFirebaseAdminConfigured()) {
      const adminDb = getAdminDb();
      if (adminDb) {
        const batch = adminDb.batch();
        batch.set(adminDb.collection('intervalsSnapshots').doc(snapshot.id), snapshot);
        batch.set(
          adminDb.collection('intervalsConnections').doc(userId),
          {
            syncStatus: 'ok',
            lastSyncedAt: nowIso,
            lastErrorMessage: undefined,
            updatedAt: nowIso,
          },
          { merge: true }
        );
        await batch.commit();
      }
    }

    return NextResponse.json({
      ok: true,
      snapshot,
      lastSyncedAt: nowIso,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur synchronisation Intervals.icu';
    if (isFirebaseAdminConfigured()) {
      const adminDb = getAdminDb();
      if (adminDb) {
        await adminDb
          .collection('intervalsConnections')
          .doc(userId)
          .set(
            {
              syncStatus: 'error',
              lastErrorMessage: msg,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
          .catch(() => {});
      }
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
