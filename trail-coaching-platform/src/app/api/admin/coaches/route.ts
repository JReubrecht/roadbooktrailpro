import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, requireCoachOrAdmin } from '@/lib/auth/serverAuth';
import {
  getAdminAuth,
  getAdminDb,
  isFirebaseAdminConfigured,
  normalizeFirestoreDoc,
} from '@/lib/firebase/admin';
import { coachCreateSchema, coachUpdateSchema } from '@/lib/validation/schemas';
import type { AthleteProfile, UserDoc } from '@/types/domain';

export async function GET(request: NextRequest) {
  const auth = await requireCoachOrAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: 'sandbox',
      coaches: [],
    });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
  }

  const [usersSnap, connsSnap, profilesSnap] = await Promise.all([
    adminDb.collection('users').where('role', 'in', ['coach', 'admin']).get(),
    adminDb.collection('intervalsConnections').get(),
    adminDb.collection('athleteProfiles').get(),
  ]);

  const connMap = new Map<string, { hasSecret: boolean; coachedAthletesCount?: number }>();
  for (const cDoc of connsSnap.docs) {
    const data = cDoc.data();
    connMap.set(cDoc.id, {
      hasSecret: Boolean(data.secretEncrypted || data.hasSecret),
      coachedAthletesCount:
        typeof data.coachedAthletesCount === 'number'
          ? data.coachedAthletesCount
          : undefined,
    });
  }

  const athleteCounts = new Map<string, number>();
  for (const pDoc of profilesSnap.docs) {
    const p = normalizeFirestoreDoc<AthleteProfile>(pDoc.data(), pDoc.id);
    if (p.assignedCoachId) {
      athleteCounts.set(
        p.assignedCoachId,
        (athleteCounts.get(p.assignedCoachId) || 0) + 1
      );
    }
  }

  const coaches = usersSnap.docs.map((d) => {
    const u = normalizeFirestoreDoc<UserDoc>(d.data(), d.id);
    const conn = connMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      coachSpecialty: u.coachSpecialty,
      coachBio: u.coachBio,
      coachActive: u.coachActive ?? true,
      hasIntervalsKey: Boolean(conn?.hasSecret),
      coachedAthletesCount: conn?.coachedAthletesCount,
      assignedAthletesCount: athleteCounts.get(u.id) || 0,
    };
  });

  return NextResponse.json({
    ok: true,
    mode: 'firebase_admin',
    coaches,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = coachCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données coach invalides', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const email = parsed.data.email.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  const role = parsed.data.role;
  const coachSpecialty = parsed.data.coachSpecialty?.trim() || undefined;
  const coachBio = parsed.data.coachBio?.trim() || undefined;

  if (!isFirebaseAdminConfigured()) {
    const sandboxCoach: UserDoc = {
      id: `coach-${crypto.randomUUID().slice(0, 8)}`,
      email,
      displayName,
      role,
      ...(coachSpecialty ? { coachSpecialty } : {}),
      ...(coachBio ? { coachBio } : {}),
      coachActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return NextResponse.json(
      { ok: true, mode: 'sandbox', coach: sandboxCoach },
      { status: 201 }
    );
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin indisponible.' },
      { status: 500 }
    );
  }

  try {
    let uid: string;
    let createdAuthAccount = false;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email,
        displayName,
      });
      uid = created.uid;
      createdAuthAccount = true;
    }

    await adminAuth.setCustomUserClaims(uid, { role });

    const userRef = adminDb.collection('users').doc(uid);
    const existingSnap = await userRef.get();
    const coachDoc: UserDoc = {
      id: uid,
      email,
      displayName,
      role,
      ...(coachSpecialty ? { coachSpecialty } : {}),
      ...(coachBio ? { coachBio } : {}),
      coachActive: true,
      consents: existingSnap.exists
        ? existingSnap.data()?.consents || { privacyAcceptedAt: nowIso, marketingOptIn: false }
        : { privacyAcceptedAt: nowIso, marketingOptIn: false },
      createdAt: existingSnap.exists
        ? (existingSnap.data()?.createdAt as string) || nowIso
        : nowIso,
      updatedAt: nowIso,
    };

    await userRef.set(coachDoc, { merge: true });

    return NextResponse.json(
      { ok: true, mode: 'firebase_admin', createdAuthAccount, coach: coachDoc },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/admin/coaches] Erreur:', err);
    return NextResponse.json(
      { error: 'Impossible de créer ou promouvoir ce coach.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = coachUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Mise à jour coach invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, displayName, role, coachSpecialty, coachBio, coachActive } = parsed.data;
  const nowIso = new Date().toISOString();

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: 'sandbox',
      userId,
      patch: { displayName, role, coachSpecialty, coachBio, coachActive, updatedAt: nowIso },
    });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponible.' }, { status: 500 });
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
  }

  const existing = normalizeFirestoreDoc<UserDoc>(userSnap.data()!, userSnap.id);

  // Garde-fou : toujours conserver au moins 1 administrateur actif
  const removesAdminPower =
    existing.role === 'admin' &&
    ((role !== undefined && role !== 'admin') || coachActive === false);

  if (removesAdminPower) {
    const adminsSnap = await adminDb
      .collection('users')
      .where('role', '==', 'admin')
      .get();
    const remainingActiveAdmins = adminsSnap.docs.filter((d) => {
      if (d.id === userId) return false;
      const dData = d.data();
      return dData.coachActive !== false;
    });
    if (remainingActiveAdmins.length === 0) {
      return NextResponse.json(
        {
          error:
            'Action refusée : la plateforme doit conserver au moins un administrateur actif.',
        },
        { status: 400 }
      );
    }
  }

  const patch: Record<string, unknown> = {
    updatedAt: nowIso,
  };
  if (displayName !== undefined) patch.displayName = displayName;
  if (role !== undefined) patch.role = role;
  if (coachSpecialty !== undefined) patch.coachSpecialty = coachSpecialty;
  if (coachBio !== undefined) patch.coachBio = coachBio;
  if (coachActive !== undefined) patch.coachActive = coachActive;

  await userRef.set(patch, { merge: true });
  if (role !== undefined) {
    await adminAuth.setCustomUserClaims(userId, { role }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    coach: { ...existing, ...patch },
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const userId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!userId) {
    return NextResponse.json(
      { error: 'Identifiant coach requis.' },
      { status: 400 }
    );
  }

  if (userId === auth.session.uid) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas retirer vos propres droits administrateur.' },
      { status: 400 }
    );
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: true, mode: 'sandbox', userId });
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin indisponible.' }, { status: 500 });
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ ok: true, userId });
  }

  const existing = userSnap.data() || {};
  if (existing.role === 'admin') {
    const adminsSnap = await adminDb
      .collection('users')
      .where('role', '==', 'admin')
      .get();
    const otherActive = adminsSnap.docs.filter(
      (d) => d.id !== userId && d.data().coachActive !== false
    );
    if (otherActive.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de retirer le dernier administrateur actif.' },
        { status: 400 }
      );
    }
  }

  const nowIso = new Date().toISOString();
  const assignedProfilesSnap = await adminDb
    .collection('athleteProfiles')
    .where('assignedCoachId', '==', userId)
    .get();

  const batch = adminDb.batch();
  batch.set(
    userRef,
    {
      role: 'athlete',
      coachActive: false,
      updatedAt: nowIso,
    },
    { merge: true }
  );
  for (const pDoc of assignedProfilesSnap.docs) {
    batch.update(pDoc.ref, {
      assignedCoachId: FieldValue.delete(),
      updatedAt: nowIso,
    });
  }
  await batch.commit();

  await adminAuth.setCustomUserClaims(userId, { role: 'athlete' }).catch(() => {});

  return NextResponse.json({ ok: true, userId });
}
