# myKairn Coach — Plateforme Coaching Trail, Plans & Outils Scientifiques

Plateforme unifiée Next.js (App Router, TypeScript strict, Tailwind CSS v4) + Firebase + Intervals.icu, conçue pour l'accompagnement d'athlètes trail & ultra-endurance, la mise en avant de cas pilotes (`pilot_showcase`), l'acquisition via des outils trail gratuits sans compte et l'évolution rapide vers la vente de programmes et de coaching payant.

---

## 1. Architecture du projet

```text
trail-coaching-platform/
├── .env.example                 # Variables d'environnement requises
├── firestore.rules              # Règles strictes par rôle & propriété
├── storage.rules                # Règles d'accès Firebase Storage (GPX, avatars, marque)
├── public/brand/                # Emplacement pour déposer le logo définitif `mykairn-coach-logo.svg`
└── src/
    ├── config/brand.ts          # Charte graphique ("Alpine Performance"), bandeau vitrine & mentions légales
    ├── types/domain.ts          # Types stricts (10+ collections Firestore + moteur Trail)
    ├── lib/
    │   ├── validation/schemas.ts# Schémas Zod pour toutes les API et formulaires
    │   ├── trail/               # Couche domaine pure (Haversine, Minetti, Riegel/ITRA, SunCalc, Nutrition, GPX)
    │   ├── access/              # Helper centralisé des droits (`entitlements`, alertes coach)
    │   ├── intervals/           # Client Intervals.icu 100% serveur + chiffrement AES-256-GCM
    │   ├── firebase/            # Configuration client Firebase Auth / Firestore
    │   └── seed/demoData.ts     # Données pilotes réalistes (3 pilotes vitrine, 4 plans, défis)
    ├── context/PlatformContext.tsx
    ├── components/              # Logo marque, Navbar, Footer, Bandeau Cookies RGPD, Profil SVG
    └── app/
        ├── page.tsx             # Vitrine publicitaire, offres coaching/conseil, pilotes & formulaire bilan RGPD
        ├── tools/page.tsx       # Outils Trail 100% gratuits sans compte (Roadbook GPX Express, Km-Effort, Nutrition)
        ├── catalog/             # Catalogue des programmes trail & fiches détaillées (`entitlements`)
        ├── athlete/             # Dashboard athlète, Carnet de retour Check-in, Connexion Intervals & Centre RGPD
        ├── coach/               # Cockpit Coach (alertes, synchro serveur, droits, fiches individuelles, charte graphique)
        ├── community/           # Défis collectifs D+/km & fil de partage
        ├── legal/               # Mentions légales (LCEN), Politique de confidentialité (RGPD), CGV/CGU
        └── api/                 # Route Handlers validés par Zod (Intervals connect/sync, check-ins, entitlements, checkout, RGPD export)
```

---

## 2. Démarrage en local

```bash
cd trail-coaching-platform
cp .env.example .env.local
npm install
npm run dev
```

L'application démarre sur **`http://localhost:3005`** (port distinct du projet existant pour cohabitation immédiate sans conflit).

Scripts utiles :
- `npm run typecheck` : vérification TypeScript stricte
- `npm run lint` : validation ESLint / Next.js
- `npm run build` : build de production

---

## 3. Intégrer votre logo définitif `myKairn Coach`

1. Vous pouvez tester votre logo immédiatement dans l'interface via **`/coach/brand`**.
2. Pour le figer pour tous les utilisateurs, placez simplement votre fichier SVG/PNG dans :
   `trail-coaching-platform/public/brand/mykairn-coach-logo.svg`
3. Toute la palette officielle et les textes du bandeau promotionnel sont centralisés dans `src/config/brand.ts`.

---

## 4. Variables d'environnement requises

Voir `.env.example` :
- **Domaine** : `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`
- **Firebase Client** : `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_ADMIN_EMAILS`
- **Sécurité Serveur Intervals.icu** : `INTERVALS_ENCRYPTION_KEY` (clé hexadécimale 64 caractères pour chiffrement **AES-256-GCM**)
- **Paiement (Phase 2)** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Légal / RGPD** : `NEXT_PUBLIC_LEGAL_*` (Raison sociale, SIRET, Carte professionnelle EAPS, contact DPO/RGPD)

---

## 5. Stratégie de bascule / remplacement du projet existant

Ce nouveau projet est conçu pour **remplacer progressivement et sans coupure** le monorepo historique (`apps/web` + `apps/plan-builder`) :

1. **Phase 1 — Cohabitation pendant le lancement pilote** :
   - L'ancien projet reste inchangé et actif sur son domaine de production.
   - Cette nouvelle plateforme tourne en parallèle (sur `localhost:3005` ou un sous-domaine `beta.` / `coach.`) avec les 2 à 3 athlètes `pilot_showcase` pour valider la vitrine, les retours `checkIns`, la synchro serveur Intervals.icu et les outils gratuits.
2. **Phase 2 — Vérification de parité & validation juridique** :
   - Déploiement des nouvelles règles Firestore (`firestore.rules`) et Storage (`storage.rules`).
   - Renseignement des variables `NEXT_PUBLIC_LEGAL_*` (SIRET, Carte Pro éducateur sportif) et du logo définitif dans `public/brand/`.
   - Activation des clés `STRIPE_*` sur `/api/orders/checkout` pour encaisser les ventes de programmes et abonnements coaching.
3. **Phase 3 — Bascule de domaine (Zero-Hardcoding)** :
   - Mettre à jour `NEXT_PUBLIC_APP_URL` dans l'hébergement cible (Vercel) avec le domaine principal définitif.
   - Rediriger le DNS du domaine principal vers le déploiement de `trail-coaching-platform`.
4. **Phase 4 — Archivage de l'existant** :
   - Conserver l'ancien projet (`apps/web` + `apps/plan-builder`) en archive en lecture seule / référence historique.
