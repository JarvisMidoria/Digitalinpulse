# Content Operations Guide

Guide court pour modifier textes et visuels sans intervention developpement.

## Prerequis

- Site Netlify connecte au repo GitHub.
- Identity active.
- Compte admin invite et valide.
- Variables Netlify configurees (`GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_CONTENT_PATH`, `GITHUB_MEDIA_DIR`).
- Variables soumission configurees (`SUBMISSIONS_GITHUB_REPO`, `SUBMISSIONS_GITHUB_BRANCH`, `SUBMISSIONS_DATA_DIR`, `SUBMISSIONS_ALLOWED_ORIGINS`).

## Modifier un texte

1. Ouvrir `/admin/`.
2. Aller dans le panneau cible (`Global`, `Accueil`, `Le concours`, etc.).
3. Modifier le champ cible (titre, texte, dates, CTA).
4. Cliquer `Publier`.

Note: la video home se pilote depuis `Accueil` (`pages.home.video.url`, `title`, `text`, `poster`).

Resultat: un commit est cree automatiquement sur `main`.

## Modifier un visuel

1. Ouvrir le panneau `Media` dans `/admin/`.
2. Uploader le nouveau fichier.
3. Copier l'URL generee (`/uploads/...`).
4. Coller cette URL dans un champ image.
5. Publier.

## Changement urgent (veille de lancement)

1. Faire uniquement la modif minimale.
2. Publier.
3. Verifier sur le site deploye (hard refresh).
4. Confirmer le commit GitHub associe.

Temps cible: < 5 minutes.

## Verification formulaire (post-modif)

1. Ouvrir une page candidature (`/tech-for-competitivity/` ou `/women-for-innovation/`).
2. Envoyer une candidature test.
3. Verifier la reference retournee a l'ecran.
4. Verifier le commit de soumission dans le repo de stockage.
5. Ouvrir `/admin/` -> panneau `Candidatures` pour verifier la ligne creee.
6. Utiliser `Exporter CSV (Excel)` pour tester l'export.

## Rollback rapide

1. Ouvrir le dernier commit stable sur GitHub.
2. Revert ce commit.
3. Attendre le redeploy Netlify.

## Regles editoriales

- Eviter les dates 2024 sur les pages de candidature 2025/2026.
- Garder les liens legaux fonctionnels (`mailto`, reglement PDF, politique de confidentialite).
- Eviter les liens temporaires non valides.
