## Bug découvert : gravity-mailer (Resend) ne livre qu'à un seul destinataire (13 septembre 2026)

**Symptôme** : l'utilisateur ne recevait jamais la notification admin Gravity Prep (`type: 'basketball-mtl-prep-admin'`, envoyée à `Gavitybasketball@gmail.com`), alors que le code existait déjà (PR #32).

**Cause confirmée par test direct** (`curl` sur la fonction en production) : `gravity-mailer` n'a pas de variable `MAILER_FROM_EMAIL` configurée, donc `send-confirmation.js` envoie depuis le domaine de test Resend `onboarding@resend.dev`. **Resend restreint ce domaine à un seul destinataire : l'adresse du compte Resend lui-même** (`moqtad6@gmail.com`) — tout envoi vers une autre adresse échoue silencieusement (502, jamais vu par le visiteur grâce au `.catch(() => {})`). Confirmé par test comparatif : envoi vers `moqtad6@gmail.com` → succès ; envoi vers `Gavitybasketball@gmail.com` → échec.

**Portée réelle du bug** : ça ne touche pas que la notification Prep — **toutes les confirmations clients envoyées par `gravity-mailer`** (Coaching, Pickup, Basketball, OSMM), qui vont vers l'adresse du visiteur, échouent probablement aussi silencieusement pour n'importe quel vrai client. Personne ne l'avait remarqué puisque rien ne bloque le visiteur.

**Correctif définitif (en cours, nécessite l'utilisateur)** : vérifier un sous-domaine d'envoi dans Resend (ex. `mail.osmm-mtl.site`), ajouter les enregistrements DNS générés par Resend chez le registrar du domaine (pas accessible par Claude), puis configurer `MAILER_FROM_EMAIL` sur `gravity-mailer` une fois le domaine vérifié.

**Correctif immédiat déployé (13 septembre 2026)** : ajout d'un canal FormSubmit (même pattern que Coaching/Pickup/OSMM) dans `gravity-basketball-mtl/script.js`, vers `Gavitybasketball@gmail.com`, pour Ligue 3v3 / Ligue Maison / U15 Masculin uniquement — **pas pour Gravity Prep**, qui garde sa notification dédiée existante (`basketball-mtl-prep-admin`) pour éviter un doublon une fois Resend réparé.

## Suspension de sécurité Resend (13 septembre 2026, état actuel)

En poursuivant la vérification du domaine `mail.osmm-mtl.site` sur Resend (PR #41), une anomalie a été détectée : les enregistrements SPF affichés par Resend pour ce domaine — **et pour un domaine de test flambant neuf, sans lien avec ce projet** — pointaient vers `forge.rmta.net`, l'infrastructure d'un service tiers appelé **« SendBeam »** (`sendbeam.io`), au lieu de l'infrastructure Resend habituelle (`amazonses.com`, confirmé par la documentation officielle Resend). SendBeam est un service réel, pas un logiciel malveillant connu, mais il n'a **aucun lien légitime avec Resend** — sa présence dans les enregistrements DNS suggérés par Resend est inexpliquée (hypothèses non tranchées : extension de navigateur altérant l'affichage de la page Resend, compte Resend compromis, ou autre anomalie côté compte).

**Mesure de précaution appliquée (PR #42, mergée)** : `RESEND_SUSPENDED = true` en tête de `gravity-mailer/netlify/functions/send-confirmation.js` — court-circuite toute requête avant l'appel à `api.resend.com`, retourne un 503 explicite. **Aucun appel à l'API Resend n'est effectué tant que ce flag est actif.** Ne repasser à `false` qu'une fois l'anomalie éclaircie et confirmée réglée par l'utilisateur.

**Conséquence couverte (PR #43, mergée)** : Gravity Prep a maintenant lui aussi un filet FormSubmit (`Gavitybasketball@gmail.com`), en plus de sa notification Resend existante (actuellement muette à cause de la suspension) — il n'y a donc plus de programme sans notification admin pendant la suspension. Doublon assumé une fois Resend réactivé.

**Reste à faire côté utilisateur si on veut un jour élucider l'anomalie Resend** (non bloquant, Resend est abandonné — voir section suivante) :
1. Vérifier la sécurité du compte Resend (mot de passe, connexions récentes, clés API) — envisager de régénérer `RESEND_API_KEY`.
2. Revérifier la page de vérification de domaine Resend depuis un appareil/navigateur de confiance (sans extensions), idéalement en navigation privée, pour confirmer si les valeurs `forge.rmta.net` réapparaissent.
3. Vérifier dans la zone DNS Netlify (`osmm-mtl.site`) qu'aucun enregistrement pointant vers `rmta.net` n'a été ajouté par erreur — supprimer si c'est le cas.
4. Contacter le support Resend si l'anomalie persiste.

## Migration Resend → Brevo (13 septembre 2026)

Plutôt que d'attendre l'élucidation de l'anomalie Resend ci-dessus, l'utilisateur a choisi d'**abandonner Resend et de passer à Brevo** (ex-Sendinblue) pour l'envoi de tous les courriels transactionnels. `RESEND_SUSPENDED` est retiré (devenu inutile, Resend n'est plus appelé nulle part).

**Trois fonctions Netlify migrées** (toutes appelaient directement `api.resend.com`, remplacé par `api.brevo.com/v3/smtp/email`) :
- `gravity-mailer/netlify/functions/send-confirmation.js` — confirmations clients + notification admin Gravity Prep.
- `gravity-admin-dashboard/netlify/functions/notify-espace-joueurs.js` — alertes courriel Espace Joueurs.
- `gravity-admin-dashboard/netlify/functions/send-campaign.js` — envoi de campagnes depuis le Dashboard.

**Différences d'API à retenir** (si une nouvelle fonction envoie un courriel un jour) :
- Header d'authentification : `api-key: <clé>` (pas `Authorization: Bearer`).
- Champ expéditeur : objet `sender: { name, email }` (pas une chaîne `"Nom <adresse>"`).
- Destinataires : `to` / `bcc` sont des tableaux d'objets `{ email }` (pas des chaînes).
- Corps HTML : champ `htmlContent` (pas `html`).
- **Pas de domaine de test** : contrairement à Resend (`onboarding@resend.dev`), Brevo n'autorise aucun envoi sans expéditeur vérifié au préalable (soit une adresse simple confirmée par courriel, soit un domaine complet vérifié par DNS) — sans ça, l'API rejette la requête (pas d'envoi silencieusement dégradé comme avec le domaine de test Resend).

**Variables d'environnement Netlify à configurer par l'utilisateur** (sur les sites `gravity-mailer` ET `gravity-admin-dashboard`, chacun a ses propres variables d'environnement) :
- **`BREVO_API_KEY`** — Brevo → icône profil → SMTP & API → onglet Clés API → générer une nouvelle clé.
- **`MAILER_FROM_EMAIL`** (déjà existante pour `gravity-mailer` depuis l'époque Resend, réutilisée telle quelle) — doit être un expéditeur **vérifié dans Brevo**. Deux options : (1) expéditeur simple (rapide : ajouter l'adresse dans Brevo → Expéditeurs, Domaines & IP dédiées → cliquer le lien de confirmation reçu par courriel → envoi possible vers n'importe quel destinataire, aucun DNS à toucher) ou (2) domaine complet vérifié par DNS (`mail.osmm-mtl.site`, meilleure délivrabilité à terme, même démarche que Resend en son temps).

Tant que `BREVO_API_KEY` ou `MAILER_FROM_EMAIL` (adresse vérifiée) manque, les trois fonctions renvoient une erreur 500 explicite plutôt que d'échouer silencieusement.
