'use client';

import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';

const SANDBOX_PERSONA_STORAGE_KEY = 'mykairn_coach_active_persona_v1';

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (!headers.has('Authorization') && isFirebaseConfigured && firebaseAuth) {
    try {
      if (
        'authStateReady' in firebaseAuth &&
        typeof firebaseAuth.authStateReady === 'function'
      ) {
        await firebaseAuth.authStateReady();
      }
      const user = firebaseAuth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    } catch {
      // L'API retournera 401 si un token valide est requis
    }
  } else if (
    !isFirebaseConfigured &&
    typeof window !== 'undefined' &&
    !headers.has('x-sandbox-user-id')
  ) {
    try {
      const activeId = window.localStorage.getItem(SANDBOX_PERSONA_STORAGE_KEY);
      if (activeId && activeId !== 'visitor') {
        headers.set('x-sandbox-user-id', activeId);
      }
    } catch {
      // ignore localStorage errors
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
