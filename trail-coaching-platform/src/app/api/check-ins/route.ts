import { NextResponse } from 'next/server';
import { checkInCreateSchema } from '@/lib/validation/schemas';
import { computeCoachAlertsForAthlete } from '@/lib/access/entitlements';
import type { CheckIn } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = checkInCreateSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Veuillez corriger les champs du check-in.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const checkIn: CheckIn = {
      id: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    const triggeredAlerts = computeCoachAlertsForAthlete('Athlète', checkIn.userId, null, [checkIn]);

    return NextResponse.json({
      checkIn,
      triggeredAlerts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la validation du check-in.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
