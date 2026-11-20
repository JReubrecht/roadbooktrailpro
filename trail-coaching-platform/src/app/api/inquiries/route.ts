import { NextResponse } from 'next/server';
import { coachingInquirySchema } from '@/lib/validation/schemas';
import type { CoachingInquiry } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = coachingInquirySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Veuillez vérifier les informations saisies dans le formulaire.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const inquiry: CoachingInquiry = {
      id: `inq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ inquiry, ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'envoi de la demande.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
