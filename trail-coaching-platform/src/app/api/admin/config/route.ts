import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { adminConfigUpdateSchema } from '@/lib/validation/schemas';

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = adminConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Configuration invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    updatedAt: nowIso,
    updatedBy: auth.session.uid,
  };

  if (parsed.data.promoBanner !== undefined) {
    payload.promoBanner = parsed.data.promoBanner;
  }
  if (parsed.data.featureFlags !== undefined) {
    payload.featureFlags = parsed.data.featureFlags;
  }
  if (parsed.data.customLogoUrl !== undefined) {
    payload.customLogoUrl = parsed.data.customLogoUrl;
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('platformConfig').doc('global').set(payload, { merge: true });
  }

  return NextResponse.json({
    ok: true,
    ...payload,
  });
}
