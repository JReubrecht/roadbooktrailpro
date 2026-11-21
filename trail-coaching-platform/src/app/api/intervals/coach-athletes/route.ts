import { NextRequest, NextResponse } from 'next/server';
import { requireCoachOrAdmin } from '@/lib/auth/serverAuth';
import {
  getAdminDb,
  getSandboxIntervalsSecret,
  isFirebaseAdminConfigured,
} from '@/lib/firebase/admin';
import { fetchCoachIntervalsRosterServer } from '@/lib/intervals/client';
import { decryptIntervalsSecret } from '@/lib/intervals/crypto';
import type { IntervalsCoachedAthlete } from '@/types/domain';

const SANDBOX_ROSTER: IntervalsCoachedAthlete[] = [
  {
    intervalsAthleteId: 'i412890',
    name: 'Claire Morel',
    email: 'claire.morel@exemple.fr',
    ctl: 68,
    atl: 74,
    permission: 'WRITE',
  },
  {
    intervalsAthleteId: 'i508231',
    name: 'Thomas Garnier',
    email: 'thomas.garnier@exemple.fr',
    ctl: 54,
    atl: 82,
    permission: 'WRITE',
  },
  {
    intervalsAthleteId: 'i619442',
    name: 'Lucie Bertrand',
    email: 'lucie.bertrand@exemple.fr',
    ctl: 73,
    atl: 69,
    permission: 'WRITE',
  },
  {
    intervalsAthleteId: 'i731204',
    name: 'Marc Delacroix',
    email: 'marc.delacroix@exemple.fr',
    ctl: 61,
    atl: 58,
    permission: 'READ',
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireCoachOrAdmin(request);
  if (!auth.ok) return auth.response;

  const requestedCoachId = request.nextUrl.searchParams.get('coachId')?.trim();
  const coachUid =
    auth.session.isAdmin && requestedCoachId ? requestedCoachId : auth.session.uid;

  let secretEncrypted: string | null = null;
  let coachIntervalsId = '0';

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    const connSnap = await adminDb.collection('intervalsConnections').doc(coachUid).get();
    if (connSnap.exists) {
      const data = connSnap.data() || {};
      if (typeof data.secretEncrypted === 'string' && data.secretEncrypted.trim()) {
        secretEncrypted = data.secretEncrypted.trim();
      }
      if (typeof data.intervalsAthleteId === 'string' && data.intervalsAthleteId.trim()) {
        coachIntervalsId = data.intervalsAthleteId.trim();
      }
    }
  } else {
    secretEncrypted = getSandboxIntervalsSecret(coachUid);
  }

  if (secretEncrypted) {
    let apiKey: string;
    try {
      apiKey = decryptIntervalsSecret(secretEncrypted);
    } catch {
      return NextResponse.json(
        { error: 'Impossible de déchiffrer la clé API Coach Intervals.icu.' },
        { status: 500 }
      );
    }

    try {
      const athletes = await fetchCoachIntervalsRosterServer(apiKey, coachIntervalsId);
      const nowIso = new Date().toISOString();

      if (isFirebaseAdminConfigured()) {
        const adminDb = getAdminDb();
        if (adminDb) {
          await adminDb
            .collection('intervalsConnections')
            .doc(coachUid)
            .set(
              {
                coachedAthletesCount: athletes.length,
                lastSyncedAt: nowIso,
                updatedAt: nowIso,
              },
              { merge: true }
            )
            .catch(() => {});
        }
      }

      return NextResponse.json({
        ok: true,
        coachId: coachUid,
        source: 'live' as const,
        athletes,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossible de récupérer vos athlètes depuis Intervals.icu.';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (process.env.NODE_ENV !== 'production' && !isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      coachId: coachUid,
      source: 'sandbox' as const,
      athletes: SANDBOX_ROSTER,
    });
  }

  return NextResponse.json(
    {
      error:
        'Connectez d’abord la clé API Coach Intervals.icu pour importer votre liste d’athlètes.',
    },
    { status: 400 }
  );
}
