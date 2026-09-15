# DESIGN.md : Système de design de l'application

> À utiliser **avec** le prompt d'architecture (`PROMPT_Claude_Code_Tracking_App.md`). Ce document cadre l'esthétique et l'UI. Claude Code doit s'y tenir pour que l'app ait une identité propre et ne ressemble pas à un template générique. Toutes les chaînes visibles de l'app sont **en anglais** (ce document de spec est en français, mais les exemples d'UI ci-dessous sont dans la langue finale de l'app : l'anglais).

---

## 1. Portée & principe de theming

Trois familles de surfaces, deux régimes de design :

| Surface | Régime | Ce qui est fixe | Ce qui est personnalisable par boutique |
|---|---|---|---|
| Page de tracking (App Proxy) | **Thémable** | Structure, composants, mise en page, typographie de base | Couleur d'accent, logo, police, tailles de texte, textes/labels |
| Emails automatiques | **Thémable** | Gabarit, structure du bloc statut | Couleur d'accent, logo, textes |
| Backoffice admin | **Fixe** | Toute l'identité « Dispatch » ci-dessous | rien (c'est le produit de la plateforme) |
| Interface agence | **Fixe** | Toute l'identité « Dispatch » | rien |

Sur les surfaces thémables, le design par défaut ci-dessous est un **point de départ soigné**, pas une contrainte : chaque valeur personnalisable est exposée en variable CSS pilotée par `branding_settings` (voir §8).

## 2. Parti pris : « Dispatch »

L'app n'est pas un SaaS générique : c'est l'outil d'une vraie opération de livraison. L'identité s'ancre dans le vocabulaire concret du métier : **manifeste de course, itinéraire, points de passage (waypoints), dispatch, hi-vis**. La conséquence directe :

- La timeline de suivi n'est pas une barre de progression à points génériques : c'est une **ligne d'itinéraire** ponctuée de waypoints, comme une feuille de route.
- Le récap de commande est un **manifeste** (aligné, tabulaire, lisible d'un coup d'œil), pas une carte décorative.
- Le signal d'« en mouvement » emprunte au **hi-vis** du terrain (ambre de sécurité), authentique au métier de coursier, et non au bleu SaaS par défaut.

Boldness concentrée en un seul endroit : le **waypoint actif** de l'itinéraire (halo ambre, seule animation non déclenchée de la page). Tout le reste reste calme et discipliné.

## 3. Couleurs

### 3.1 Palette plateforme (backoffice + agence, fixe)

| Token | Hex | Rôle |
|---|---|---|
| `--ink` | `#131A24` | Texte principal, surfaces sombres (dispatch navy très foncé) |
| `--paper` | `#F4F5F3` | Fond clair « papier de manifeste » |
| `--surface` | `#FFFFFF` | Cartes, panneaux |
| `--signal` | `#F5A524` | **En mouvement / waypoint actif / focus** (ambre hi-vis). Usage parcimonieux. |
| `--dispatch` | `#1B2B44` | Couleur de structure et d'action primaire (boutons) |
| `--delivered` | `#2E7D5B` | **Uniquement** l'état terminal « Delivered » (vert forêt sourd) |
| `--alert` | `#C4462F` | Erreurs, actions destructrices (rouge brique) |
| `--line` | `#E2E4E0` | Filets, bordures, séparateurs |
| `--muted` | `#6B7280` | Texte secondaire |

Règles d'emploi : l'ambre `--signal` ne sert **jamais** de couleur de remplissage large ni de texte sur fond clair (contraste insuffisant) ; il souligne, entoure, marque le point actif. Les **boutons d'action primaire** utilisent `--dispatch` (fond) + blanc (texte). Le vert `--delivered` n'apparaît que sur l'étape finale, nulle part ailleurs.

### 3.2 Thème par défaut des surfaces client (thémable)

Valeurs de départ, toutes surchargeables via `branding_settings` :

| Variable CSS | Défaut | Source `branding_settings` |
|---|---|---|
| `--brand-accent` | `#1B2B44` | `primary_color` |
| `--brand-signal` | `#F5A524` | `secondary_color` |
| `--brand-surface` | `#FFFFFF` | `background_color` |
| `--brand-text` | `#131A24` | `text_color` |
| `--brand-font` | `Archivo` | `font_family` |
| `--brand-scale` | `1` | `text_size` (multiplicateur) |

## 4. Typographie

Une famille principale à caractère industriel/signalétique, ancrée dans la wayfinding logistique, plus un mono strictement réservé aux **codes réels** (numéros de commande, de suivi, horaires) où la lecture tabulaire est fonctionnelle.

