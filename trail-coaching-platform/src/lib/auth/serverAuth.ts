import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { createInitialDemoState } from '@/lib/seed/demoData';
import type { UserRole } from '@/types/domain';

export interface ServerSession {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isAdmin: boolean;
  isCoachOrAdmin: boolean;
  source: 'firebase_admin' | 'dev_sandbox';
}

export function getConfiguredAdminEmails(): string[] {
  const combined = `${process.env.ADMIN_EMAILS || ''},${process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''}`;
  const set = new Set<string>();
  for (const part of combined.split(',')) {
    const email = part.trim().toLowerCase();
    if (email) {
      set.add(email);
    }
  }
  return Array.from(set);
}

export function getConfiguredCoachEmails(): string[] {
  const combined = `${process.env.COACH_EMAILS || ''},${process.env.NEXT_PUBLIC_COACH_EMAILS || ''}`;
  const set = new Set<string>();
  for (const part of combined.split(',')) {
    const email = part.trim().toLowerCase();
    if (email) {
      set.add(email);
    }
  }
  return Array.from(set);
}

function isCoachOrAdminRole(role: string | undefined): role is 'coach' | 'admin' {
  return role === 'coach' || role === 'admin';
}

function normalizeUserRole(
  role: unknown,
  isAdminEmail: boolean,
  isCoachEmail: boolean
): UserRole {
  if (role === 'admin' || isAdminEmail) return 'admin';
  if (role === 'coach' || isCoachEmail) return 'coach';
  return 'athlete';
}

/**
 * Vérifie le Bearer JWT Firebase côté serveur via Admin SDK (production),
 * et auto-provisionne / promeut les comptes coach listés dans ADMIN_EMAILS.
 * En développement local sans Firebase Admin configuré, autorise le sandbox dev via header.
 */
export async function verifyServerSession(
  request: NextRequest | Request
): Promise<ServerSession | null> {
  if (isFirebaseAdminConfigured()) {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return null;
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    if (!adminAuth || !adminDb) {
      return null;
    }

    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = (decoded.email || '').trim().toLowerCase();
      const adminEmails = getConfiguredAdminEmails();
      const coachEmails = getConfiguredCoachEmails();
      const isAdminEmail = Boolean(email && adminEmails.includes(email));
      const isCoachEmail = Boolean(!isAdminEmail && email && coachEmails.includes(email));
      const fallbackName =
        (typeof decoded.name === 'string' && decoded.name.trim()) ||
        (email ? email.split('@')[0] : 'Athlète');

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const nowIso = new Date().toISOString();

      let role: UserRole = isAdminEmail
        ? 'admin'
        : isCoachEmail
          ? 'coach'
          : 'athlete';
      let displayName = fallbackName;

      if (!userSnap.exists) {
        await userRef.set({
          id: uid,
          email: email || `${uid}@firebase.local`,
          displayName,
          role,
          ...(isCoachOrAdminRole(role) ? { coachActive: true } : {}),
          consents: {
            privacyAcceptedAt: nowIso,
            marketingOptIn: false,
          },
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        if (role === 'athlete') {
          await adminDb.collection('athleteProfiles').doc(uid).set(
            {
              userId: uid,
              tierStatus: 'free',
              isShowcaseFeatured: false,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      } else {
        const data = userSnap.data() || {};
        displayName =
          (typeof data.displayName === 'string' && data.displayName.trim()) || fallbackName;
        role = normalizeUserRole(data.role, isAdminEmail, isCoachEmail);

        if (isAdminEmail && data.role !== 'admin') {
          await userRef.set(
            {
              role: 'admin',
              coachActive: true,
              updatedAt: nowIso,
            },
            { merge: true }
          );
          role = 'admin';
        } else if (isCoachEmail && data.role === 'athlete') {
          await userRef.set(
            {
              role: 'coach',
              coachActive: true,
              updatedAt: nowIso,
            },
            { merge: true }
          );
          role = 'coach';
        }
      }

      return {
        uid,
        email,
        displayName,
        role,
        isAdmin: role === 'admin',
        isCoachOrAdmin: isCoachOrAdminRole(role),
        source: 'firebase_admin',
      };
    } catch {
      return null;
    }
  }

  // Fallback sandbox uniquement hors production lorsque Firebase Admin n'est pas configuré
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const sandboxUserId = request.headers.get('x-sandbox-user-id')?.trim();
  if (!sandboxUserId || sandboxUserId === 'visitor') {
    return null;
  }

  const seedUsers = createInitialDemoState().users;
  const seedMatch = seedUsers.find((u) => u.id === sandboxUserId);
  if (seedMatch) {
    return {
      uid: seedMatch.id,
      email: seedMatch.email,
      displayName: seedMatch.displayName,
      role: seedMatch.role,
      isAdmin: seedMatch.role === 'admin',
      isCoachOrAdmin: isCoachOrAdminRole(seedMatch.role),
      source: 'dev_sandbox',
    };
  }

  const headerRole = request.headers.get('x-sandbox-role')?.trim();
  const role: UserRole =
    headerRole === 'admin'
      ? 'admin'
      : headerRole === 'coach'
        ? 'coach'
        : 'athlete';

  return {
    uid: sandboxUserId,
    email: `${sandboxUserId}@sandbox.local`,
    displayName: sandboxUserId,
    role,
    isAdmin: role === 'admin',
    isCoachOrAdmin: isCoachOrAdminRole(role),
    source: 'dev_sandbox',
  };
}

export async function requireAuth(
  request: NextRequest | Request
): Promise<
  | { ok: true; session: ServerSession }
  | { ok: false; response: NextResponse }
> {
  const session = await verifyServerSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentification requise pour cette opération.' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, session };
}

export async function requireCoachOrAdmin(
  request: NextRequest | Request
): Promise<
  | { ok: true; session: ServerSession }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) {
    return authResult;
  }
  if (!authResult.session.isCoachOrAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Accès réservé au coach ou à l’administrateur.' },
        { status: 403 }
      ),
    };
  }
  return authResult;
}

export async function requireAdmin(
  request: NextRequest | Request
): Promise<
  | { ok: true; session: ServerSession }
  | { ok: false; response: NextResponse }
> {
  const authResult = await requireAuth(request);
  if (!authResult.ok) {
    return authResult;
  }
  if (!authResult.session.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Opération réservée à l’administrateur principal.' },
        { status: 403 }
      ),
    };
  }
  return authResult;
}
