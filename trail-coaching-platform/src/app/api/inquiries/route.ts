import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { notifyCoachNewInquiry } from '@/lib/notifications/email';
import { coachingInquirySchema } from '@/lib/validation/schemas';
import type { CoachingInquiry } from '@/types/domain';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 6;

const globalRateLimiter = globalThis as typeof globalThis & {
  __mykairnInquiryRateMap?: Map<string, number[]>;
};

function isRateLimited(ip: string): boolean {
  if (!globalRateLimiter.__mykairnInquiryRateMap) {
    globalRateLimiter.__mykairnInquiryRateMap = new Map<string, number[]>();
  }
  const map = globalRateLimiter.__mykairnInquiryRateMap;
  const now = Date.now();
  const timestamps = (map.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    map.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  map.set(ip, timestamps);
  return false;
}

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      {
        error:
          'Trop de demandes envoyées récemment. Merci de patienter quelques minutes avant de réessayer.',
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const parsed = coachingInquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Formulaire incomplet ou invalide', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const inquiry: CoachingInquiry = {
    id: `inq-${crypto.randomUUID()}`,
    name: parsed.data.name,
    email: parsed.data.email,
    offerInterest: parsed.data.offerInterest,
    goal: parsed.data.goal,
    weeklyHours: parsed.data.weeklyHours,
    rgpdConsent: parsed.data.rgpdConsent,
    marketingOptIn: parsed.data.marketingOptIn,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseAdminConfigured()) {
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore Admin indisponible.' }, { status: 500 });
    }
    await adminDb.collection('coachingInquiries').doc(inquiry.id).set(inquiry);
  }

  await notifyCoachNewInquiry(inquiry);

  return NextResponse.json({ ok: true, inquiry }, { status: 201 });
}
