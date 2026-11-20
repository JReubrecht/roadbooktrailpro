import { NextResponse } from 'next/server';
import { intervalsConnectSchema } from '@/lib/validation/schemas';
import { encryptIntervalsSecret } from '@/lib/intervals/crypto';
import {
  fetchIntervalsSnapshotServer,
  verifyIntervalsConnectionServer,
} from '@/lib/intervals/client';
import type { IntervalsConnectionPublic, IntervalsSnapshot } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = intervalsConnectSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Données de connexion Intervals.icu invalides.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { userId, intervalsAthleteId, apiKey, authMode } = parsed.data;

    // 1. Vérification réelle côté serveur auprès d'Intervals.icu
    const verification = await verifyIntervalsConnectionServer(intervalsAthleteId, apiKey);

    // 2. Chiffrement AES-256-GCM côté serveur uniquement (la clé en clair n'est jamais retournée ni stockée en clair)
    const secretEncrypted = encryptIntervalsSecret(apiKey);

    // 3. Récupération du premier snapshot physiologique (CTL, ATL, TSB, HRV, volume 7j)
    let initialSnapshot: IntervalsSnapshot | null = null;
    try {
      initialSnapshot = await fetchIntervalsSnapshotServer(
        userId,
        verification.resolvedAthleteId,
        apiKey
      );
    } catch (syncErr) {
      console.warn('[API intervals/connect] Premier snapshot partiel:', syncErr);
    }

    const nowIso = new Date().toISOString();
    const publicConnection: IntervalsConnectionPublic & { secretEncrypted: string } = {
      userId,
      intervalsAthleteId: verification.resolvedAthleteId,
      authMode,
      hasSecret: true,
      secretEncrypted,
      syncStatus: 'ok',
      lastSyncedAt: nowIso,
      updatedAt: nowIso,
    };

    return NextResponse.json({
      connection: publicConnection,
      verification: {
        resolvedAthleteId: verification.resolvedAthleteId,
        athleteName: verification.athleteName,
        ctl: verification.ctl,
        atl: verification.atl,
        weightKg: verification.weightKg,
        restingHr: verification.restingHr,
      },
      snapshot: initialSnapshot,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Impossible de connecter le compte Intervals.icu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
