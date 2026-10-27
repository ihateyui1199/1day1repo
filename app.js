(async () => {
  const $ = (s) => document.querySelector(s);
  const LANG_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", Go: "#00ADD8", Rust: "#dea584",
    Java: "#b07219", Kotlin: "#A97BFF", Swift: "#F05138", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
    Ruby: "#701516", PHP: "#4F5D95", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c", Vue: "#41b883",
    Svelte: "#ff3e00", Dart: "#00B4AB", Elixir: "#6e4a7e", Zig: "#ec915c", Lua: "#000080", Jupyter: "#DA5B0B",
    "Jupyter Notebook": "#DA5B0B", Nix: "#7e7eff", Haskell: "#5e5086", Scala: "#c22d40", MDX: "#fcb32c",
  };
  const langColor = (l) => LANG_COLORS[l] || "#8b949e";
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pad = (n) => String(n).padStart(3, "0");
  const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const fmtStars = (n = 0) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "k" : String(n));
  const iso = (d) => d.toISOString().slice(0, 10);

  let data;
  try {
    data = await fetch("data/repos.json", { cache: "no-cache" }).then((r) => r.json());
  } catch {
    document.querySelector("main").innerHTML =
      '<p class="wrap nothing">Impossible de charger data/repos.json. Ouvre le site via un serveur (voir README).</p>';
    return;
  }

  // Jour n = n-ième repo dans l'ordre chronologique.
  const repos = [...data.repos].sort((a, b) => a.date.localeCompare(b.date)).map((r, i) => ({ ...r, day: i + 1 }));
  const byDate = Object.fromEntries(repos.map((r) => [r.date, r]));
  const byDay = Object.fromEntries(repos.map((r) => [r.day, r]));
  const latest = repos[repos.length - 1];

  // Lien GitHub du compte : affiché partout dès qu'il est renseigné dans data/repos.json.
  if (data.site?.github) {
    document.querySelectorAll("[data-github]").forEach((a) => {
      a.href = data.site.github;
      a.hidden = false;
    });
  }
  $("#updated").textContent = data.updated ? "mis à jour le " + fmtDate(data.updated.slice(0, 10)) : "";

  // ---------- Compteur ----------
  const counter = $("#dayCount");
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1000);
    counter.textContent = pad(Math.round(repos.length * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---------- Calendrier (26 semaines) ----------
  const level = (r) => (!r ? 0 : r.stars < 1000 ? 1 : r.stars < 10000 ? 2 : r.stars < 50000 ? 3 : 4);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 25 * 7); // lundi, il y a 25 semaines
  const cells = [];
  for (let d = new Date(start); cells.length < 26 * 7; d.setDate(d.getDate() + 1)) {
    const key = iso(d);
    const r = byDate[key];
    const future = d > today;
    const label = r ? `Jour ${r.day} · ${r.repo} · ★ ${fmtStars(r.stars)}` : fmtDate(key);
    cells.push(
      `<button class="l${level(r)}${r ? " has" : ""}${future ? " future" : ""}" ${r ? `data-day="${r.day}"` : 'tabindex="-1"'} title="${esc(label)}" aria-label="${esc(label)}"></button>`
    );
  }
  $("#calendar").innerHTML = cells.join("");
  $("#calCaption").textContent = `${repos.filter((r) => r.date >= iso(start)).length} repos ces 6 derniers mois · couleur = étoiles`;
  $(".cal-scroll").scrollLeft = 9999;
  $("#calendar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (b) openDrawer(+b.dataset.day);
  });

  // ---------- Repo du jour ----------
  const nameHtml = (r) => {
    const [owner, name] = r.repo.split("/");
    return `<span class="owner">${esc(owner)}/</span>${esc(name)}`;
  };
  const statsHtml = (r) => `<div class="stats">
      ${r.language ? `<span><span class="dot" style="background:${langColor(r.language)}"></span><b>${esc(r.language)}</b></span>` : ""}
      <span>★ <b>${fmtStars(r.stars)}</b></span>
      ${r.forks != null ? `<span>⑂ <b>${fmtStars(r.forks)}</b></span>` : ""}
      ${r.license ? `<span>⚖ ${esc(r.license)}</span>` : ""}
    </div>`;
  const cloneHtml = (r) =>
    `<div class="clone"><code>git clone https://github.com/${esc(r.repo)}.git</code><button type="button" data-copy="git clone https://github.com/${esc(r.repo)}.git">copier</button></div>`;
  const linksHtml = (r) => `<div class="btn-row">
      <a class="btn btn-solid" href="${esc(r.url || "https://github.com/" + r.repo)}" target="_blank" rel="noopener">Voir sur GitHub ↗</a>
      ${r.instagram ? `<a class="btn btn-line" href="${esc(r.instagram)}" target="_blank" rel="noopener">Le post Insta ↗</a>` : r.homepage ? `<a class="btn btn-line" href="${esc(r.homepage)}" target="_blank" rel="noopener">Site du projet ↗</a>` : ""}
    </div>`;

  if (latest) {
    $("#today").innerHTML = `
      <p class="today-label"><span class="pulse"></span> jour ${pad(latest.day)} · ${fmtDate(latest.date)} · le dernier repo</p>
      <div class="today-grid">
        <div>
          <h2 id="todayTitle">${nameHtml(latest)}</h2>
          <p class="desc">${esc(latest.description || "")}</p>
          ${statsHtml(latest)}
          ${(latest.topics || []).length ? `<div class="topics">${latest.topics.slice(0, 6).map((t) => `<span class="topic">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="today-side">${cloneHtml(latest)}${linksHtml(latest)}</div>
      </div>`;
  } else {
    $("#today").remove();
  }

  // ---------- Archive ----------
  const state = { q: "", lang: null, sort: "day" };
  const langCounts = repos.reduce((acc, r) => ((acc[r.language || "Autre"] = (acc[r.language || "Autre"] || 0) + 1), acc), {});
  const langs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);

  const renderLangFilter = () => {
    $("#langFilter").innerHTML = [["", repos.length], ...langs]
      .map(([l, n]) => `<button class="lang-chip" data-lang="${esc(l)}" aria-pressed="${(state.lang || "") === l}">${l ? `<span class="dot" style="background:${langColor(l)}"></span>${esc(l)}` : "tous"}<small>${n}</small></button>`)
      .join("");
  };
  const setLang = (l) => {
    state.lang = l || null;
    renderLangFilter();
    renderRows();
  };
  $("#langFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) setLang(b.dataset.lang);
  });

  const highlight = (text, q) => {
    const safe = esc(text);
    if (!q) return safe;
    const words = norm(q).split(/\s+/).filter(Boolean);
    const n = norm(safe);
    const marks = [];
    words.forEach((w) => {
      let i = n.indexOf(w);
      while (i !== -1) { marks.push([i, i + w.length]); i = n.indexOf(w, i + w.length); }
    });
    if (!marks.length) return safe;
    marks.sort((a, b) => a[0] - b[0]);
    let out = "", pos = 0;
    for (const [a, b] of marks) {
      if (a < pos) continue;
      out += safe.slice(pos, a) + "<mark>" + safe.slice(a, b) + "</mark>";
      pos = b;
    }
    return out + safe.slice(pos);
  };

  const renderRows = () => {
    const q = state.q;
    const words = norm(q).split(/\s+/).filter(Boolean);
    const list = repos
      .filter((r) => !state.lang || (r.language || "Autre") === state.lang)
      .filter((r) => {
        const hay = norm([r.repo, r.description, r.language, (r.topics || []).join(" "), r.note].join(" "));
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => (state.sort === "stars" ? b.stars - a.stars : state.sort === "name" ? a.repo.localeCompare(b.repo) : b.day - a.day));

    $("#rows").innerHTML = list
      .map((r) => {
        const [owner, name] = r.repo.split("/");
        return `<li class="row" data-day="${r.day}" tabindex="0">
          <span class="row-day">#${pad(r.day)}</span>
          <div>
            <div class="row-name"><span class="owner">${highlight(owner, q)}/</span>${highlight(name, q)}${r.example ? '<span class="tag-ex">exemple</span>' : ""}</div>
            <div class="row-desc">${highlight(r.description || "", q)}</div>
          </div>
          <span class="row-lang">${r.language ? `<span class="dot" style="background:${langColor(r.language)}"></span>${esc(r.language)}` : ""}</span>
          <span class="row-stars">★ ${fmtStars(r.stars)}</span>
        </li>`;
      })
      .join("");
    $("#nothing").hidden = list.length > 0;
  };
  const openRow = (e) => {
    const li = e.target.closest(".row");
    if (li && (e.type === "click" || e.key === "Enter")) openDrawer(+li.dataset.day);
  };
  $("#rows").addEventListener("click", openRow);
  $("#rows").addEventListener("keydown", openRow);
  $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderRows(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderRows(); });

  // ---------- Langages ----------
  $("#langBar").innerHTML = langs
    .map(([l, n]) => `<span style="flex:${n};background:${langColor(l)}" title="${esc(l)} · ${n}"></span>`)
    .join("");
  $("#langList").innerHTML = langs
    .map(([l, n]) => `<li><button data-lang="${esc(l)}"><span class="dot" style="background:${langColor(l)}"></span>${esc(l)}<small>${Math.round((n / repos.length) * 100)}%</small></button></li>`)
    .join("");
  $("#langList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    setLang(b.dataset.lang);
    $("#archive").scrollIntoView();
  });

  // ---------- Tiroir ----------
  const drawer = $("#drawer");
  let lastFocus = null;
  const openDrawer = (day) => {
    const r = byDay[day];
    if (!r) return;
    lastFocus = document.activeElement;
    $("#drawerBody").innerHTML = `
      <p class="dday">jour ${pad(r.day)} · ${fmtDate(r.date)}</p>
      <h3 id="drawerTitle">${nameHtml(r)}</h3>
      <p class="desc">${esc(r.description || "")}</p>
      ${statsHtml(r)}
      ${(r.topics || []).length ? `<div class="topics">${r.topics.map((t) => `<span class="topic">${esc(t)}</span>`).join("")}</div>` : ""}
      ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
      ${cloneHtml(r)}
      ${linksHtml(r)}
      ${r.example ? '<p class="example-warn">Repo d\'exemple : il disparaîtra dès que le premier vrai post sera synchronisé.</p>' : ""}`;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    $(".drawer-panel").focus();
    history.replaceState(null, "", "#jour-" + r.day);
  };
  const closeDrawer = () => {
    if (!drawer.classList.contains("open")) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    history.replaceState(null, "", location.pathname + location.search);
    lastFocus?.focus();
  };
  drawer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDrawer(); });

  // Copier la commande git clone
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.copy);
    b.textContent = "copié ✓";
    setTimeout(() => (b.textContent = "copier"), 1500);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
    if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      $("#q").focus();
    }
  });

  renderLangFilter();
  renderRows();
  const m = location.hash.match(/^#jour-(\d+)$/);
  if (m) openDrawer(+m[1]);
})();
