#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
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

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    'Erreur : FIREBASE_PROJECT_ID (ou NEXT_PUBLIC_FIREBASE_PROJECT_ID), FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY sont requis dans .env.local.'
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

if (adminEmails.length === 0) {
  console.error('Erreur : aucun email défini dans ADMIN_EMAILS ou NEXT_PUBLIC_ADMIN_EMAILS.');
  process.exit(1);
}

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
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

  // 2. Promouvoir chaque email admin en coach dans Auth Claims + Firestore users/{uid}
  for (const email of adminEmails) {
    try {
      const authUser = await adminAuth.getUserByEmail(email);
      await adminAuth.setCustomUserClaims(authUser.uid, { role: 'coach' });

      await adminDb
        .collection('users')
        .doc(authUser.uid)
        .set(
          {
            id: authUser.uid,
            email,
            displayName: authUser.displayName || 'Coach MyKairn',
            role: 'coach',
            locale: 'fr',
            consents: {
              privacyAcceptedAt: nowIso,
              marketingOptIn: false,
            },
            createdAt: authUser.metadata.creationTime || nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );

      console.log(`[OK] Compte coach promu : ${email} (uid=${authUser.uid})`);
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
