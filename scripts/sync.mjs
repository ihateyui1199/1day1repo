#!/usr/bin/env node
/*
 * Synchronise data/repos.json avec Instagram et GitHub.
 *
 *   node scripts/sync.mjs --instagram
 *       Lit les derniers posts de @1day1repo (IG_ACCESS_TOKEN), trouve le repo
 *       GitHub cité dans chaque légende et l'ajoute s'il n'y est pas déjà.
 *
 *   node scripts/sync.mjs --add owner/name [--instagram-url URL] [--date AAAA-MM-JJ] [--note "texte"]
 *       Ajoute un repo à la main.
 *
 *   node scripts/sync.mjs --refresh
 *       Met à jour étoiles, description, topics… de tous les repos.
 *
 * Variables d'environnement : IG_ACCESS_TOKEN (Instagram), GITHUB_TOKEN (facultatif,
 * évite la limite de 60 requêtes/heure de l'API GitHub).
 * Aucune dépendance : Node 20+ suffit.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "repos.json");
const TZ = "Europe/Paris";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
};

const log = (...m) => console.log("•", ...m);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

// ---------- GitHub ----------
async function github(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "1day1repo-sync",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} pour ${repo} : ${await res.text()}`);
  const r = await res.json();
  const license = r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null;
  return {
    repo: r.full_name,
    url: r.html_url,
    description: r.description || "",
    language: r.language || null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    license,
    topics: r.topics || [],
    homepage: r.homepage || "",
  };
}

// "https://github.com/owner/name/tree/main?x" → "owner/name"
const cleanRepo = (s) =>
  s
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "")
    .replace(/[#?].*$/, "")
    .split("/")
    .slice(0, 2)
    .join("/")
    .replace(/\.git$/, "")
    .replace(/[).,;:!?]+$/, "");

// Repos candidats trouvés dans une légende, du plus fiable au moins fiable.
function candidates(caption = "") {
  const out = [];
  for (const m of caption.matchAll(/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)/gi)) out.push(m[1]);
  for (const m of caption.matchAll(/(?:^|[\s(📦🔗👉➡️:])@?([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100})(?=$|[\s),.!?])/gmu)) {
    if (/[A-Za-z]/.test(m[1].split("/")[0])) out.push(m[1]);
  }
  return [...new Set(out.map(cleanRepo))].filter((r) => /^[^/]+\/[^/]+$/.test(r));
}

// ---------- Instagram ----------
async function instagramPosts(token) {
  const posts = [];
  let url = `https://graph.instagram.com/me/media?fields=id,caption,permalink,timestamp&limit=50&access_token=${encodeURIComponent(token)}`;
  // Les 100 derniers posts suffisent : le script tourne plusieurs fois par jour.
  while (url && posts.length < 100) {
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok) throw new Error(`Instagram ${res.status} : ${JSON.stringify(body.error || body)}`);
    posts.push(...body.data);
    url = body.paging?.next;
  }
  return posts;
}

const captionNote = (caption = "") =>
  caption
    .split("\n")
    .filter((l) => !/^\s*(#\w+\s*)+$/u.test(l)) // lignes de hashtags
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 600);

// ---------- Main ----------
const data = JSON.parse(await readFile(DATA, "utf8"));
let changed = false;

function upsert(entry) {
  const existing = data.repos.find((r) => r.repo.toLowerCase() === entry.repo.toLowerCase() && !r.example);
  if (existing) {
    if (entry.instagram && !existing.instagram) {
      existing.instagram = entry.instagram;
      changed = true;
      log(`lien Instagram ajouté à ${existing.repo}`);
    } else {
      log(`déjà présent : ${existing.repo}`);
    }
    return;
  }
  // Le premier vrai repo fait disparaître les exemples.
  if (!entry.example && data.repos.some((r) => r.example)) {
    data.repos = data.repos.filter((r) => !r.example);
    log("repos d'exemple supprimés");
  }
  data.repos.push(entry);
  changed = true;
  log(`ajouté : ${entry.repo} (${entry.date})`);
}

const addArg = opt("--add");
if (addArg) {
  const repo = cleanRepo(addArg);
  const meta = await github(repo);
  if (!meta) throw new Error(`Repo introuvable sur GitHub : ${repo}`);
  upsert({
    date: opt("--date") || today(),
    ...meta,
    instagram: opt("--instagram-url") || "",
    note: opt("--note") || "",
    ...(flag("--example") ? { example: true } : {}),
  });
}

if (flag("--instagram")) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) {
    console.warn("⚠ IG_ACCESS_TOKEN absent : lecture d'Instagram ignorée (voir README).");
  } else {
    const known = new Set(data.repos.map((r) => r.instagram).filter(Boolean));
    const posts = (await instagramPosts(token)).filter((p) => !known.has(p.permalink));
    log(`${posts.length} post(s) Instagram pas encore dans la bibliothèque`);
    // Du plus ancien au plus récent pour garder l'ordre des jours.
    for (const p of posts.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      let meta = null;
      for (const c of candidates(p.caption)) {
        meta = await github(c);
        if (meta) break;
      }
      if (!meta) {
        console.warn(`⚠ aucun repo GitHub trouvé dans ${p.permalink}`);
        continue;
      }
      upsert({
        date: new Date(p.timestamp).toLocaleDateString("sv-SE", { timeZone: TZ }),
        ...meta,
        instagram: p.permalink,
        note: captionNote(p.caption),
      });
    }
  }
}

if (flag("--refresh")) {
  for (const r of data.repos) {
    const meta = await github(r.repo);
    if (!meta) {
      console.warn(`⚠ ${r.repo} n'existe plus sur GitHub, conservé tel quel`);
      continue;
    }
    const before = JSON.stringify(r);
    Object.assign(r, meta);
    if (JSON.stringify(r) !== before) changed = true;
  }
  log(`${data.repos.length} repos rafraîchis`);
}

if (changed) {
  data.repos.sort((a, b) => a.date.localeCompare(b.date));
  data.updated = new Date().toISOString();
  await writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
  log("data/repos.json mis à jour");
} else {
  log("rien de nouveau");
}
