#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const PRIMARY_ADMIN_UID = 'WMaiPTO73LdzaAUMQB0j4Uzr2Gy1';
const PRIMARY_ADMIN_EMAIL = 'reubrechtj@gmail.com';
const PRIMARY_ADMIN_NAME = 'Reubrecht Jérôme';
const DEFAULT_BACKUP_DIR =
  'C:\\Users\\Shadow\\.gemini\\antigravity\\brain\\4f23de51-93cf-48c7-9d73-ebe7d344708b\\scratch';

const BACKUP_COLLECTIONS = [
  'users',
  'roadbooks',
  'official_traces',
  'workout_templates',
  'coaches',
  'athleteProfiles',
  'intervalsConnections',
  'intervalsSnapshots',
  'checkIns',
  'platformConfig',
  'trainingPlans',
  'orders',
  'entitlements',
  'communityPosts',
  'communityChallenges',
  'coachingInquiries',
  'chatRooms',
  'chatMessages',
];

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

const projectId =
  process.env.FIREBASE_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
  'mykairn-d7d20';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n')
  .trim();
const hasCert = Boolean(clientEmail && privateKey);
const useAdc =
  !hasCert &&
  (process.env.FIREBASE_USE_ADC?.trim().toLowerCase() === 'true' ||
    fs.existsSync(getAdcPath()));

if (!projectId || (!hasCert && !useAdc)) {
  console.error(
    'Erreur : identifiants Firebase Admin manquants (service account ou ADC).'
  );
  process.exit(1);
}

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: hasCert
          ? cert({ projectId, clientEmail, privateKey })
          : applicationDefault(),
        projectId,
      });

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);
adminDb.settings({ ignoreUndefinedProperties: true });

function serializeFirestoreValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (Array.isArray(val)) return val.map(serializeFirestoreValue);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeFirestoreValue(v);
    }
    return out;
  }
  return val;
}

