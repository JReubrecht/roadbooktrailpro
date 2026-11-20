import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { communityPostCreateSchema } from '@/lib/validation/schemas';
import type { CommunityPost, TierStatus } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = communityPostCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Publication invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let authorTier: TierStatus = auth.session.isCoachOrAdmin ? 'coaching_paid' : 'free';
  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (adminDb) {
      const profileSnap = await adminDb
        .collection('athleteProfiles')
        .doc(auth.session.uid)
        .get();
      if (profileSnap.exists && typeof profileSnap.data()?.tierStatus === 'string') {
        authorTier = profileSnap.data()!.tierStatus as TierStatus;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const post: CommunityPost = {
    id: `post-${crypto.randomUUID().slice(0, 12)}`,
    userId: auth.session.uid,
    authorName: auth.session.displayName,
    authorTier,
    type: parsed.data.type,
    title: parsed.data.title,
    content: parsed.data.content,
    ...(parsed.data.distanceKm !== undefined
      ? { distanceKm: parsed.data.distanceKm }
      : {}),
    ...(parsed.data.elevationGainM !== undefined
      ? { elevationGainM: parsed.data.elevationGainM }
      : {}),
    ...(parsed.data.locationLabel
      ? { locationLabel: parsed.data.locationLabel }
      : {}),
    likesCount: 0,
    createdAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('communityPosts').doc(post.id).set(post);
  }

  return NextResponse.json({ ok: true, post }, { status: 201 });
}
