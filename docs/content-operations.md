# Content Operations Guide

Guide court pour modifier textes et visuels sans intervention developpement.

## Prerequis

- Site Netlify connecte au repo GitHub.
- Identity active + Git Gateway actif.
- Compte admin invite et valide.

## Modifier un texte

1. Ouvrir `/admin/`.
2. Entrer dans `Contenu du site` -> `Contenu global + pages`.
3. Modifier le champ cible (titre, texte, dates, CTA).
4. Cliquer `Publish`.

Resultat: un commit est cree automatiquement sur `main`.

## Modifier un visuel

1. Ouvrir l'onglet `Media` dans `/admin/`.
2. Uploader le nouveau fichier.
3. Copier le chemin genere (`/uploads/...`) ou selectionner le media dans un champ image.
4. Publier.

## Changement urgent (veille de lancement)

1. Faire uniquement la modif minimale.
2. Publier.
3. Verifier sur le site deploye (hard refresh).
4. Confirmer le commit GitHub associe.

Temps cible: < 5 minutes.

## Rollback rapide

1. Ouvrir le dernier commit stable sur GitHub.
2. Revert ce commit.
3. Attendre le redeploy Netlify.

## Regles editoriales

- Eviter les dates 2024 sur les pages de candidature 2025/2026.
- Garder les liens legaux fonctionnels (`mailto`, reglement PDF, politique de confidentialite).
- Eviter les liens temporaires non valides.
