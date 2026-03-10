# Digital InPulse Clone

Projet de reconstruction front du site `digitalinpulse.com` avec edition continue des textes/visuels et tracabilite GitHub.

## Architecture retenue

- Site statique multi-pages dans `public/`
- Contenu centralise dans `public/content/site.json`
- Back-office simplifie dans `/admin` (UI custom, login Netlify Identity)
- Publications faites via fonctions Netlify vers GitHub (commit automatique)
- Historique complet des modifications dans les commits

## Structure

- `public/index.html` + pages dediees par route
- `public/assets/js/site.js` (rendu dynamique depuis le JSON)
- `public/assets/css/styles.css` (theme global responsive)
- `public/content/site.json` (tous les textes, liens, visuels)
- `public/admin/index.html` + `public/admin/app.js` + `public/admin/styles.css` (admin custom)
- `netlify/functions/save-content.js` (publish JSON sur GitHub)
- `netlify/functions/upload-media.js` (upload visuels dans `public/uploads`)
- `docs/audit-2026-03-10.md` (audit initial du site source)
- `docs/content-operations.md` (guide edition urgente)
- `docs/production-cutover.md` (runbook domaine + SSL)
- `docs/qa-report-2026-03-10.md` (resultats QA)
- `scripts/qa_check.py` (controle automatique pre-prod)

## Lancer en local (front)

```bash
python3 -m http.server 8080 --directory public
```

Puis ouvrir:

- `http://localhost:8080/`
- `http://localhost:8080/admin/`

Note: en local simple (`python`), la publication admin et l'upload media ne fonctionneront pas car elles passent par des fonctions Netlify.

## Edition contenu (workflow client)

1. Ouvrir `/admin/`.
2. Se connecter avec le compte Netlify Identity invite.
3. Modifier textes/visuels dans les panneaux.
4. Cliquer `Publier`.
5. Un commit est cree automatiquement sur `main`.

## Configuration Netlify (obligatoire)

Activer dans Netlify:

1. `Identity` -> `Enable Identity`
2. `Identity` -> `Registration` -> `Invite only`
3. `Identity` -> `Invite users` (emails admin)

Ajouter les variables d'environnement du projet Netlify:

- `GITHUB_TOKEN`: token GitHub avec droits `repo`
- `GITHUB_REPO`: ex `JarvisMidoria/Digitalinpulse`
- `GITHUB_BRANCH`: `main`
- `GITHUB_CONTENT_PATH`: `public/content/site.json`
- `GITHUB_MEDIA_DIR`: `public/uploads`
- `ADMIN_ALLOWED_EMAILS`: emails autorises (comma-separated)

## Deploiement + domaine

Le projet est pret pour deploiement statique (Netlify, Vercel, OVH, Nginx).
Une fois deploye:

1. pointer le DNS du domaine
2. activer HTTPS
3. verifier les redirections (`www` / non-`www`)

## Verification QA locale

```bash
python3 scripts/qa_check.py
```
