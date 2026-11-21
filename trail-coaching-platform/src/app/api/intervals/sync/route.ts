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

  if (demoMode && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'La synchronisation simulée est désactivée en production.' },
      { status: 400 }
    );
  }

  let storedAssignedCoachId: string | undefined;
  let storedProfileIntervalsId = '';
  let athleteConnIntervalsId = '';
  let athleteConnScope: string | undefined;
  let athleteSecretEncrypted: string | null = null;
  let coachSecretEncrypted: string | null = null;

  const adminDb = isFirebaseAdminConfigured() ? getAdminDb() : null;
  if (isFirebaseAdminConfigured() && !adminDb) {
    return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
  }

  if (adminDb) {
    const [profileSnap, athleteConnSnap] = await Promise.all([
      adminDb.collection('athleteProfiles').doc(userId).get(),
      adminDb.collection('intervalsConnections').doc(userId).get(),
    ]);

    if (profileSnap.exists) {
      const pData = profileSnap.data() || {};
      if (typeof pData.assignedCoachId === 'string' && pData.assignedCoachId.trim()) {
        storedAssignedCoachId = pData.assignedCoachId.trim();
      }
      if (typeof pData.intervalsAthleteId === 'string' && pData.intervalsAthleteId.trim()) {
        storedProfileIntervalsId = pData.intervalsAthleteId.trim();
      }
    }

    if (athleteConnSnap.exists) {
      const cData = athleteConnSnap.data() || {};
      athleteConnScope =
        typeof cData.connectionScope === 'string' ? cData.connectionScope : undefined;
      if (typeof cData.intervalsAthleteId === 'string' && cData.intervalsAthleteId.trim()) {
        athleteConnIntervalsId = cData.intervalsAthleteId.trim();
      }
      if (
        athleteConnScope !== 'coach' &&
        typeof cData.secretEncrypted === 'string' &&
        cData.secretEncrypted.trim()
      ) {
        athleteSecretEncrypted = cData.secretEncrypted.trim();
      }
    }
  } else {
    athleteSecretEncrypted = getSandboxIntervalsSecret(userId);
  }

  // Vérification d'autorisation multi-coachs stricte
  if (!auth.session.isAdmin) {
    if (auth.session.role === 'coach') {
      const isSelf = userId === auth.session.uid;
      const isAssignedAthlete = Boolean(
        adminDb
          ? storedAssignedCoachId === auth.session.uid
          : true
      );
      if (!isSelf && !isAssignedAthlete) {
        return NextResponse.json(
          { error: 'Cet athlète est assigné à un autre coach.' },
          { status: 403 }
        );
      }
    } else if (userId !== auth.session.uid) {
      return NextResponse.json(
        { error: 'Synchronisation non autorisée pour cet athlète.' },
        { status: 403 }
      );
    }
  }

  const effectiveCoachUid =
    storedAssignedCoachId ||
    (auth.session.isCoachOrAdmin && userId !== auth.session.uid
      ? auth.session.uid
      : undefined);

  const athleteIntervalsId =
    storedProfileIntervalsId ||
    athleteConnIntervalsId ||
    parsed.data.intervalsAthleteId?.trim() ||
    '';

  if (effectiveCoachUid && athleteIntervalsId && athleteIntervalsId !== '0') {
    if (adminDb) {
      const coachConnSnap = await adminDb
        .collection('intervalsConnections')
        .doc(effectiveCoachUid)
        .get();
      if (coachConnSnap.exists) {
        const cData = coachConnSnap.data() || {};
        if (typeof cData.secretEncrypted === 'string' && cData.secretEncrypted.trim()) {
          coachSecretEncrypted = cData.secretEncrypted.trim();
        }
      }
    } else {
      coachSecretEncrypted = getSandboxIntervalsSecret(effectiveCoachUid);
    }
  }

  let selectedSecret: string | null = null;
  let syncedVia: 'coach_key' | 'athlete_key' | 'sandbox' = 'sandbox';
  let targetIdForFetch = athleteIntervalsId || '0';

  if (coachSecretEncrypted && athleteIntervalsId && athleteIntervalsId !== '0') {
    selectedSecret = coachSecretEncrypted;
    syncedVia = 'coach_key';
    targetIdForFetch = athleteIntervalsId;
  } else if (athleteSecretEncrypted) {
    selectedSecret = athleteSecretEncrypted;
    syncedVia = 'athlete_key';
    targetIdForFetch = athleteIntervalsId || '0';
  }

  const effectiveDemoMode = Boolean(
    demoMode && process.env.NODE_ENV !== 'production' && !selectedSecret
  );

  let apiKey: string | undefined;
  if (selectedSecret) {
    try {
      apiKey = decryptIntervalsSecret(selectedSecret);
    } catch {
      return NextResponse.json(
        { error: 'Impossible de déchiffrer le secret Intervals.icu côté serveur.' },
        { status: 500 }
      );
    }
  } else if (!effectiveDemoMode) {
    return NextResponse.json(
      {
        error:
          'Impossible de synchroniser : associez un ID Intervals.icu à l’athlète et connectez la clé API Coach (ou une clé personnelle).',
      },
      { status: 400 }
    );
  }

  const statusConnDocId =
    syncedVia === 'coach_key' && effectiveCoachUid ? effectiveCoachUid : userId;

  try {
    const snapshot = apiKey
      ? await fetchIntervalsSnapshotServer(userId, targetIdForFetch, apiKey)
      : buildSandboxSnapshot(userId);

    const nowIso = new Date().toISOString();

    if (adminDb) {
      const batch = adminDb.batch();
      batch.set(adminDb.collection('intervalsSnapshots').doc(snapshot.id), snapshot);
      if (syncedVia !== 'sandbox') {
        batch.set(
          adminDb.collection('intervalsConnections').doc(statusConnDocId),
          {
            syncStatus: 'ok',
            lastSyncedAt: nowIso,
            lastErrorMessage: undefined,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      snapshot,
      lastSyncedAt: nowIso,
      syncedVia,
      ...(syncedVia === 'coach_key' && effectiveCoachUid
        ? { syncedByCoachId: effectiveCoachUid }
        : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur synchronisation Intervals.icu';
    if (adminDb && syncedVia !== 'sandbox') {
      await adminDb
        .collection('intervalsConnections')
        .doc(statusConnDocId)
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
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
