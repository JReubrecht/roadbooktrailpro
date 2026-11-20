import { NextResponse } from 'next/server';
import { intervalsSyncSchema } from '@/lib/validation/schemas';
import { decryptIntervalsSecret } from '@/lib/intervals/crypto';
import { fetchIntervalsSnapshotServer } from '@/lib/intervals/client';
import type { IntervalsSnapshot } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = intervalsSyncSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Requête de synchronisation invalide.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { userId, intervalsAthleteId, secretEncrypted, demoMode } = parsed.data;

    // Si un secret chiffré réel AES-256-GCM est présent, on le déchiffre côté serveur uniquement et on appelle Intervals.icu
    if (secretEncrypted) {
      const apiKey = decryptIntervalsSecret(secretEncrypted);
      const snapshot = await fetchIntervalsSnapshotServer(userId, intervalsAthleteId, apiKey);
      return NextResponse.json({
        snapshot,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        mode: 'live_intervals',
      });
    }

    // Mode démonstration contrôlé pour les athlètes pilotes pré-chargés sans clé API personnelle dans l'environnement local
    if (demoMode) {
      const todayIso = new Date().toISOString().split('T')[0];
      const deltaCtl = userId === 'pilot-thomas' ? 1 : 2;
      const baseCtl = userId === 'pilot-thomas' ? 75 : userId === 'pilot-claire' ? 70 : 64;
      const baseAtl = userId === 'pilot-thomas' ? 96 : userId === 'pilot-claire' ? 72 : 56;
      const simulatedSnapshot: IntervalsSnapshot = {
        id: `${userId}_${todayIso}`,
        userId,
        snapshotDate: todayIso,
        ctl: baseCtl + deltaCtl,
        atl: baseAtl,
        tsb: baseCtl + deltaCtl - baseAtl,
        rampRate: userId === 'pilot-thomas' ? 4.8 : 2.9,
        weeklyDistanceKm: userId === 'pilot-thomas' ? 84.2 : 66.8,
        weeklyElevationM: userId === 'pilot-thomas' ? 4480 : 2990,
        weeklyDurationMin: userId === 'pilot-thomas' ? 630 : 480,
        wellnessReadiness: userId === 'pilot-thomas' ? 54 : 82,
        restingHrObserved: userId === 'pilot-thomas' ? 52 : 45,
        hrvRmssd: userId === 'pilot-thomas' ? 48 : 79,
        compliancePct: 97,
        fetchedAt: new Date().toISOString(),
      };

      return NextResponse.json({
        snapshot: simulatedSnapshot,
        syncStatus: 'ok',
        lastSyncedAt: new Date().toISOString(),
        mode: 'pilot_demo',
      });
    }

    return NextResponse.json(
      {
        error:
          'Aucune connexion Intervals.icu chiffrée trouvée pour cet athlète. Veuillez connecter votre clé API dans Paramètres.',
      },
      { status: 404 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Erreur lors de la synchronisation Intervals.icu.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
