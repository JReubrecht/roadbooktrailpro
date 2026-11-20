import { NextResponse } from 'next/server';
import { chatRoomCreateSchema } from '@/lib/validation/schemas';
import type { ChatRoom } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = chatRoomCreateSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Paramètres de salon invalides.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type, name, description, memberIds, createdBy, isCoachOnlyPost } = parsed.data;
    const uniqueMembers = Array.from(new Set([createdBy, ...memberIds]));
    const nowIso = new Date().toISOString();

    const room: ChatRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      name,
      description: description || undefined,
      memberIds: uniqueMembers,
      createdBy,
      isCoachOnlyPost: Boolean(isCoachOnlyPost),
      lastMessageAt: nowIso,
      lastMessagePreview:
        type === 'group' || type === 'announcement' ? 'Salon créé.' : 'Nouvelle conversation.',
      unreadBy: Object.fromEntries(uniqueMembers.map((uid) => [uid, 0])),
      createdAt: nowIso,
    };

    return NextResponse.json({ room });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur création du salon.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
