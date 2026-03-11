# Pre-Delivery Checklist

Checklist operationnelle pour livrer et lancer le site sans regression.

## Scope

- Front public (desktop + mobile)
- Back-office `/admin/`
- Soumission candidatures (`submit-application`)
- Inbox + export CSV (`list-submissions`)
- Domaine + SSL + redirections

## T-72h (stabilisation)

- [ ] Geler les changements structurels (pas de refacto de derniere minute).
- [ ] Verifier que les variables Netlify sont presentes:
  - [ ] `GITHUB_TOKEN`
  - [ ] `GITHUB_REPO`
  - [ ] `GITHUB_BRANCH`
  - [ ] `GITHUB_CONTENT_PATH`
  - [ ] `GITHUB_MEDIA_DIR`
  - [ ] `ADMIN_ALLOWED_EMAILS`
  - [ ] `SUBMISSIONS_GITHUB_REPO` / `SUBMISSIONS_GITHUB_BRANCH` / `SUBMISSIONS_DATA_DIR`
  - [ ] `SUBMISSIONS_ALLOWED_ORIGINS`
  - [ ] `RESEND_API_KEY` + `SUBMISSIONS_NOTIFY_EMAILS` (si email active)
  - [ ] `SUBMISSIONS_CRM_WEBHOOK_URL` (si CRM actif)
- [ ] Verifier que le build Netlify passe sur `main`.
- [ ] Lancer:
  - [ ] `python3 scripts/qa_check.py`
- [ ] Corriger tout resultat `FAIL` avant de continuer.

## T-24h (validation fonctionnelle)

- [ ] Verifier chaque route publique:
  - [ ] `/`
  - [ ] `/digital-in-pulse/`
  - [ ] `/le-principe/`
  - [ ] `/tech-for-competitivity/`
  - [ ] `/women-for-innovation/`
  - [ ] `/mentions-legales/`
  - [ ] `/conditions-generales-dutilisation/`
  - [ ] `/politique-relative-a-lutilisation-des-cookies/`
  - [ ] `/politique-de-confidentialite/`
- [ ] Verifier le rendu mobile (menu, hero, blocs programmes, formulaire).
- [ ] Verifier la page `404` custom.
- [ ] Verifier `/admin/`:
  - [ ] Login Netlify Identity
  - [ ] Edition d'un texte
  - [ ] Upload media
  - [ ] Publication (commit GitHub cree)
- [ ] Verifier candidatures:
  - [ ] Envoi test Tech
  - [ ] Envoi test Women
  - [ ] Presence des lignes dans l'onglet `Candidatures`
  - [ ] Export `CSV (Excel)` fonctionnel

## T-2h (pre-go-live)

- [ ] Verifier qu'aucun commit non valide n'est en attente.
- [ ] Noter le commit de reference (`git rev-parse --short HEAD`).
- [ ] Verifier que `SUBMISSIONS_ALLOWED_ORIGINS` pointe bien vers le domaine final.
- [ ] Verifier que `ADMIN_ALLOWED_EMAILS` contient uniquement les comptes admin attendus.
- [ ] Hard refresh sur les pages critiques depuis 2 navigateurs differents.

## Go Live (cutover domaine)

- [ ] Ajouter le domaine dans Netlify.
- [ ] Configurer DNS (A/CNAME) selon Netlify.
- [ ] Attendre certificat SSL actif.
- [ ] Forcer redirection HTTP -> HTTPS.
- [ ] Choisir canonical (`www` ou non-`www`) et rediriger l'autre.
- [ ] Relancer smoke test rapide:
  - [ ] Home + pages programmes + pages legales
  - [ ] `/admin/` login
  - [ ] 1 candidature test + export CSV

## T+24h (hypercare)

- [ ] Verifier qu'au moins un edit admin est passe sans erreur.
- [ ] Verifier qu'au moins une candidature reelle (ou test monitor) est bien stockee.
- [ ] Verifier email/CRM (si actifs).
- [ ] Verifier absence d'erreur critique Netlify Functions.
- [ ] Archiver un mini compte-rendu de livraison (date, commit, domaine, incidents).

## Go / No-Go

Passage en production autorise seulement si:

- [ ] `python3 scripts/qa_check.py` = 100% PASS
- [ ] Login admin + publication = OK
- [ ] Soumission formulaire + listing + export CSV = OK
- [ ] SSL actif et redirections valides

Si un point est KO, status = `NO-GO`, correction puis nouvelle validation.
