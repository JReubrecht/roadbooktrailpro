import { NextResponse } from 'next/server';
import { orderCheckoutSchema } from '@/lib/validation/schemas';
import type { Entitlement, Order } from '@/types/domain';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = orderCheckoutSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Paramètres de commande invalides.',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { userId, orderType, trainingPlanId, amountCents, simulateImmediatePayment } = parsed.data;
    const nowIso = new Date().toISOString();
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

    const order: Order = {
      id: orderId,
      userId,
      orderType,
      trainingPlanId,
      amountCents,
      currency: 'EUR',
      status: simulateImmediatePayment ? 'paid' : 'pending',
      provider: stripeConfigured ? 'stripe' : 'manual_demo',
      paidAt: simulateImmediatePayment ? nowIso : undefined,
      createdAt: nowIso,
    };

    let grantedEntitlement: Entitlement | null = null;
    if (order.status === 'paid') {
      grantedEntitlement = {
        id: `ent-ord-${Date.now()}`,
        userId,
        grantType: orderType === 'coaching_subscription' ? 'coaching_access' : 'plan_access',
        trainingPlanId: orderType === 'plan_purchase' ? trainingPlanId : undefined,
        source: orderType === 'coaching_subscription' ? 'subscription' : 'order',
        orderId,
        startsAt: nowIso,
        isActive: true,
        createdAt: nowIso,
      };
    }

    return NextResponse.json({
      order,
      entitlement: grantedEntitlement,
      stripeReady: stripeConfigured,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur lors de la création de commande.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
