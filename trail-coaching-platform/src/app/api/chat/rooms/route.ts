import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import {
  chatRoomCreateSchema,
  chatRoomUpdateSchema,
} from '@/lib/validation/schemas';
import type { ChatRoom } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = chatRoomCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres de salon invalides', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, name, description, memberIds, isCoachOnlyPost } = parsed.data;

  if ((type === 'announcement' || isCoachOnlyPost) && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      {
        error:
          'Seul un coach ou administrateur peut créer un salon d’annonce ou restreint aux coachs.',
      },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const normalizedMembers = Array.from(
    new Set<string>([auth.session.uid, ...memberIds])
  );

  const room: ChatRoom = {
    id: `room-${crypto.randomUUID().slice(0, 12)}`,
    type,
    name: name.trim(),
    ...(description?.trim() ? { description: description.trim() } : {}),
    memberIds: normalizedMembers,
    createdBy: auth.session.uid,
    isCoachOnlyPost: Boolean(isCoachOnlyPost),
    lastMessageAt: nowIso,
    unreadBy: {},
    createdAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('chatRooms').doc(room.id).set(room);
  }

  return NextResponse.json({ ok: true, room }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = chatRoomUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Mise à jour de salon invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { roomId, name, description, pinnedMessage, memberIds } = parsed.data;

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const roomRef = adminDb.collection('chatRooms').doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: 'Salon introuvable.' }, { status: 404 });
    }

    const existing = roomSnap.data() as ChatRoom;
    const isCreator = existing.createdBy === auth.session.uid;
    const isSelfLeave =
      memberIds !== undefined &&
      name === undefined &&
      description === undefined &&
      pinnedMessage === undefined &&
      existing.memberIds.includes(auth.session.uid) &&
      !memberIds.includes(auth.session.uid) &&
      memberIds.every((id) => existing.memberIds.includes(id));

    if (!auth.session.isCoachOrAdmin && !isCreator && !isSelfLeave) {
      return NextResponse.json(
        { error: 'Seul le créateur ou le coach peut modifier ce salon.' },
        { status: 403 }
      );
    }

    const patch: Partial<ChatRoom> = {};
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description.trim();
    if (pinnedMessage !== undefined) patch.pinnedMessage = pinnedMessage.trim();
    if (memberIds !== undefined) {
      patch.memberIds = Array.from(new Set([existing.createdBy, ...memberIds]));
    }

    await roomRef.set(patch, { merge: true });
    return NextResponse.json({
      ok: true,
      room: { ...existing, ...patch },
    });
  }

  return NextResponse.json({ ok: true, roomId });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const roomId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!roomId) {
    return NextResponse.json({ error: 'Identifiant salon requis.' }, { status: 400 });
  }

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    const roomRef = adminDb.collection('chatRooms').doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ ok: true, id: roomId });
    }

    const existing = roomSnap.data() as ChatRoom;
    if (!auth.session.isCoachOrAdmin && existing.createdBy !== auth.session.uid) {
      return NextResponse.json(
        { error: 'Suppression réservée au créateur du salon ou au coach.' },
        { status: 403 }
      );
    }

    const msgsSnap = await adminDb
      .collection('chatMessages')
      .where('roomId', '==', roomId)
      .get();

    const refs = [roomRef, ...msgsSnap.docs.map((d) => d.ref)];
    for (let i = 0; i < refs.length; i += 400) {
      const batch = adminDb.batch();
      for (const ref of refs.slice(i, i + 400)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }

  return NextResponse.json({ ok: true, id: roomId });
}
