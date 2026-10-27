# 1day1repo

Un repo GitHub par jour, présenté sur Instagram ([@1day1repo](https://www.instagram.com/1day1repo/)) et archivé ici automatiquement.

Le site est statique (HTML, CSS, JS, sans build). Les données sont dans [`data/repos.json`](data/repos.json), mises à jour par une GitHub Action.

## Comment un post Instagram arrive sur le site

```
Post Instagram ──► GitHub Action (toutes les 3 h) ──► API GitHub ──► data/repos.json ──► GitHub Pages
```

1. [`sync.yml`](.github/workflows/sync.yml) lit les derniers posts de @1day1repo via l'API Instagram.
2. Dans chaque légende, [`scripts/sync.mjs`](scripts/sync.mjs) cherche le repo cité, dans cet ordre :
   - un lien `github.com/owner/name` ;
   - sinon un `owner/name` seul, par exemple `📦 astral-sh/uv`.
3. Le script récupère ensuite sur l'API GitHub la description, le langage, les étoiles, la licence et les topics, puis ajoute une entrée.
4. Le commit déclenche le déploiement du site.

👉 **Pour que ça marche : mets toujours le lien GitHub (ou `owner/name`) dans la légende du post.**

Le numéro du jour (`#001`, `#002`…) est calculé selon l'ordre chronologique. Le premier vrai repo synchronisé supprime les repos d'exemple.

## Mise en place (une seule fois)

### 1. Activer GitHub Pages

**Settings → Pages → Build and deployment → Source : GitHub Actions.**

### 2. Connecter Instagram

Le compte @1day1repo doit être un **compte professionnel** (Créateur ou Entreprise) : dans l'app Instagram, Paramètres → Type de compte.

1. Va sur [developers.facebook.com](https://developers.facebook.com/apps) → **Créer une app** → cas d'usage **« Gérer les messages et le contenu sur Instagram »**.
2. Dans **API Instagram → Configuration de l'API avec connexion Instagram** :
   - ajoute @1day1repo comme testeur Instagram et accepte l'invitation dans l'app Instagram (Paramètres → Apps et sites web) ;
   - clique sur **Générer un token** pour le compte. C'est un token longue durée, valable 60 jours.
3. Sur le repo GitHub : **Settings → Secrets and variables → Actions → New repository secret**
   - Nom : `IG_ACCESS_TOKEN`
   - Valeur : le token.
4. **Actions → Sync Instagram → site → Run workflow** pour tester.

> ⏰ Le token expire au bout de 60 jours. Pense à le régénérer et à mettre à jour le secret avant l'échéance.

Sans token, l'Action tourne quand même mais ignore Instagram : seul l'ajout manuel fonctionne.

## Ajouter un repo à la main

Depuis GitHub (marche aussi dans l'app mobile) : **Actions → Sync Instagram → site → Run workflow**, puis remplis `repo` (`owner/name` ou l'URL) et, si tu veux, le lien du post.

Ou en local :

```bash
node scripts/sync.mjs --add astral-sh/uv --instagram-url https://www.instagram.com/p/XXXX/
```

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. Le site doit passer par un serveur pour charger le JSON.

## Personnaliser

- Couleurs et polices : variables CSS en haut de [`style.css`](style.css).
- Lien GitHub du compte : renseigne `site.github` dans `data/repos.json`, par exemple `"https://github.com/1day1repo"`. Il apparaît alors dans le menu, l'encart « suivre » et le bas de page.
