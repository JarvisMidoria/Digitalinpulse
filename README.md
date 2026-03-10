# Digital InPulse Clone

Projet de reconstruction front du site `digitalinpulse.com` avec edition continue des textes/visuels et tracabilite GitHub.

## Architecture retenue

- Site statique multi-pages dans `public/`
- Contenu centralise dans `public/content/site.json`
- Back-office `/admin` base sur Decap CMS (edits pushes directement sur GitHub)
- Historique complet des modifications dans les commits

## Structure

- `public/index.html` + pages dediees par route
- `public/assets/js/site.js` (rendu dynamique depuis le JSON)
- `public/assets/css/styles.css` (theme global responsive)
- `public/content/site.json` (tous les textes, liens, visuels)
- `public/admin/config.yml` (schema des champs editables)
- `docs/audit-2026-03-10.md` (audit initial du site source)

## Lancer en local

```bash
python3 -m http.server 8080 --directory public
```

Puis ouvrir:

- `http://localhost:8080/`
- `http://localhost:8080/admin/`

## Edition contenu (workflow client)

1. Ouvrir `/admin`.
2. Modifier texte/image/URL dans les champs.
3. Publier la modification.
4. Decap cree un commit GitHub automatiquement.

## Configuration OAuth Decap (obligatoire)

Le fichier `public/admin/config.yml` pointe vers:

```yml
backend:
  name: github
  repo: JarvisMidoria/Digitalinpulse
  branch: main
  base_url: https://YOUR-DECAP-OAUTH-BRIDGE
  auth_endpoint: /auth
```

Avant usage production, remplacer `base_url` par votre endpoint OAuth (Decap OAuth server, Netlify auth, ou endpoint custom).

## Deploiement + domaine

Le projet est pret pour deploiement statique (Netlify, Vercel, OVH, Nginx).
Une fois deploye:

1. pointer le DNS du domaine
2. activer HTTPS
3. verifier les redirections (`www` / non-`www`)
