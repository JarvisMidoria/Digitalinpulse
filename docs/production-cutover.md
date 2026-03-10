# Production Cutover Runbook

Checklist de mise en production domaine.

## 1. Verifier le dernier build

- Build Netlify vert.
- `/`, `/admin/` et pages metier accessibles.
- Commit de reference note.
- Variables Netlify des fonctions admin presentes.

## 2. Configurer le domaine

Dans Netlify:

1. `Project configuration` -> `Domain management`.
2. `Add domain` et saisir le domaine final.
3. Appliquer les enregistrements DNS proposes.

## 3. DNS (registrar)

Configurer selon les instructions Netlify:

- `A` record vers les IP Netlify (apex).
- `CNAME` pour `www` vers `your-site.netlify.app` (si strategie www).

## 4. SSL

- Netlify provisionne automatiquement le certificat.
- Verifier que HTTPS est actif.
- Forcer la redirection HTTP -> HTTPS.

## 5. Redirections

- Choisir canonical (`www` ou non-`www`).
- Activer la redirection automatique de l'autre variante.

## 6. Smoke tests post-cutover

1. Home, pages metier, pages legales.
2. `/admin/` login.
3. Publication d'un micro changement depuis admin custom (test commit).
4. Test mobile rapide.

## 7. Backout plan

En cas d'incident critique:

1. Revenir au dernier commit stable sur `main` (revert).
2. Lancer redeploy.
3. Verifier routes critiques.
