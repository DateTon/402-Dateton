# DateEscrow — Plan MVP Hackathon

## Idée

Application de rencontre où après un match, les deux utilisateurs négocient
un montant commun, le déposent dans un smart contract TON, choisissent une
activité ensemble, puis confirment leur date via un code croisé affiché sur
leurs téléphones. L'argent est libéré une fois les deux codes validés, ou
remboursé si le date n'a pas lieu avant la deadline.

---

## Stack technique

- **Frontend + Backend** : Next.js App Router (TypeScript) dans `examples/nextjs-server/`
- **Smart contract** : Tact (TON) dans `contracts/`
- **Paiements HTTP** : protocole x402 via `packages/` (middleware BSA, déjà prêt)
- **Wallet** : TON Connect pour connecter le wallet de chaque utilisateur
- **État** : en mémoire (Map TypeScript) pour le MVP — pas de base de données

---

## Structure du repo

```
x402-projet/
├── PLAN.md                         ← ce fichier
├── contracts/
│   └── DateEscrow.tact             ✅ FAIT — smart contract escrow
├── packages/                       ✅ NE PAS TOUCHER — plomberie x402 BSA
└── examples/
    ├── client-script/              ✅ garder pour tests manuels x402
    └── nextjs-server/
        ├── app/
        │   ├── page.tsx                        → landing + connect wallet
        │   ├── matches/
        │   │   └── page.tsx                    → liste des matchs
        │   ├── matches/[id]/
        │   │   └── page.tsx                    → détail match + négociation prix
        │   ├── date/[id]/fund/
        │   │   └── page.tsx                    → dépôt des fonds
        │   ├── date/[id]/activity/
        │   │   └── page.tsx                    → choix de l'activité
        │   ├── date/[id]/checkin/
        │   │   └── page.tsx                    → affichage + saisie code croisé
        │   └── date/[id]/status/
        │       └── page.tsx                    → état final du date
        └── app/api/
            ├── facilitator/                    ✅ NE PAS TOUCHER — x402 BSA
            ├── matches/
            │   ├── create/route.ts             → POST créer un match
            │   ├── [id]/offer/route.ts         → POST proposer un montant
            │   ├── [id]/counter-offer/route.ts → POST contre-proposition
            │   └── [id]/accept/route.ts        → POST accepter le montant courant
            ├── escrow/
            │   ├── create/route.ts             → POST créer l'escrow on-chain
            │   ├── [id]/fund/route.ts          → POST signaler le dépôt d'un user
            │   ├── [id]/release/route.ts       → POST libérer les fonds
            │   └── [id]/refund/route.ts        → POST rembourser
            └── checkin/
                ├── [id]/generate/route.ts      → POST générer les 2 codes
                └── [id]/confirm/route.ts       → POST valider le code saisi
        └── lib/
            ├── db.ts            → état en mémoire (tous les Maps)
            ├── activities.ts    → liste fixe des 5 activités proposées
            ├── escrow.ts        → appels vers le smart contract TON
            └── payment-config.ts ✅ DÉJÀ REMPLI — config x402 BSA
```

---

## Modèles de données (lib/db.ts)

```typescript
// Un utilisateur connecté via TON Connect
type User = {
  id: string;
  walletAddress: string;
  displayName: string;
};

// Un match entre deux utilisateurs
type Match = {
  id: string;
  userA: string;        // walletAddress
  userB: string;        // walletAddress
  proposedByA: number | null;
  proposedByB: number | null;
  agreedAmount: number | null;
  status: "NEGOTIATING" | "AGREED" | "CANCELLED";
};

// Un plan de date après accord sur le montant
type DatePlan = {
  id: string;
  matchId: string;
  activityId: string;
  scheduledAt: string;  // ISO date string
};

// Un escrow on-chain lié à un DatePlan
type Escrow = {
  id: string;
  matchId: string;
  contractAddress: string;
  amountPerUser: number;
  fundedA: boolean;
  fundedB: boolean;
  status: "OPEN" | "PARTIAL" | "FUNDED" | "RELEASED" | "REFUNDED";
};

// Les codes croisés pour confirmer le date
type CheckIn = {
  escrowId: string;
  codeA: string;        // code affiché à A, à saisir par B
  codeB: string;        // code affiché à B, à saisir par A
  confirmedA: boolean;
  confirmedB: boolean;
  expiresAt: number;    // timestamp Unix
};
```

---

## Activités proposées (lib/activities.ts)

5 activités fixes pour le MVP, toutes autour de 10 CHF par personne :

