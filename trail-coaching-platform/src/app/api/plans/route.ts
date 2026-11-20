import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCoachOrAdmin } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { trainingPlanUpsertSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  const auth = await requireCoachOrAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = trainingPlanUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Programme invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const planId = parsed.data.id || `plan-${crypto.randomUUID().slice(0, 8)}`;
  const slug =
    parsed.data.slug ||
    parsed.data.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const planPayload = {
    ...parsed.data,
    id: planId,
    slug,
    updatedAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    const planRef = adminDb.collection('trainingPlans').doc(planId);
    const snap = await planRef.get();
    await planRef.set(
      {
        createdAt: snap.exists ? snap.data()?.createdAt || nowIso : nowIso,
        ...planPayload,
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true, plan: planPayload }, { status: 201 });
}
