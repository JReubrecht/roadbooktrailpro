import { NextResponse } from 'next/server';
import { chatMessageCreateSchema } from '@/lib/validation/schemas';
import type { ChatMessage } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = chatMessageCreateSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Message invalide.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ message });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'envoi du message.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
