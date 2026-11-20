import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { normalizeWaypointsForSave } from '@/lib/trail/roadbook';
import { roadbookSaveSchema } from '@/lib/validation/schemas';
import type { RoadbookWaypoint } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = roadbookSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données roadbook invalides', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const data = parsed.data;
  const requestedOwner =
    auth.session.isCoachOrAdmin && data.userId ? data.userId : auth.session.uid;

  const isPublicTemplate = auth.session.isCoachOrAdmin
    ? Boolean(data.isPublicTemplate)
    : false;

  const roadbookPayload = {
    ...data,
    waypoints: normalizeWaypointsForSave(data.waypoints as RoadbookWaypoint[]),
    userId: requestedOwner,
    isPublicTemplate,
    updatedAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const rbRef = adminDb.collection('roadbooks').doc(data.id);
    const existingSnap = await rbRef.get();
    if (existingSnap.exists) {
      const existingOwner = existingSnap.data()?.userId;
      if (
        existingOwner &&
        existingOwner !== auth.session.uid &&
        !auth.session.isCoachOrAdmin
      ) {
        return NextResponse.json(
          {
            error:
              'Vous ne pouvez pas écraser le roadbook d’un autre athlète ou un modèle coach.',
          },
          { status: 403 }
        );
      }
    }

    await rbRef.set(
      {
        createdAt: existingSnap.exists
          ? existingSnap.data()?.createdAt || nowIso
          : nowIso,
        ...roadbookPayload,
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true, roadbook: roadbookPayload });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let roadbookId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!roadbookId) {
    try {
      const body = (await request.json()) as { id?: string };
      roadbookId = (body.id || '').trim();
    } catch {
      // ignore empty body
    }
  }

  if (!roadbookId) {
    return NextResponse.json({ error: 'Identifiant roadbook requis.' }, { status: 400 });
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const rbRef = adminDb.collection('roadbooks').doc(roadbookId);
    const snap = await rbRef.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true, id: roadbookId });
    }

    const owner = snap.data()?.userId;
    if (owner !== auth.session.uid && !auth.session.isCoachOrAdmin) {
      return NextResponse.json(
        { error: 'Suppression non autorisée pour ce roadbook.' },
        { status: 403 }
      );
    }

    await rbRef.delete();
  }

  return NextResponse.json({ ok: true, id: roadbookId });
}