- **Principale (display + UI + corps)** : **Archivo** (Google Fonts). Cut **Archivo Expanded** en 600/700 pour les grands titres (effet signalétique). Poids courants : 400, 500, 600, 700.
- **Mono (codes/ID/horaires uniquement)** : **Spline Sans Mono** ou **JetBrains Mono**. Chiffres tabulaires. Jamais pour des labels décoratifs.

Échelle de type (base 16px, ratio ~1.25 ; longueur de ligne < 80 caractères) :

| Rôle | Taille / interligne | Poids |
|---|---|---|
| Display XL | 40 / 44 | 700 Expanded |
| Display | 32 / 36 | 700 Expanded |
| H1 | 26 / 32 | 600 |
| H2 | 21 / 28 | 600 |
| H3 | 17 / 24 | 600 |
| Body | 16 / 26 | 400 |
| Small | 14 / 22 | 400/500 |
| Caption | 13 / 18 | 500 |
| Code (mono) | 15 / 22 | 500, tabular-nums |

Interdits typographiques (ce sont les tells de page générée, à ne pas faire) : accentuer un seul mot d'un titre en couleur/italique ; mettre les labels en ALL-CAPS traqués partout ; empiler un eyebrow ALL-CAPS au-dessus de chaque titre ; joindre des méta par points médians (« A · B · C ») ; suffixer les liens/boutons d'une flèche « → ». Les labels de section utilisent la **casse phrase**, discrètement.

## 5. Mise en page & structure

- **Grille** : contenu aligné à **gauche** (lecture de manifeste), largeur de lecture contenue (max ~640px sur la page de tracking, tableaux pleine largeur au backoffice).
- **Espacement** : base 4px. Échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- **Rayons (hiérarchie intentionnelle, pas un rayon unique partout)** : `0` sur les filets et lignes structurelles ; `4px` sur inputs et status pills ; `10px` sur les cartes/panneaux ; cercle plein sur les nœuds de waypoint. Ne pas appliquer le même rayon à tout.
- **Ombres** : quasi absentes. Préférer les **filets** `--line` à l'ombre grise molle générique. Une seule ombre douce admise sur les surfaces flottantes réelles (menus, modales).
- **Devices structurels porteurs de sens** : la ligne d'itinéraire encode la séquence ; le manifeste encode les faits de la commande. Pas de numérotation 01/02/03 décorative (sauf si le contenu est réellement une séquence, ce qui est le cas de l'itinéraire, où les waypoints portent un ordre).

## 6. Composants clés

### 6.1 Route line (la signature)
La timeline de suivi, ancrée « itinéraire ».

Desktop (horizontal) :
```
 ●━━━━━━━━━●━━━━━━━━━◉─────────○
 Placed    Processing  In Transit  Delivered
                       ▲ waypoint actif (halo ambre --signal)
```
Mobile (vertical) :
```
 ●  Placed
 ┃
 ●  Processing
 ┃
 ◉  In Transit   ← actif, halo ambre
 ┆
 ○  Delivered
```
- Segment parcouru : trait plein `--ink`. Segment à venir : trait pointillé `--line`.
- Nœud franchi : disque plein `--ink`. Nœud actif : disque `--ink` cerclé d'un anneau `--signal`, avec **une** pulsation lente (respecte `prefers-reduced-motion`). Nœud à venir : cercle creux `--line`.
- Nœud terminal atteint : disque `--delivered` avec coche.

### 6.2 Latest update (bloc « dernière mise à jour »)
Carte sobre, filet `--line`, coin `10px`. Titre de l'étape (H3), message (Body, `--muted`), horodatage à droite en mono. **Pas** de fond teinté criard : `--surface` ou une teinte très légère de l'accent.

### 6.3 Manifest (récap commande)
Lignes label/valeur alignées, séparées par des filets `--line`. Label `--muted` à gauche, valeur `--ink` à droite. Numéros de commande/suivi en mono. Action « Edit address » en lien discret (couleur `--brand-accent`), désactivée passé l'étape configurée.

### 6.4 Status pill
Petit badge `4px` : point coloré + libellé d'étape. Couleur du point = couleur de l'étape (`stages.color`), jamais tout le badge en aplat vif.

