import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_FEATURE_FLAGS } from '@/config/brand';
import { requireAuth } from '@/lib/auth/serverAuth';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { orderCheckoutSchema } from '@/lib/validation/schemas';
import type { Entitlement, Order } from '@/types/domain';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = orderCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Commande invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, orderType, trainingPlanId, amountCents } = parsed.data;

  if (userId !== auth.session.uid && !auth.session.isCoachOrAdmin) {
    return NextResponse.json(
      { error: 'Commande non autorisée pour cet utilisateur.' },
      { status: 403 }
    );
  }

  let authoritativeAmountCents = amountCents;
  let productTitle =
    orderType === 'coaching_subscription'
      ? 'Coaching Individuel MyKairn'
      : 'Programme Trail Autonome';

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }

    if (orderType === 'plan_purchase') {
      const configSnap = await adminDb.collection('platformConfig').doc('global').get();
      const salesEnabled = Boolean(
        configSnap.exists
          ? configSnap.data()?.featureFlags?.programSalesEnabled
          : DEFAULT_FEATURE_FLAGS.programSalesEnabled
      );

      if (!salesEnabled) {
        return NextResponse.json(
          { error: 'La vente de programmes autonomes est actuellement désactivée.' },
          { status: 403 }
        );
      }

      if (!trainingPlanId) {
        return NextResponse.json(
          { error: 'Identifiant du programme requis.' },
          { status: 400 }
        );
      }

      const planSnap = await adminDb.collection('trainingPlans').doc(trainingPlanId).get();
      if (!planSnap.exists || planSnap.data()?.status !== 'published') {
        return NextResponse.json(
          { error: 'Programme introuvable ou non publié.' },
          { status: 404 }
        );
      }

      const planData = planSnap.data()!;
      authoritativeAmountCents = Math.round(Number(planData.priceCents || 0));
      if (typeof planData.title === 'string' && planData.title.trim()) {
        productTitle = planData.title.trim();
      }
    }
  }

  const nowIso = new Date().toISOString();
  const orderId = `ord-${crypto.randomUUID()}`;
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

  if (stripeSecret) {
    const baseUrl =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('line_items[0][price_data][currency]', 'eur');
    params.set('line_items[0][price_data][product_data][name]', productTitle);
    params.set(
      'line_items[0][price_data][unit_amount]',
      String(authoritativeAmountCents)
    );
    params.set('line_items[0][quantity]', '1');
    params.set('success_url', `${baseUrl}/athlete?checkout=success`);
    params.set('cancel_url', `${baseUrl}/plans?checkout=cancelled`);
    params.set('client_reference_id', userId);
    params.set('metadata[orderId]', orderId);
    params.set('metadata[userId]', userId);
    params.set('metadata[orderType]', orderType);
    if (trainingPlanId) {
      params.set('metadata[trainingPlanId]', trainingPlanId);
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const stripeData = (await stripeRes.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!stripeRes.ok || !stripeData.url) {
      return NextResponse.json(
        { error: stripeData.error?.message || 'Erreur création session Stripe.' },
        { status: 502 }
      );
    }

    const pendingOrder: Order = {
      id: orderId,
      userId,
      orderType,
      ...(trainingPlanId ? { trainingPlanId } : {}),
      amountCents: authoritativeAmountCents,
      currency: 'EUR',
      status: 'pending',
      provider: 'stripe',
      providerCheckoutId: stripeData.id,
      createdAt: nowIso,
    };

    if (isFirebaseAdminConfigured()) {
      const adminDb = getAdminDb();
      if (adminDb) {
        await adminDb.collection('orders').doc(orderId).set(pendingOrder);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: 'stripe',
      checkoutUrl: stripeData.url,
      order: pendingOrder,
      entitlement: null,
    });
  }

  // Sans Stripe : INTERDIT de valider une commande payante en production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error:
          'Paiement Stripe requis en production : configurez STRIPE_SECRET_KEY avant d’accepter des commandes.',
      },
      { status: 503 }
    );
  }

  const simulatedOrder: Order = {
    id: orderId,
    userId,
    orderType,
    ...(trainingPlanId ? { trainingPlanId } : {}),
    amountCents: authoritativeAmountCents,
    currency: 'EUR',
    status: 'paid',
    provider: 'manual_demo',
    providerCheckoutId: `sim_sess_${crypto.randomUUID().slice(0, 12)}`,
    paidAt: nowIso,
    createdAt: nowIso,
  };

  const entitlement: Entitlement = {
    id: `ent-${crypto.randomUUID()}`,
    userId,
    grantType: orderType === 'coaching_subscription' ? 'coaching_access' : 'plan_access',
    ...(trainingPlanId ? { trainingPlanId } : {}),
    source: orderType === 'coaching_subscription' ? 'subscription' : 'order',
    orderId,
    startsAt: nowIso,
    isActive: true,
    createdAt: nowIso,
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (adminDb) {
      const batch = adminDb.batch();
      batch.set(adminDb.collection('orders').doc(orderId), simulatedOrder);
      batch.set(adminDb.collection('entitlements').doc(entitlement.id), entitlement);
      await batch.commit();
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'simulated_sandbox',
    order: simulatedOrder,
    entitlement,
  });
}
