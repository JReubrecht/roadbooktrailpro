import { NextResponse } from 'next/server';
import { entitlementGrantSchema } from '@/lib/validation/schemas';
import type { Entitlement } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = entitlementGrantSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Attribution de droit refusée : rôle ou paramètres invalides.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 403 }
      );
    }

    const { userId, grantType, trainingPlanId, source, durationDays } = parsed.data;
    const now = new Date();
    let expiresAt: string | undefined;

    if (durationDays) {
      const exp = new Date(now);
      exp.setDate(exp.getDate() + durationDays);
      expiresAt = exp.toISOString();
    }

    const entitlement: Entitlement = {
      id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      grantType,
      trainingPlanId,
      source,
      startsAt: now.toISOString(),
      expiresAt,
      isActive: true,
      createdAt: now.toISOString(),
    };

    return NextResponse.json({ entitlement });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'attribution des droits.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
