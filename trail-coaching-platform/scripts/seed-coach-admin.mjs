#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const projectId =
  process.env.FIREBASE_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

function getAdcPath() {
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

const hasCert = Boolean(clientEmail && privateKey);
const useAdc =
  !hasCert &&
  (process.env.FIREBASE_USE_ADC?.trim().toLowerCase() === 'true' ||
    fs.existsSync(getAdcPath()));

if (!projectId || (!hasCert && !useAdc)) {
  console.error(
    'Erreur : FIREBASE_PROJECT_ID (ou NEXT_PUBLIC_FIREBASE_PROJECT_ID) et soit (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY), soit gcloud ADC (FIREBASE_USE_ADC=true) sont requis dans .env.local.'
  );
  process.exit(1);
}

const combinedAdminEmails = `${process.env.ADMIN_EMAILS || ''},${process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''}`;
const adminEmails = Array.from(
  new Set(
    combinedAdminEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
);

const combinedCoachEmails = `${process.env.COACH_EMAILS || ''},${process.env.NEXT_PUBLIC_COACH_EMAILS || ''}`;
const coachEmails = Array.from(
  new Set(
    combinedCoachEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => Boolean(e) && !adminEmails.includes(e))
  )
);

if (adminEmails.length === 0 && coachEmails.length === 0) {
  console.error(
    'Erreur : aucun email défini dans ADMIN_EMAILS / NEXT_PUBLIC_ADMIN_EMAILS / COACH_EMAILS.'
  );
  process.exit(1);
}

const credential = hasCert
  ? cert({ projectId, clientEmail, privateKey })
  : applicationDefault();

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential,
        projectId,
      });

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);
adminDb.settings({ ignoreUndefinedProperties: true });

async function seedCoachAndConfig() {
  const nowIso = new Date().toISOString();

  // 1. Initialiser platformConfig/global s'il n'existe pas
  const configRef = adminDb.collection('platformConfig').doc('global');
  const configSnap = await configRef.get();
  if (!configSnap.exists) {
    await configRef.set({
      promoBanner: {
        enabled: false,
        eyebrow: 'Programme Pilote — Places limitées',
        message: 'Pack Stratégie Jour J & Roadbook 89 € — 45 € déduits du 1er mois.',
        ctaLabel: 'Découvrir l’offre',
        ctaHref: '/coaching',
      },
      featureFlags: {
        programSalesEnabled: false,
      },
      customLogoUrl: null,
      updatedAt: nowIso,
      updatedBy: 'seed-coach-admin',
    });
    console.log('[OK] platformConfig/global créé (programSalesEnabled=false).');
  } else {
    console.log('[SKIP] platformConfig/global déjà existant.');
  }

  // 2. Promouvoir ADMIN_EMAILS en admin et COACH_EMAILS en coach dans Auth Claims + Firestore users/{uid}
  const roleAssignments = [
    ...adminEmails.map((email) => ({ email, role: 'admin' })),
    ...coachEmails.map((email) => ({ email, role: 'coach' })),
  ];

  for (const { email, role } of roleAssignments) {
    try {
      const authUser = await adminAuth.getUserByEmail(email);
      await adminAuth.setCustomUserClaims(authUser.uid, { role });

      await adminDb
        .collection('users')
        .doc(authUser.uid)
        .set(
          {
            id: authUser.uid,
            email,
            displayName:
              authUser.displayName ||
              (role === 'admin' ? 'Reubrecht Jérôme' : 'Coach MyKairn'),
            role,
            coachActive: true,
            consents: {
              privacyAcceptedAt: nowIso,
              marketingOptIn: false,
            },
            createdAt: authUser.metadata.creationTime || nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );

      console.log(`[OK] Compte ${role} promu : ${email} (uid=${authUser.uid})`);
    } catch (err) {
      console.warn(
        `[INFO] L'utilisateur Firebase Auth pour ${email} n'existe pas encore. Connectez-vous une première fois via /login puis relancez ce script, ou la promotion se fera automatiquement au premier appel API.`,
        err instanceof Error ? err.message : ''
      );
    }
  }
}

seedCoachAndConfig()
  .then(() => {
    console.log('Seed admin P0 terminé.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Échec seed-coach-admin :', err);
    process.exit(1);
  });