```typescript
type Activity = {
  id: string;
  name: string;
  description: string;
  estimatedCost: number; // en CHF
  emoji: string;
};

export const ACTIVITIES: Activity[] = [
  { id: "cinema",   name: "Cinéma",          description: "Film + popcorn + boisson",       estimatedCost: 10, emoji: "🎬" },
  { id: "cocktail", name: "Bar à cocktails",  description: "2 cocktails dans un bar sympa",  estimatedCost: 10, emoji: "🍹" },
  { id: "cafe",     name: "Café & gâteau",    description: "Pause café dans un endroit cosy",estimatedCost: 10, emoji: "☕" },
  { id: "bowling",  name: "Bowling",          description: "Une partie de bowling",          estimatedCost: 10, emoji: "🎳" },
  { id: "picnic",   name: "Pique-nique",      description: "Panier pique-nique au parc",     estimatedCost: 10, emoji: "🧺" },
];
```

---

## Flow utilisateur complet

```
1. MATCH
   - Les deux users sont connectés via TON Connect
   - Un match est créé (mocké pour le MVP)

2. NÉGOCIATION (off-chain, dans l'app)
   - A propose un montant  → POST /api/matches/[id]/offer
   - B contre-propose      → POST /api/matches/[id]/counter-offer
   - L'un accepte          → POST /api/matches/[id]/accept
   - Quand les deux ont accepté le même montant → status = AGREED

3. CHOIX DE L'ACTIVITÉ
   - L'un des deux choisit une activité parmi les 5 proposées
   - Un DatePlan est créé avec l'activité et une date choisie

4. DÉPÔT (on-chain)
   - Le backend déploie DateEscrow avec userA, userB, amountPerUser, deadline
   - Chaque user envoie sa part via TON Connect → message Fund
   - Quand fundedA && fundedB → Escrow status = FUNDED

5. CHECK-IN (le jour du date)
   - Le backend génère deux codes à 6 chiffres → POST /api/checkin/[id]/generate
   - A voit le code de B et doit le saisir sur son téléphone
   - B voit le code de A et doit le saisir sur son téléphone
   - Quand les deux codes sont validés → POST /api/checkin/[id]/confirm
   - Le backend envoie ConfirmRelease pour chaque user, puis "release"

6. RELEASE ou REFUND
   - Si les deux ont confirmé  → "release" → fonds rendus aux deux
   - Si deadline dépassée      → Refund    → fonds remboursés individuellement
```

---

## Smart contract (contracts/DateEscrow.tact)

✅ **DÉJÀ ÉCRIT** — voir `contracts/DateEscrow.tact`

Messages supportés :
- `Fund` — dépôt par userA ou userB
- `ConfirmRelease` — confirmation que le date a eu lieu
- `"release"` — libération des fonds (après double confirmation)
- `Refund` — remboursement (après deadline)

Getters disponibles :
- `state()` → `"OPEN" | "PARTIAL" | "FUNDED" | "RELEASED" | "REFUNDED"`
- `participantsFunded()` → 0, 1 ou 2
- `confirmationsCount()` → 0, 1 ou 2

---

## Règles importantes pour les agents IA

- **Ne jamais modifier** `packages/` ni `app/api/facilitator/`
- La **négociation de prix** reste entièrement off-chain dans l'app Next.js
- Le **smart contract** ne reçoit que le résultat final : montant accepté par les deux
- Le **code croisé** est validé off-chain par le backend avant d'appeler `ConfirmRelease`
- Pour le MVP, l'état est **en mémoire** dans `lib/db.ts` — pas de base de données externe
- Tous les endpoints backend sont des **Route Handlers Next.js** dans `app/api/.../route.ts`

---

## Priorités hackathon

### Priorité 1 — Must have
- [ ] `lib/db.ts` — état en mémoire avec tous les Maps
- [ ] `lib/activities.ts` — 5 activités fixes
- [ ] Routes API : matches (offer, counter-offer, accept)
- [ ] Routes API : escrow (create, fund, release, refund)
- [ ] Routes API : checkin (generate, confirm)
- [ ] Pages front : matches, négociation, dépôt, checkin, status
- [ ] Connexion wallet TON Connect sur la landing page

### Priorité 2 — Should have
- [ ] Déploiement du contrat DateEscrow depuis le backend
- [ ] Appels réels Fund / ConfirmRelease / release via TON Connect
- [ ] Affichage du TX hash après release

### Priorité 3 — Nice to have
- [ ] UI soignée avec Tailwind
- [ ] Animation de confirmation du date
- [ ] Intégration x402 pour une action premium (ex: boost de match)
