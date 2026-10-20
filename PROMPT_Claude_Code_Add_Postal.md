# Prompt Claude Code : Ajouter Postal comme fournisseur de secours (après Resend)

> À coller dans Claude Code, sur le projet existant. Objectif : ajouter notre serveur Postal auto-hébergé comme fournisseur d'email **de secours derrière Resend**, et **retirer Brevo** de la chaîne. L'envoi passe déjà par une abstraction de fournisseurs ; on ajoute une implémentation et on met à jour la chaîne. Ne touche pas aux templates ni à la logique QStash. Code et commentaires en anglais.

---

## Contexte

- L'app (Next.js / Vercel) envoie des emails transactionnels de suivi de commande.
- L'envoi passe par une interface `EmailProvider` avec une couche de bascule (`email/send.ts`), aujourd'hui : **Resend (primaire) + Brevo (secours sur limite/quota)**.
- On remplace ce schéma par : **Resend (primaire) → Postal (secours)**. Brevo est entièrement retiré.
- Postal est un serveur auto-hébergé exposant une **API HTTP** (pas de SMTP côté app). Il envoie déjà réellement (DNS SPF/DKIM/DMARC configurés, port 25 ouvert, test de délivrabilité OK).

## Règle de bascule (inchangée)

On bascule vers le fournisseur suivant **uniquement quand le fournisseur courant échoue pour cause de limite/quota** (`RateLimitError` : HTTP 429 ou quota atteint). Toute autre erreur (adresse invalide, payload invalide, panne, 5xx) **remonte** pour que QStash applique son propre retry. Un flag d'env `EMAIL_FALLBACK_MODE` permet de passer en `any_error` plus tard ; défaut `rate_limit`.

## Tâches

### 1. Retirer Brevo
- Supprime `email/providers/brevo.ts`.
- Retire toute référence à Brevo dans `email/send.ts` et ailleurs (imports, chaîne, types).
- Retire les variables d'env Brevo (`BREVO_API_KEY`) de `.env.example` et de la doc.
- La valeur `'brevo'` du champ `email_sends.provider` peut rester tolérée en lecture (anciennes lignes), mais n'est plus produite.

### 2. Ajouter l'implémentation Postal
Crée `email/providers/postal.ts` implémentant l'interface `EmailProvider` existante, via l'API HTTP de Postal.

```ts
// email/providers/postal.ts
import { EmailProvider, SendEmailInput, SendEmailResult } from '../types';

export const postalProvider: EmailProvider = {
  name: 'postal',
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const res = await fetch(`${process.env.POSTAL_API_URL}/api/v1/send/message`, {
      method: 'POST',
      headers: {
        'X-Server-API-Key': process.env.POSTAL_API_KEY!,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        to: [input.to],
        from: input.from,
        subject: input.subject,
        html_body: input.html,
        reply_to: input.replyTo,
        headers: {
          ...input.headers,
          'X-Idempotency-Key': input.idempotencyKey ?? '',
        },
      }),
    });

    // Postal renvoie HTTP 200 avec un champ "status" dans le corps,
    // y compris pour certaines erreurs : on teste le corps, pas seulement le code HTTP.
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== 'success') {
      throw new Error(`Postal send failed: ${res.status} ${JSON.stringify(data)}`);
    }

    const messageId =
      data.data?.message_id ??
      (data.data?.messages ? Object.values<any>(data.data.messages)[0]?.id : '') ??
      '';
    return { provider: 'postal', providerMessageId: String(messageId) };
  },
};
```

> Note : l'API Postal n'a pas d'erreur de rate limit équivalente à Resend. Postal est en bout de chaîne (dernier fournisseur), donc toute erreur de sa part remonte de toute façon ; pas besoin de mapper un `RateLimitError` pour lui.

### 3. Mettre à jour la chaîne de bascule
Dans `email/send.ts`, chaîne = `[resendProvider, postalProvider]`.

```ts
// email/send.ts
import { EmailProvider, SendEmailInput, SendEmailResult, RateLimitError } from './types';
import { resendProvider } from './providers/resend';
import { postalProvider } from './providers/postal';

const CHAIN: EmailProvider[] = [resendProvider, postalProvider];

function shouldFallback(err: unknown): boolean {
  if (process.env.EMAIL_FALLBACK_MODE === 'any_error') return true;
  return err instanceof RateLimitError; // défaut : seulement limite/quota
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  let lastErr: unknown;
  for (let i = 0; i < CHAIN.length; i++) {
    const provider = CHAIN[i];
    const isLast = i === CHAIN.length - 1;
    try {
      return await provider.send(input);
    } catch (err) {
      lastErr = err;
      if (isLast || !shouldFallback(err)) throw err;
      console.warn(`[email] ${provider.name} failed, falling back to ${CHAIN[i + 1].name}`, {
        idempotencyKey: input.idempotencyKey,
      });
    }
  }
  throw lastErr;
}
```

### 4. Idempotence & traçabilité (inchangées)
- Continue de passer `idempotencyKey = email_sends.id` à chaque fournisseur.
- Avant envoi, re-vérifie `email_sends.status != 'sent'`.
- Sur succès, enregistre `email_sends.provider` (`'resend'` ou `'postal'`) et `provider_message_id`.

