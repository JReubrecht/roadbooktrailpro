import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { downsampleGpxPoints } from '@/lib/firebase/roadbookAdapter';
import { findClosestPointIndex } from '@/lib/trail/geodesy';
import { normalizeWaypointsForSave } from '@/lib/trail/roadbook';
import { roadbookSaveSchema } from '@/lib/validation/schemas';
import type { GpxPoint, RoadbookWaypoint } from '@/types/domain';

const MAX_SAVED_ROADBOOK_POINTS = 1200;

function sanitizePointsForSave(rawPoints: Record<string, unknown>[]): GpxPoint[] {
  const clean: GpxPoint[] = [];
  for (const raw of rawPoints) {
    const lat = Number(raw.lat);
    const lon = Number(raw.lon ?? raw.lng);
    const ele = Number(raw.ele ?? 0);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      clean.push({
        lat,
        lon,
        ele: Number.isFinite(ele) ? ele : 0,
      });
    }
  }
  return clean;
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

  const isPublic = auth.session.isCoachOrAdmin
    ? Boolean(data.isPublic ?? data.isPublicTemplate)
    : false;
  const isPublicTemplate = auth.session.isCoachOrAdmin
    ? Boolean(data.isPublicTemplate ?? data.isPublic)
    : false;

  const parsedPoints = sanitizePointsForSave(data.points);
  const wasDownsampled = parsedPoints.length > MAX_SAVED_ROADBOOK_POINTS;
  const pointsForSave = downsampleGpxPoints(
    parsedPoints,
    MAX_SAVED_ROADBOOK_POINTS
  );

  const normalizedWaypoints = normalizeWaypointsForSave(
    data.waypoints as RoadbookWaypoint[]
  ).map((wp) => {
    const hasValidIdx =
      typeof wp.pointIndex === 'number' &&
      wp.pointIndex >= 0 &&
      wp.pointIndex < pointsForSave.length;
    if (pointsForSave.length === 0) {
      return { ...wp, pointIndex: 0 };
    }
    if (!wasDownsampled && hasValidIdx) {
      return wp;
    }
    return {
      ...wp,
      pointIndex: Math.max(0, findClosestPointIndex(wp.lat, wp.lon, pointsForSave)),
    };
  });
  normalizedWaypoints.sort((a, b) => a.pointIndex - b.pointIndex);

  const roadbookPayload = {
    ...data,
    points: pointsForSave,
    waypoints: normalizedWaypoints,
    userId: requestedOwner,
    isPublic,
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
