import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { communityLikeSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = communityLikeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Identifiant publication invalide.' },
      { status: 400 }
    );
  }

  const { postId } = parsed.data;

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const postRef = adminDb.collection('communityPosts').doc(postId);
    const snap = await postRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Publication introuvable.' }, { status: 404 });
    }

    await postRef.update({
      likesCount: FieldValue.increment(1),
    });

    const updated = await postRef.get();
    return NextResponse.json({
      ok: true,
      postId,
      likesCount: Number(updated.data()?.likesCount || 0),
    });
  }

  return NextResponse.json({ ok: true, postId });
}
