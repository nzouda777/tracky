# Prompt Claude Code — Application de suivi de commande & livraison dernier kilomètre (Shopify)

> À coller dans Claude Code. Construis le projet **phase par phase**, dans l'ordre. Ne passe à la phase suivante qu'une fois la précédente fonctionnelle et testée. Pose-moi une question si un choix d'architecture est ambigu plutôt que de deviner.

---

## 1. Contexte & objectif

Je construis une application SaaS **multi-boutiques** qui se connecte à une boutique Shopify et gère le suivi de commande post-achat **de bout en bout avec une logistique propre** (chauffeurs + agence de livraison en Australie).

Le principe fondamental, à respecter partout : **une étape de commande ne progresse que sur un événement réel** — un webhook Shopify, ou une mise à jour saisie par l'agence de livraison. Il n'y a **aucune progression sur minuterie** et **aucun événement de suivi généré artificiellement**. L'auto-fulfillment ne se déclenche que sur **livraison réelle confirmée par l'agence** (après signature manuscrite du client sur un bon papier, hors app).

L'utilisateur admin doit pouvoir tout personnaliser sans développeur : étapes, timings d'email, branding, templates.

## 2. Stack technique (imposée)

- **Framework** : Next.js (App Router, TypeScript)
- **Hébergement** : Vercel
- **Base de données** : Neon (Postgres serverless)
- **ORM** : Drizzle ORM (driver serverless Neon, compatible edge)
- **Scheduling / délais d'email** : Upstash QStash (+ Vercel Cron en balayage de secours)
- **Emails** : Resend + React Email (domaine d'envoi **partagé de la plateforme** pour la v1)
- **Stockage fichiers** (logos, photos de bons de livraison signés) : Vercel Blob
- **Auth backoffice & app terrain** : Auth.js (NextAuth) avec sessions + rôles ; l'accès admin d'une boutique est lié à son installation Shopify
- **UI** : Tailwind CSS + composants simples et accessibles ; tout doit être **responsive mobile-first** (l'interface agence s'utilise sur téléphone dans le navigateur, pas d'app native)
- **Langue de l'application** : **tout le contenu visible par l'utilisateur final et par les opérateurs est en anglais** — libellés d'UI, boutons, messages d'état, page de tracking, emails, backoffice, textes par défaut des étapes, templates email par défaut, messages d'erreur. Aucune chaîne visible en français dans l'app livrée. (Ce document de spécification est en français, mais il ne décrit pas la langue de l'app : l'app est en anglais.)

## 3. Principes d'architecture transverses

1. **Multi-tenant dès la conception.** Chaque donnée est rattachée à un `store_id`. Aucune requête ne doit jamais traverser les frontières d'une boutique. Applique un filtrage par tenant systématique (idéalement au niveau d'une couche d'accès aux données).
2. **Progression événementielle honnête.** Les transitions d'étape proviennent uniquement : (a) de webhooks Shopify, (b) d'actions humaines authentifiées (agence ou admin). Jamais d'un timer.
3. **Auto-fulfillment sur livraison confirmée uniquement.** Le fulfillment Shopify est poussé quand l'agence déclare la commande livrée (après signature papier), avec les vraies infos de livraison.
4. **Idempotence des webhooks.** Vérifie le HMAC Shopify, déduplique par `X-Shopify-Event-Id`, réponds vite (traite en tâche de fond si besoin).
5. **Séparation claire** : backoffice admin / interface agence / page publique de tracking (App Proxy).

## 4. Rôles & permissions

- **Owner / Admin** (Christian) : accès total à sa boutique — branding, étapes, templates email, séquences, réglages fulfillment, liste des commandes, gestion des utilisateurs agence, assignation d'un chauffeur (libellé) à une commande, override manuel d'une étape.
- **Agency (dispatch)** : seul acteur terrain qui écrit dans l'app. Voit toutes les commandes en cours de la boutique, assigne les commandes à un chauffeur (simple libellé, sans compte), met à jour les statuts d'étape, et **marque une commande comme livrée** une fois la livraison effectuée et la signature manuscrite obtenue sur papier. Ne touche pas au branding ni aux templates.

**Note importante sur les chauffeurs** : les chauffeurs ne sont **pas** des utilisateurs de l'app. Ils livrent et font signer un bon papier ; ils n'ont ni compte, ni login, ni interface. Ils existent uniquement comme **libellés assignables** (nom du chauffeur) pour que l'agence sache qui livre quoi. Toute mise à jour d'état vient de l'agence, jamais du chauffeur.

Modélise les rôles proprement (table `users` + `store_memberships` avec un `role` enum : `owner` | `agency`). Les permissions sont vérifiées côté serveur sur chaque action, jamais seulement dans l'UI.

## 5. Modèle de données (Drizzle / Postgres)

Crée au minimum ces tables (ajoute les colonnes techniques utiles : `id`, `created_at`, `updated_at`) :

- **stores** — `shop_domain`, `access_token` (chiffré), `scope`, `installed_at`, `uninstalled_at`, statut.
- **users** — identité de connexion (email, hash mot de passe ou provider), nom.
- **store_memberships** — `store_id`, `user_id`, `role` (`owner` | `agency`), statut d'invitation.
- **branding_settings** — `store_id`, couleurs (primaire, secondaire, fond, texte), `logo_url`, police, tailles de texte, textes personnalisés (labels page, FAQ, bandeau d'aide). Un enregistrement par boutique.
- **stages** — `store_id`, `name`, `position` (ordre), `key` (slug stable), `icon`/`color`, `is_terminal` (bool, ex. « Delivered »), `triggers_fulfillment` (bool). Entièrement CRUD par l'admin.
- **orders** — `store_id`, `shopify_order_id`, `order_number`, `customer_name`, `customer_email`, `shipping_address` (JSON), `line_items` (JSON : produits achetés), `order_date`, `total`, `currency`, `current_stage_id`, `fulfillment_status`, `assigned_driver_name` (texte, nullable — simple libellé, pas un compte).
- **order_stage_history** — `order_id`, `stage_id`, `occurred_at`, `note` (message affiché au client), `created_by_user_id` (qui a déclaré l'événement), `source` (`shopify_webhook` | `agency` | `admin`). C'est cette table qui alimente la timeline publique.
- **proof_of_delivery** — `order_id`, `marked_delivered_by_user_id` (l'utilisateur agence qui déclare la livraison), `delivered_at`, `recipient_name` (optionnel), `paper_signature_photo_url` (optionnel, photo du bon signé archivée par l'agence via Vercel Blob). **Pas de signature numérique** : la signature est manuscrite sur papier, hors app. La preuve, c'est la déclaration de livraison par l'agence.
- **email_templates** — `store_id`, `name`, `subject`, `body` (React Email / HTML avec variables de fusion), `is_active`.
- **email_sequence_steps** — `store_id`, `template_id`, `trigger_type` (`on_stage` | `delay_after_order` | `delay_after_previous`), `stage_id` (si `on_stage`), `delay_days` (si délai), `position`, `is_active`.
- **email_sends** — `order_id`, `sequence_step_id`, `status` (`scheduled` | `sent` | `failed` | `skipped`), `scheduled_for`, `sent_at`, `qstash_message_id`, `error`.
- **fulfillment_rules** — `store_id`, `enabled` (bool), `require_delivery_confirmation` (bool, **true par défaut**). Le fulfillment attend la **déclaration de livraison par l'agence**, jamais un délai.
- **webhook_events** — journal pour l'idempotence (`shopify_event_id` unique, `topic`, `processed_at`).

Variables de fusion à supporter dans les emails : `{{customer_name}}`, `{{order_number}}`, `{{order_date}}`, `{{tracking_link}}`, `{{current_stage}}`, `{{store_name}}`, `{{shipping_address}}`.

## 6. Intégration Shopify

- **Type** : app publique (OAuth) ou custom app installable. Scopes : `read_orders`, `write_orders`, `read_fulfillments`, `write_fulfillments`.
- **OAuth** : flux d'installation standard, stocke `access_token` chiffré dans `stores`.
- **Webhooks** (vérif HMAC + idempotence via `webhook_events`) :
  - `orders/create` → crée l'`order`, la place dans la première étape, déclenche la séquence email.
  - `orders/updated` → resynchronise les champs.
  - `fulfillments/create` → met à jour le statut si le fulfillment vient d'ailleurs.
  - `app/uninstalled` → marque la boutique désinstallée, purge le token.
- **App Proxy** (page de tracking sur le domaine de la boutique) : déclare un proxy `apps` / sous-chemin `track-order` dans la config de l'app. Shopify relaie `[store].com/apps/track-order` vers une route Next.js qui **vérifie la signature App Proxy** et retourne le HTML de la page de tracking. Le client ne quitte jamais le domaine de la boutique.
- **Fulfillment** : quand une commande atteint une étape avec `triggers_fulfillment = true` **via une preuve de livraison**, appelle l'Admin GraphQL API (`fulfillmentCreateV2`) pour marquer la commande fulfilled dans Shopify avec les infos de livraison réelles. Le `fulfillment_status` local est mis à jour en conséquence.

## 7. Plan de construction par phases

### Phase 0 — Fondations
Initialise Next.js + TypeScript + Tailwind + Drizzle + connexion Neon. Mets en place les migrations, la config d'environnement (variables : Neon, Shopify, Resend, QStash, Vercel Blob), et un layout de base. Crée le schéma Drizzle complet de la section 5.

### Phase 1 — Auth, multi-tenant & rôles
Auth.js avec sessions. Modèle `users` + `store_memberships`. Middleware de garde par rôle côté serveur. Écran de connexion. Sélecteur de boutique active pour un utilisateur multi-boutiques. Helper d'accès aux données qui force le `store_id`.

### Phase 2 — Connexion Shopify & sync commandes
Flux OAuth d'installation. Enregistrement automatique des webhooks à l'installation. Endpoints webhook avec vérif HMAC + idempotence. À `orders/create`, création de l'`order` (avec `line_items`, adresse, email, date) et placement dans la première étape. Vue « Commandes » basique dans le backoffice pour vérifier la sync.

### Phase 3 — Étapes configurables & backoffice
CRUD complet des `stages` (créer, renommer, réordonner par glisser-déposer, supprimer, marquer terminale, marquer déclencheur de fulfillment). Fournis un jeu d'étapes par défaut **en anglais** (ex. : Order Placed, Confirmed, Processing, Out for Delivery, Delivered). Liste des commandes avec étape actuelle, historique par commande, et **override manuel** d'étape par l'admin (écrit dans `order_stage_history` avec `source = admin`).

### Phase 4 — Page de tracking publique (App Proxy)
Route App Proxy rendue côté serveur, signature vérifiée. Recherche par email / numéro de commande / (plus tard) numéro de suivi. Affiche : en-tête client + numéro, **timeline horizontale des étapes** (étapes passées pleines, étape courante active, étapes à venir grisées), bloc « dernière mise à jour » (depuis `order_stage_history`), récap commande (produits, date, total, adresse), action « Edit address » (écrit dans Shopify via `write_orders`, **bloquée après une étape configurable** proche de l'expédition). Entièrement stylée depuis `branding_settings`. Responsive mobile + desktop.

### Phase 5 — Interface agence (web responsive) + confirmation de livraison
Interface mobile-first accessible au rôle `agency` :
- Liste des commandes actives de la boutique, avec recherche/filtre par étape.
- Assignation d'un **chauffeur (libellé texte)** à une commande, pour le suivi interne de l'agence.
- Mise à jour du statut d'étape d'une commande (chaque avance écrit dans `order_stage_history` avec `source = agency`, avec un message optionnel affiché au client).
- **Marquer comme livré** : une fois la livraison faite et le bon signé sur papier, l'agence passe la commande à l'étape terminale. Cette action crée une `proof_of_delivery` (`marked_delivered_by_user_id`, `delivered_at`, `recipient_name` optionnel, photo optionnelle du bon signé). Il n'y a **pas** de capture de signature numérique dans l'app.
Aucune interface chauffeur : les chauffeurs n'ont pas de compte.

### Phase 6 — Auto-fulfillment sur confirmation de livraison
Quand une commande atteint une étape `triggers_fulfillment = true` **et** qu'une `proof_of_delivery` existe (livraison déclarée par l'agence), appelle `fulfillmentCreateV2` pour fulfiller dans Shopify avec les infos réelles. Respecte `fulfillment_rules.require_delivery_confirmation`. Journalise le résultat. Idempotent (ne fulfille jamais deux fois).

### Phase 7 — Emails automatisés (templates + séquences)
Éditeur de `email_templates` (sujet, corps, variables de fusion, aperçu). Fournis des templates par défaut **en anglais** (ex. : order confirmation, status update, out for delivery, delivered). Constructeur de `email_sequence_steps` : rattacher un template à une étape (`on_stage`) ou à un délai en jours (`delay_after_order` / `delay_after_previous`), activer/désactiver, réordonner. À `orders/create` et à chaque transition d'étape, planifie les envois correspondants via **QStash** (délais précis) et enregistre-les dans `email_sends`. Un **Vercel Cron** de secours balaie les envois `scheduled` échus. Envoi réel via **Resend** (domaine partagé). Chaque envoi loggé.

### Phase 8 — Branding & personnalisation
Éditeur de `branding_settings` avec **aperçu live** de la page de tracking : couleurs, logo (upload Vercel Blob), police, tailles de texte, textes/labels, FAQ, bandeau d'aide. Tout modifiable sans dev, par boutique.

### Phase 9 — Envoi email en masse & unitaire
Depuis la liste des commandes : sélection multiple → **envoi en masse** d'un template, ou envoi **unitaire** sur une commande. Toujours tracé dans `email_sends`.

### Phase 10 — Multi-boutiques & réutilisation
Vérifie qu'une nouvelle boutique se connecte proprement, part avec ses propres réglages indépendants (branding, étapes, séquences), sans rien casser des boutiques existantes. Aucun rebuild nécessaire.

### Phase 11 — Tests & durcissement
Tests des webhooks (HMAC, idempotence, rejeu), de l'isolation multi-tenant (une boutique ne voit jamais les données d'une autre), des permissions par rôle, du fulfillment (pas de double fulfillment, pas de fulfillment sans preuve). Gestion d'erreurs et états de chargement partout. Documentation d'usage pour l'admin.

## 8. Garde-fous à respecter absolument

- **Aucune génération d'événements de suivi fictifs.** La timeline ne reflète que des événements réels (webhooks ou saisies humaines authentifiées).
- **Aucune progression d'étape sur minuterie.** Le temps ne fait jamais avancer une commande ; seuls des événements réels le font. (Les délais ne servent qu'à **programmer des emails**, jamais à changer un statut de livraison.)
- **Pas de fulfillment sans livraison réelle confirmée par l'agence.**
- **Application entièrement en anglais.** Tout le contenu visible (UI, page de tracking, emails, backoffice, étapes et templates par défaut, messages d'erreur) est rédigé en anglais. Aucune chaîne visible en français dans l'app livrée.
- Chiffre les tokens d'accès Shopify au repos. Vérifie systématiquement HMAC (webhooks) et signature (App Proxy).
- Isolation multi-tenant stricte sur chaque requête.

## 9. Livrables attendus

Un dépôt Next.js déployable sur Vercel, migrations Drizzle incluses, `.env.example` documenté, README expliquant l'installation Shopify + la config des variables, et une note d'usage admin (gérer étapes, emails, branding, utilisateurs). Chaque phase livrée fonctionnelle et testée avant la suivante.