### 5. Variables d'environnement
Mets à jour **uniquement `.env.example`** avec des valeurs vides/placeholders. Les vraies valeurs ne vont JAMAIS dans le code ni dans ce fichier : elles se posent dans Vercel (Settings → Environment Variables) et dans un `.env.local` non commité. Le code lit tout via `process.env.*`.

```bash
# Email : Resend (primaire)
RESEND_API_KEY=

# Email : Postal (secours auto-hébergé, API HTTP)
POSTAL_API_URL=https://postal.tracky-ordertrack.site
POSTAL_API_KEY=

# Adresse d'expédition vérifiée (domaine partagé plateforme)
EMAIL_FROM="Your Store <notifications@tracky-ordertrack.site>"

# Déclencheur de bascule : 'rate_limit' (défaut) ou 'any_error'
EMAIL_FALLBACK_MODE=rate_limit

# (Retiré : BREVO_API_KEY)
```

Contraintes de sécurité strictes sur les clés :
- Ne mets **aucune valeur réelle** de clé dans `.env.example`, dans le code, ni dans un commentaire. `POSTAL_API_KEY=` reste vide dans le fichier exemple.
- Vérifie que `.env.local` (et tout `.env` réel) est bien dans `.gitignore`.
- Ne logge jamais la valeur de `POSTAL_API_KEY` ni de `RESEND_API_KEY`.

> `EMAIL_FROM` doit être vérifié **chez Resend ET chez Postal** (SPF/DKIM des deux côtés sur le domaine d'envoi). C'est déjà le cas côté Postal ; vérifie que le domaine reste bien vérifié côté Resend.
>
> Rappel hors-code (à faire par l'humain, pas par Claude Code) : générer une **nouvelle** clé API dans le web UI Postal, révoquer les anciennes, et poser la nouvelle dans Vercel + `.env.local`.

### 6. Interface admin : journal des emails (lit `email_sends`)
Ajoute une page dans le backoffice admin (réservée au rôle `owner`/admin, protégée côté serveur) pour consulter l'historique des emails envoyés. Elle lit **uniquement la base locale** (`email_sends` jointe aux tables utiles), pas l'API Postal.

Emplacement : une route backoffice, par ex. `/(backoffice)/emails`, filtrée par la boutique active (multi-tenant : toujours filtrer par `store_id`).

Contenu de la page :
- **Tableau paginé** des `email_sends` les plus récents d'abord, colonnes :
  - Date (`sent_at` ou `scheduled_for`)
  - Destinataire (email client, via l'`order`)
  - Commande (numéro, lien vers la commande)
  - Template / étape associée (depuis `sequence_step` → `template`)
  - **Statut** (`scheduled` | `sent` | `failed` | `skipped`) avec pastille de couleur
  - **Fournisseur** (`provider` : `resend` | `postal`) affiché en badge, pour voir d'un coup qui a envoyé quoi
  - `provider_message_id` (tronqué, en mono)
  - En cas d'échec : la colonne `error` (ou un survol/expand qui l'affiche)
- **Filtres** : par statut, par fournisseur (resend/postal), par plage de dates, et recherche par email/numéro de commande.
- **Compteurs en tête de page** : nombre d'envois sur les 7/30 derniers jours, et **répartition par fournisseur** (ex. « Resend 94 % / Postal 6 % »). C'est l'indicateur clé pour surveiller à quel point Postal est sollicité (donc à quel point Resend sature).
- **Détail d'une ligne** : au clic, un panneau affichant toutes les infos de l'`email_sends` (statut, fournisseur, message id, horodatages, erreur éventuelle, template, commande liée).

Contraintes :
- Lecture seule. Aucune action d'envoi depuis cette page pour l'instant (le renvoi/bulk existe déjà ailleurs dans le backoffice).
- Requêtes paginées côté serveur (ne charge pas toute la table).
- Filtrage multi-tenant strict par `store_id` sur chaque requête.
- Pas d'appel à l'API Postal ici : tout vient de `email_sends`. (Si un jour tu veux le statut live Postal, ce sera une évolution séparée.)

### 7. Tests à écrire
- `sendEmail` renvoie le résultat de Resend quand Resend réussit (Postal non appelé).
- Quand Resend lève un `RateLimitError` et `EMAIL_FALLBACK_MODE=rate_limit` : Postal est appelé et son résultat renvoyé.
- Quand Resend lève une erreur **non** liée à une limite : l'erreur remonte, Postal **n'est pas** appelé.
- `postalProvider.send` traite correctement une réponse Postal `status: 'error'` (throw) et `status: 'success'` (retourne `message_id`).
- Aucune référence résiduelle à Brevo dans le build (grep `brevo` vide).

### 8. Vérification manuelle post-déploiement
- Un envoi normal part bien par Resend (`email_sends.provider = 'resend'`).
- En simulant une 429 Resend (ou en mettant temporairement `EMAIL_FALLBACK_MODE=any_error`), un envoi bascule sur Postal et apparaît `delivered` dans le web UI Postal, avec `email_sends.provider = 'postal'`.
- La page admin `/emails` liste bien les envois, montre le bon fournisseur par ligne, la répartition Resend/Postal en tête, et reste filtrée à la boutique active.

## Contraintes
- Ne modifie pas les templates React Email ni la logique de planification QStash.
- Garde l'abstraction `EmailProvider` : aucun appel direct à un SDK fournisseur en dehors de `email/providers/`.
- Ne logge jamais `POSTAL_API_KEY` ni aucune clé.