function toIsoDate(val, fallbackIso) {
  if (typeof val === 'string' && val.trim()) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (val && typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  return fallbackIso;
}

function getEncryptionKeyBuffer() {
  const configuredKey = process.env.INTERVALS_ENCRYPTION_KEY?.trim();
  if (!configuredKey) {
    throw new Error(
      'INTERVALS_ENCRYPTION_KEY manquante dans .env.local (64 hex chars requis).'
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(configuredKey)) {
    return Buffer.from(configuredKey, 'hex');
  }
  if (configuredKey.length < 16) {
    throw new Error('INTERVALS_ENCRYPTION_KEY trop courte.');
  }
  return crypto.createHash('sha256').update(configuredKey).digest();
}

function encryptIntervalsSecret(plainText) {
  const clean = plainText.trim();
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(clean, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptIntervalsSecret(payload) {
  const parts = String(payload).split(':');
  if (parts.length !== 3) throw new Error('Payload chiffré invalide');
  const [ivB64, tagB64, cipherB64] = parts;
  const key = getEncryptionKeyBuffer();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function normalizeIntervalsApiKey(rawKey) {
  if (!rawKey) return '';
  let k = String(rawKey).trim().replace(/^["']|["']$/g, '').trim();
  if (/^basic\s+/i.test(k)) {
    k = k.replace(/^basic\s+/i, '').trim();
    try {
      const decoded = Buffer.from(k, 'base64').toString('utf8');
      if (decoded.startsWith('API_KEY:')) {
        k = decoded.slice('API_KEY:'.length).trim();
      }
    } catch {
      // ignore
    }
  }
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, '').trim();
  if (/^api_key:/i.test(k)) k = k.replace(/^api_key:/i, '').trim();
  return k.replace(/\s+/g, '');
}

async function fetchIntervalsCoachedAthletesCount(apiKey, coachAthleteId = '0') {
  const cleanKey = normalizeIntervalsApiKey(apiKey);
  if (!cleanKey) return { count: null, error: 'Clé API vide' };

  const headers = {
    Authorization: `Basic ${Buffer.from(`API_KEY:${cleanKey}`).toString('base64')}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch('https://intervals.icu/api/v1/athletes', {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { count: data.length, error: null };
      }
    } else if (res.status === 401 || res.status === 403) {
      return { count: null, error: `HTTP ${res.status}` };
    }

    const fallbackId = String(coachAthleteId || '0').trim() || '0';
    const summaryRes = await fetch(
      `https://intervals.icu/api/v1/athlete/${encodeURIComponent(fallbackId)}/athlete-summary`,
      { headers, signal: AbortSignal.timeout(12000) }
    );
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const arr = Array.isArray(summary) ? summary : [];
      return { count: arr.length, error: null };
    }
    return { count: null, error: `HTTP ${summaryRes.status}` };
  } catch (err) {
    return {
      count: null,
      error: err instanceof Error ? err.message : 'Erreur réseau',
    };
  }
}

async function runMigration() {
  const nowIso = new Date().toISOString();
  const stamp = nowIso.replace(/[:.]/g, '-');
  const backupDir = process.env.BACKUP_DIR?.trim() || DEFAULT_BACKUP_DIR;
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `backup-${projectId}-${stamp}.json`
  );

  // 1. Export complet de secours hors dépôt
  const backupPayload = {
    projectId,
    exportedAt: nowIso,
    authUsers: [],
    collections: {},
  };

  let pageToken;
  const authUsers = [];
  do {
    const listRes = await adminAuth.listUsers(1000, pageToken);
    authUsers.push(...listRes.users);
    pageToken = listRes.pageToken;
  } while (pageToken);

  backupPayload.authUsers = authUsers.map((u) => ({
    uid: u.uid,
    email: u.email || '',
    displayName: u.displayName || '',
    customClaims: u.customClaims || {},
    creationTime: u.metadata.creationTime || null,
    lastSignInTime: u.metadata.lastSignInTime || null,
  }));

  const collectionCounts = {};
  const snapshots = {};
  for (const colName of BACKUP_COLLECTIONS) {
    const snap = await adminDb.collection(colName).get();
    snapshots[colName] = snap;
    collectionCounts[colName] = snap.size;
    backupPayload.collections[colName] = snap.docs.map((d) => ({
      id: d.id,
      data: serializeFirestoreValue(d.data()),
    }));
  }

  fs.writeFileSync(backupPath, JSON.stringify(backupPayload, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  console.log(`[BACKUP] Export sauvegardé : ${backupPath}`);
  console.log('[BACKUP] Collections avant migration :', JSON.stringify(collectionCounts));

  // 2. platformConfig/global
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
      updatedBy: 'migrate-mykairn-v1-to-v2',
    });
    console.log('[CONFIG] platformConfig/global créé (programSalesEnabled=false).');
  } else {
    console.log('[CONFIG] platformConfig/global déjà présent.');
  }

  // 3. Custom claims admin + normalisation users & Auth users
  const adminAuthUser =
    authUsers.find((u) => u.uid === PRIMARY_ADMIN_UID) ||
    authUsers.find(
      (u) => (u.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL
    );
  if (adminAuthUser) {
    await adminAuth.setCustomUserClaims(adminAuthUser.uid, { role: 'admin' });
    console.log(`[AUTH] Custom claim admin attribué à uid=${adminAuthUser.uid}`);
  } else {
    console.warn('[WARN] Admin Auth user reubrechtj@gmail.com introuvable.');
  }

  const authByUid = new Map(authUsers.map((u) => [u.uid, u]));
  const existingUsersById = new Map(
    snapshots.users.docs.map((d) => [d.id, d.data()])
  );

  let usersUpdated = 0;
  let usersCreatedFromAuth = 0;
  const effectiveRolesByUid = new Map();

  for (const [uid, data] of existingUsersById.entries()) {
    const authUser = authByUid.get(uid);
    const email = String(data.email || authUser?.email || '')
      .trim()
      .toLowerCase();
    const isPrimaryAdmin =
      uid === PRIMARY_ADMIN_UID || email === PRIMARY_ADMIN_EMAIL;

    const role = isPrimaryAdmin
      ? 'admin'
      : data.role === 'admin' || data.role === 'coach'
      ? data.role
      : 'athlete';
    effectiveRolesByUid.set(uid, role);

    const displayName = isPrimaryAdmin
      ? PRIMARY_ADMIN_NAME
      : typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : authUser?.displayName?.trim() ||
        (email.includes('@') ? email.split('@')[0] : 'Athlète MyKairn');

    const createdAtIso = toIsoDate(
      data.createdAt,
      authUser?.metadata.creationTime || nowIso
    );
    const updatedAtIso = toIsoDate(data.updatedAt, nowIso);

    const patch = {
      id: uid,
      email,
      displayName,
      role,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      ...(isPrimaryAdmin ? { coachActive: true } : {}),
    };

    await adminDb.collection('users').doc(uid).set(patch, { merge: true });
    usersUpdated++;
  }

  for (const authUser of authUsers) {
    if (existingUsersById.has(authUser.uid)) continue;
    const email = (authUser.email || '').trim().toLowerCase();
    const isPrimaryAdmin =
      authUser.uid === PRIMARY_ADMIN_UID || email === PRIMARY_ADMIN_EMAIL;
    const role = isPrimaryAdmin ? 'admin' : 'athlete';
    effectiveRolesByUid.set(authUser.uid, role);

    const displayName = isPrimaryAdmin
      ? PRIMARY_ADMIN_NAME
      : authUser.displayName?.trim() ||
        (email.includes('@') ? email.split('@')[0] : 'Athlète MyKairn');

    await adminDb
      .collection('users')
      .doc(authUser.uid)
      .set(
        {
          id: authUser.uid,
          email,
          displayName,
          role,
          ...(isPrimaryAdmin ? { coachActive: true } : {}),
          createdAt: toIsoDate(authUser.metadata.creationTime, nowIso),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    usersCreatedFromAuth++;
  }
  console.log(
    `[USERS] Mis à jour=${usersUpdated}, créés depuis Auth=${usersCreatedFromAuth}`
  );

  // 4. athleteProfiles pour les athlètes sans fiche V2
  const existingProfileIds = new Set(
    snapshots.athleteProfiles.docs.map((d) => d.id)
  );
  let profilesCreated = 0;

  for (const [uid, role] of effectiveRolesByUid.entries()) {
    if (role !== 'athlete' || existingProfileIds.has(uid)) continue;
    const rawUser = existingUsersById.get(uid) || {};
    const weight =
      typeof rawUser.weight === 'number' && Number.isFinite(rawUser.weight)
        ? rawUser.weight
        : undefined;
    const itra =
      typeof rawUser.itraIndex === 'number' &&
      Number.isFinite(rawUser.itraIndex)
        ? rawUser.itraIndex
        : undefined;

    await adminDb
      .collection('athleteProfiles')
      .doc(uid)
      .set(
        {
          userId: uid,
          tierStatus: 'free',
          isShowcaseFeatured: false,
          ...(weight !== undefined ? { weightKg: weight } : {}),
          ...(itra !== undefined ? { trailIndex: itra } : {}),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    profilesCreated++;
  }
  console.log(`[PROFILES] athleteProfiles créés=${profilesCreated}`);

  // 5. Enrichissement non destructif des roadbooks V1
  let roadbooksEnriched = 0;
  for (const rbDoc of snapshots.roadbooks.docs) {
    const d = rbDoc.data();
    const patch = {};

    if (!d.id) patch.id = rbDoc.id;

    if (
      d.officialDistanceKm === undefined &&
      typeof d.officialDistance === 'number' &&
      Number.isFinite(d.officialDistance) &&
      d.officialDistance > 0
    ) {
      patch.officialDistanceKm = d.officialDistance;
    }

    if (
      d.officialElevationM === undefined &&
      typeof d.officialElevation === 'number' &&
      Number.isFinite(d.officialElevation) &&
      d.officialElevation >= 0
    ) {
      patch.officialElevationM = d.officialElevation;
    }

    const currentStartIso =
      typeof d.startTimeIso === 'string' ? d.startTimeIso.trim() : '';
    if (!currentStartIso) {
      const legacyStart =
        typeof d.startTime === 'string' ? d.startTime.trim() : '';
      patch.startTimeIso = legacyStart || '2026-08-28T06:00';
    }

    if (typeof d.updatedAt !== 'string' || !d.updatedAt.trim()) {
      patch.updatedAt = toIsoDate(d.createdAt, nowIso);
    }

    if (Object.keys(patch).length > 0) {
      await adminDb
        .collection('roadbooks')
        .doc(rbDoc.id)
        .set(patch, { merge: true });
      roadbooksEnriched++;
    }
  }
  console.log(
    `[ROADBOOKS] Total=${snapshots.roadbooks.size}, enrichis V2=${roadbooksEnriched}`
  );

  // 6. Migration & chiffrement clé API Intervals.icu Coach
  const coachDocRef = adminDb.collection('coaches').doc(PRIMARY_ADMIN_UID);
  const coachSnap = await coachDocRef.get();
  const connRef = adminDb
    .collection('intervalsConnections')
    .doc(PRIMARY_ADMIN_UID);
  const existingConnSnap = await connRef.get();

  let plainCoachApiKey = '';
  let coachIntervalsId = 'i57916';

  if (coachSnap.exists) {
    const coachData = coachSnap.data() || {};
    if (
      typeof coachData.intervalsAthleteId === 'string' &&
      coachData.intervalsAthleteId.trim()
    ) {
      coachIntervalsId = coachData.intervalsAthleteId.trim();
    }
    if (
      typeof coachData.intervalsApiKey === 'string' &&
      coachData.intervalsApiKey.trim()
    ) {
      plainCoachApiKey = coachData.intervalsApiKey.trim();
    }
  }

  let secretEncrypted =
    existingConnSnap.exists &&
    typeof existingConnSnap.data()?.secretEncrypted === 'string'
      ? existingConnSnap.data().secretEncrypted
      : '';

  let migratedCoachSecret = false;
  if (plainCoachApiKey) {
    secretEncrypted = encryptIntervalsSecret(plainCoachApiKey);
    const roundTrip = decryptIntervalsSecret(secretEncrypted);
    if (roundTrip !== plainCoachApiKey.trim()) {
      throw new Error('Échec de vérification du chiffrement AES-256-GCM.');
    }
    migratedCoachSecret = true;
  } else if (secretEncrypted) {
    plainCoachApiKey = decryptIntervalsSecret(secretEncrypted);
  }

  let coachedCount = null;
  let syncStatus = 'pending';
  let lastErrorMessage = undefined;

  if (plainCoachApiKey) {
    const liveRes = await fetchIntervalsCoachedAthletesCount(
      plainCoachApiKey,
      coachIntervalsId
    );
    if (liveRes.count !== null) {
      coachedCount = liveRes.count;
      syncStatus = 'ok';
    } else {
      syncStatus = 'error';
      lastErrorMessage = liveRes.error || 'Échec vérification Intervals.icu';
    }
  }

  if (secretEncrypted) {
    await connRef.set(
      {
        userId: PRIMARY_ADMIN_UID,
        intervalsAthleteId: coachIntervalsId,
        authMode: 'api_key',
        connectionScope: 'coach',
        hasSecret: true,
        secretEncrypted,
        syncStatus,
        ...(coachedCount !== null ? { coachedAthletesCount: coachedCount } : {}),
        ...(syncStatus === 'ok' ? { lastSyncedAt: nowIso } : {}),
        lastErrorMessage: lastErrorMessage || FieldValue.delete(),
        updatedAt: nowIso,
      },
      { merge: true }
    );
  }

  if (migratedCoachSecret) {
    await coachDocRef.set(
      {
        intervalsApiKey: FieldValue.delete(),
        migratedToIntervalsConnectionsAt: nowIso,
      },
      { merge: true }
    );
  }

  console.log(
    `[INTERVALS] coachId=${coachIntervalsId}, migratedPlaintext=${migratedCoachSecret}, syncStatus=${syncStatus}, coachedAthletesCount=${
      coachedCount ?? 'n/a'
    }${lastErrorMessage ? `, err=${lastErrorMessage}` : ''}`
  );
  console.log('[OK] Migration V1 -> V2 terminée sans suppression destructive.');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ERREUR] Échec migration :', err?.message || err);
    process.exit(1);
  });
