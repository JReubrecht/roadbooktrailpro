import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

interface AdminSingletons {
  app: App;
  auth: Auth;
  db: Firestore;
}

const globalForFirebaseAdmin = globalThis as typeof globalThis & {
  __mykairnAdminSingletons?: AdminSingletons;
  __mykairnSandboxSecrets?: Map<string, string>;
};

export function getFirebaseAdminProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    ''
  );
}

function getFirebaseAdminClientEmail(): string {
  return process.env.FIREBASE_CLIENT_EMAIL?.trim() || '';
}

function getFirebaseAdminPrivateKey(): string {
  const raw = process.env.FIREBASE_PRIVATE_KEY || '';
  return raw.replace(/\\n/g, '\n').trim();
}

function hasServiceAccountCredentials(): boolean {
  return Boolean(getFirebaseAdminClientEmail() && getFirebaseAdminPrivateKey());
}

function getAdcCredentialsPath(): string {
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (explicit) return explicit;
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(
      process.env.APPDATA,
      'gcloud',
      'application_default_credentials.json'
    );
  }
  return path.join(
    os.homedir(),
    '.config',
    'gcloud',
    'application_default_credentials.json'
  );
}

export function hasAdcCredentials(): boolean {
  if (hasServiceAccountCredentials()) return false;
  if (process.env.VERCEL === '1') return false;
  const useAdc =
    process.env.FIREBASE_USE_ADC?.trim().toLowerCase() === 'true' ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  if (!useAdc) return false;
  const adcPath = getAdcCredentialsPath();
  return Boolean(adcPath && fs.existsSync(/*turbopackIgnore: true*/ adcPath));
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    getFirebaseAdminProjectId() &&
      (hasServiceAccountCredentials() || hasAdcCredentials())
  );
}

function ensureAdminSingletons(): AdminSingletons | null {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }

  if (globalForFirebaseAdmin.__mykairnAdminSingletons) {
    return globalForFirebaseAdmin.__mykairnAdminSingletons;
  }

  const projectId = getFirebaseAdminProjectId();
  const credential = hasServiceAccountCredentials()
    ? cert({
        projectId,
        clientEmail: getFirebaseAdminClientEmail(),
        privateKey: getFirebaseAdminPrivateKey(),
      })
    : applicationDefault();

  const existingApps = getApps();
  const app =
    existingApps.length > 0
      ? existingApps[0]
      : initializeApp({
          credential,
          projectId,
        });

  const auth = getAuth(app);
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // ignore if settings already applied during HMR
  }

  const singletons: AdminSingletons = { app, auth, db };
  globalForFirebaseAdmin.__mykairnAdminSingletons = singletons;
  return singletons;
}

export function getAdminAuth(): Auth | null {
  return ensureAdminSingletons()?.auth ?? null;
}

export function getAdminDb(): Firestore | null {
  return ensureAdminSingletons()?.db ?? null;
}

function getSandboxSecretMap(): Map<string, string> | null {
  if (process.env.NODE_ENV === 'production' || isFirebaseAdminConfigured()) {
    return null;
  }
  if (!globalForFirebaseAdmin.__mykairnSandboxSecrets) {
    globalForFirebaseAdmin.__mykairnSandboxSecrets = new Map<string, string>();
  }
  return globalForFirebaseAdmin.__mykairnSandboxSecrets;
}

export function setSandboxIntervalsSecret(userId: string, secretEncrypted: string): void {
  const map = getSandboxSecretMap();
  if (!map) return;
  map.set(userId, secretEncrypted);
}

export function getSandboxIntervalsSecret(userId: string): string | null {
  const map = getSandboxSecretMap();
  if (!map) return null;
  return map.get(userId) ?? null;
}

export function deleteSandboxIntervalsSecret(userId: string): void {
  const map = getSandboxSecretMap();
  if (!map) return;
  map.delete(userId);
}

/**
 * Normalise les champs Firestore (Timestamp -> ISO string) pour sérialisation JSON sûre.
 */
export function normalizeFirestoreDoc<T>(
  data: Record<string, unknown>,
  docId?: string
): T {
  const convertValue = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (
      typeof val === 'object' &&
      val !== null &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if (Array.isArray(val)) {
      return val.map(convertValue);
    }
    if (typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = convertValue(v);
      }
      return out;
    }
    return val;
  };

  const normalized = convertValue(data) as Record<string, unknown>;
  if (docId && !normalized.id) {
    normalized.id = docId;
  }
  return normalized as T;
}
