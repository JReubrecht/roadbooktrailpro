import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { chatMessageCreateSchema } from '@/lib/validation/schemas';
import type { ChatMessage, ChatRoom } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = chatMessageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Message invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { roomId, content, attachment } = parsed.data;
  const nowIso = new Date().toISOString();
  const cleanContent = content.trim();

  const message: ChatMessage = {
    id: `msg-${crypto.randomUUID().slice(0, 12)}`,
    roomId,
    senderId: auth.session.uid,
    senderName: auth.session.displayName,
    senderRole: auth.session.role,
    content: cleanContent,
    ...(attachment ? { attachment } : {}),
    createdAt: nowIso,
  };

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

    const room = roomSnap.data() as ChatRoom;
    const isMember = (room.memberIds || []).includes(auth.session.uid);

    if (!isMember && !auth.session.isCoachOrAdmin) {
      return NextResponse.json(
        { error: 'Vous n’êtes pas membre de cette discussion.' },
        { status: 403 }
      );
    }

    if (room.isCoachOnlyPost && !auth.session.isCoachOrAdmin) {
      return NextResponse.json(
        { error: 'Seul le coach peut publier dans ce salon d’annonce.' },
        { status: 403 }
      );
    }

    const preview =
      room.type === 'direct'
        ? cleanContent.slice(0, 140)
        : `${auth.session.displayName} : ${cleanContent}`.slice(0, 140);

    const nextUnread: Record<string, number> = { ...(room.unreadBy || {}) };
    for (const memberId of room.memberIds || []) {
      nextUnread[memberId] =
        memberId === auth.session.uid ? 0 : (nextUnread[memberId] || 0) + 1;
    }

    const batch = adminDb.batch();
    batch.set(adminDb.collection('chatMessages').doc(message.id), message);
    batch.set(
      roomRef,
      {
        lastMessageAt: nowIso,
        lastMessagePreview: preview,
        unreadBy: nextUnread,
      },
      { merge: true }
    );
    await batch.commit();
  }

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