### 6.5 Boutons
- Primaire : fond `--dispatch` (ou `--brand-accent` côté client), texte blanc, `4px`, poids 600. Libellé = action exacte (« Mark delivered », « Advance stage », « Save changes »), pas « Submit ».
- Secondaire : contour `--line`, texte `--ink`.
- Destructif : texte/contour `--alert`.
- Focus visible partout : anneau `--signal` 2px.

### 6.6 Tables (backoffice) & listes (agence)
Backoffice : table dense, en-têtes en casse phrase, lignes séparées par `--line`, zébrure très légère admise. Agence mobile : liste de cartes empilées, une commande par carte, actions primaires accessibles au pouce.

### 6.7 Email
Gabarit table-based (compat clients mail), styles inline. Logo en tête, **bloc statut** dont le titre reflète l'étape courante (ex. « Out for delivery »), fond = teinte légère de `--brand-accent` (pas un aplat saturé), puis salutation personnalisée et manifeste condensé. Une seule couleur d'accent, cohérente avec la page.

## 7. Motion
Sobre et intentionnel. **Une seule** animation non déclenchée : la pulsation du waypoint actif. Le reste répond à l'action de l'utilisateur (ouverture, confirmation, avance d'étape → la ligne d'itinéraire progresse visiblement). Pas de fade-and-slide-up sur chaque section ni de hover-transition sur chaque carte (tells génériques). `prefers-reduced-motion` respecté.

## 8. Architecture de theming (contrat technique)

Les surfaces client lisent des **variables CSS** posées sur `:root` (ou un conteneur racine) à partir de `branding_settings` de la boutique, rendues côté serveur :

```css
:root {
  --brand-accent:  /* branding_settings.primary_color   || #1B2B44 */;
  --brand-signal:  /* branding_settings.secondary_color || #F5A524 */;
  --brand-surface: /* branding_settings.background_color || #FFFFFF */;
  --brand-text:    /* branding_settings.text_color       || #131A24 */;
  --brand-font:    /* branding_settings.font_family       || 'Archivo' */;
  --brand-scale:   /* branding_settings.text_size         || 1 */;
}
```
- Tous les composants client consomment ces variables, jamais de couleur/police en dur.
- `--brand-scale` multiplie l'échelle de type (accessibilité + réglage « text size »).
- Calculer une couleur de contraste lisible pour le texte posé sur `--brand-accent` (accent foncé → texte blanc, accent clair → texte `--ink`), pour garantir le contraste quel que soit le choix de la boutique.
- L'aperçu live du backoffice (Phase 8) applique ces mêmes variables en direct.

## 9. Voix & copywriting (en anglais)

Du point de vue de l'utilisateur final, verbes actifs, casse phrase, sans remplissage. Un même intitulé d'action tout au long d'un flux (le bouton « Mark delivered » produit un toast « Delivered »).

- États vides = invitation à agir : « No active orders yet. New orders appear here automatically. »
- Erreurs = quoi + comment, sans excuse : « We couldn't reach Shopify. Check the store connection and try again. »
- Étapes par défaut (anglais) : Order Placed, Confirmed, Processing, Out for Delivery, Delivered.
- Exemples de libellés : « Track your order », « Latest update », « Ship to », « Order no. », « Edit address », « Advance stage », « Mark delivered », « Save changes ».

## 10. Plancher de qualité (non négociable)

- Responsive jusqu'au mobile (l'interface agence est mobile-first).
- Focus clavier visible partout ; navigation clavier complète.
- Contraste AA minimum sur tout texte, y compris après theming boutique.
- `prefers-reduced-motion` respecté.
- États de chargement et états vides traités partout (pas d'écran blanc).
- Palette harmonieuse même avec un accent boutique agressif (grâce au calcul de contraste).

## 11. Anti-patterns à éviter (tells de design généré + spécifiques au projet)

- Fond crème (#F4F1EA) + serif contrasté + accent terracotta (#D97757). Interdit ici.
- Fond quasi-noir + unique accent vert acide / vermillon.
- Tout haché en cartes identiques, un seul rayon partout, même ombre grise molle sous chaque carte, dégradés décoratifs.
- Eyebrow ALL-CAPS traqué au-dessus de chaque titre, méta en « A · B · C », labels construits en « MOT » suivi d'un tiret cadratin espacé puis d'un fragment, mono pour de simples labels, flèche « → » sur les liens.
- **Spécifique projet** : ne pas reproduire l'esthétique de faux-suivi de l'app de référence (bloc statut bleu/vert générique + « Updated every 12 to 48 hours »). Notre suivi reflète des événements réels ; le ton visuel doit inspirer une **confiance honnête**, pas masquer un délai.