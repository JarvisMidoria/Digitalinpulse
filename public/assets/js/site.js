const ROUTE_TO_KEY = {
  "/": "home",
  "/digital-in-pulse": "digital_in_pulse",
  "/le-principe": "le_principe",
  "/tech-for-competitivity": "tech_for_competitivity",
  "/women-for-innovation": "women_for_innovation",
  "/mentions-legales": "mentions_legales",
  "/politique-relative-a-lutilisation-des-cookies": "politique_cookies",
  "/conditions-generales-dutilisation": "conditions_utilisation",
};

const PROGRAM_KEYS = new Set(["tech_for_competitivity", "women_for_innovation"]);
const LEGAL_KEYS = new Set(["mentions_legales", "politique_cookies", "conditions_utilisation"]);

const identityTokenPattern = /(invite_token|recovery_token|confirmation_token|email_change_token)=/;
const hasIdentityToken = identityTokenPattern.test(window.location.hash) || identityTokenPattern.test(window.location.search);
if (!window.location.pathname.startsWith("/admin") && hasIdentityToken) {
  const suffix = `${window.location.search}${window.location.hash}`;
  window.location.replace(`/admin/${suffix}`);
}

const mainNode = document.querySelector("main[data-page]");
const pageKey = mainNode?.dataset.page || ROUTE_TO_KEY[normalizePath(window.location.pathname)] || "home";

init().catch((error) => {
  console.error(error);
  if (mainNode) {
    mainNode.innerHTML = `
      <section class="section">
        <div class="container">
          <h2>Erreur de chargement</h2>
          <p>Le contenu central n'a pas pu etre charge. Verifiez le fichier <code>/content/site.json</code>.</p>
        </div>
      </section>
    `;
  }
});

async function init() {
  const content = await fetchContent();
  applyTheme(content.meta || {});
  renderNavigation(content, pageKey);
  renderFooter(content);
  renderPage(content, pageKey);
  wireMobileMenu();
}

async function fetchContent() {
  const response = await fetch("/content/site.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load content: ${response.status}`);
  }
  return response.json();
}

function applyTheme(meta) {
  const root = document.documentElement.style;
  if (meta.primaryColor) {
    root.setProperty("--brand", meta.primaryColor);
  }
  if (meta.accentColor) {
    root.setProperty("--accent", meta.accentColor);
  }
}

function renderNavigation(content, currentKey) {
  const host = document.querySelector("[data-site-nav]");
  if (!host) {
    return;
  }

  const meta = content.meta || {};
  const links = (content.navigation || [])
    .map((item) => {
      const isActive = ROUTE_TO_KEY[normalizePath(item.url || "")] === currentKey;
      return `<a class="nav-link${isActive ? " active" : ""}" href="${safeUrl(item.url)}">${escapeHtml(item.label)}</a>`;
    })
    .join("");

  host.innerHTML = `
    <div class="topline">
      <div class="container">
        <span>${escapeHtml(meta.tagline || "")}</span>
        <a href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a>
      </div>
    </div>
    <div class="site-header" data-site-header>
      <div class="container">
        <a class="logo" href="/">${escapeHtml(meta.siteName || "Digital InPulse")}</a>
        <button class="menu-toggle" type="button" data-menu-toggle>Menu</button>
        <nav class="nav-links">
          ${links}
        </nav>
      </div>
    </div>
  `;
}

function renderFooter(content) {
  const host = document.querySelector("[data-site-footer]");
  if (!host) {
    return;
  }

  const meta = content.meta || {};
  const footer = content.footer || {};

  const legalLinks = (footer.legalLinks || [])
    .map((item) => `<a class="footer-link" href="${safeUrl(item.url)}">${escapeHtml(item.label)}</a>`)
    .join("");

  const socialLinks = (footer.socials || [])
    .map((item) => `<a class="footer-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`)
    .join("");

  const partnerLinks = (footer.partners || [])
    .map((item) => `<a class="footer-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`)
    .join("");

  host.classList.add("site-footer");
  host.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <section class="footer-block">
          <h4>Liens utiles</h4>
          <div class="footer-list">${legalLinks}</div>
        </section>
        <section class="footer-block">
          <h4>Partenaires</h4>
          <div class="footer-list">${partnerLinks}</div>
        </section>
        <section class="footer-block">
          <h4>Contact & reseaux</h4>
          <div class="footer-list">
            <a class="footer-link" href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a>
            ${socialLinks}
          </div>
        </section>
      </div>
      <div class="footer-bottom">${escapeHtml(meta.copyright || "")}</div>
    </div>
  `;
}

function renderPage(content, currentKey) {
  if (!mainNode) {
    return;
  }

  const pages = content.pages || {};
  const page = pages[currentKey];
  if (!page) {
    mainNode.innerHTML = `
      <section class="section">
        <div class="container">
          <h2>Page introuvable</h2>
          <p>Le contenu de cette page n'existe pas encore dans le fichier de contenu.</p>
        </div>
      </section>
    `;
    return;
  }

  if (page.hero?.title && content.meta?.siteName) {
    document.title = `${page.hero.title} | ${content.meta.siteName}`;
  }

  if (currentKey === "home") {
    mainNode.innerHTML = renderHome(page);
    return;
  }

  if (currentKey === "digital_in_pulse") {
    mainNode.innerHTML = renderContest(page);
    return;
  }

  if (currentKey === "le_principe") {
    mainNode.innerHTML = renderPrinciple(page);
    return;
  }

  if (PROGRAM_KEYS.has(currentKey)) {
    mainNode.innerHTML = renderProgram(page, currentKey);
    return;
  }

  if (LEGAL_KEYS.has(currentKey)) {
    mainNode.innerHTML = renderLegal(page);
    return;
  }

  mainNode.innerHTML = "";
}

function renderHome(page) {
  const hero = renderHero(page.hero, { secondaryAction: page.hero?.secondaryAction });

  const pillars = (page.pillars || [])
    .map(
      (item) => `
        <article class="card">
          <div class="card-content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `,
    )
    .join("");

  const categories = (page.categories || [])
    .map(
      (item) => `
        <article class="card">
          <img class="media" src="${safeUrl(item.image)}" alt="${escapeAttr(item.title)}" />
          <div class="card-content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
            <div class="submit-row">
              <a class="btn btn-primary" href="${safeUrl(item.url)}">${escapeHtml(item.ctaLabel || "En savoir plus")}</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  const testimonials = (page.testimonials || [])
    .map(
      (item) => `
        <article class="card">
          <div class="card-content">
            <p>"${escapeHtml(item.quote)}"</p>
            <p><strong>${escapeHtml(item.author)}</strong><br />${escapeHtml(item.role)}</p>
          </div>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.introTitle || "")}</h2>
        <p>${escapeHtml(page.introText || "")}</p>
        <div class="grid pillars">${pillars}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.categoriesTitle || "")}</h2>
        <p>${escapeHtml(page.categoriesText || "")}</p>
        <div class="grid cards-2">${categories}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.testimonialsTitle || "")}</h2>
        <div class="grid cards-3">${testimonials}</div>
      </div>
    </section>
  `;
}

function renderContest(page) {
  const hero = renderHero(page.hero);
  const timeline = (page.timeline || [])
    .map(
      (item) => `
        <article class="timeline-item">
          <span class="timeline-label">${escapeHtml(item.date)}</span>
          <h3>${escapeHtml(item.step)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container split">
        <article>
          <h2>${escapeHtml(page.summaryTitle || "")}</h2>
          <p>${escapeHtml(page.summaryText || "")}</p>
          <div class="badge-list">
            ${(page.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </article>
        <article class="card">
          <img class="media" src="${safeUrl(page.summaryImage)}" alt="${escapeAttr(page.summaryTitle || "Digital InPulse")}" />
          <div class="card-content">
            <h3>${escapeHtml(page.summaryCardTitle || "")}</h3>
            <p>${escapeHtml(page.summaryCardText || "")}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.timelineTitle || "")}</h2>
        <div class="timeline">${timeline}</div>
      </div>
    </section>
  `;
}

function renderPrinciple(page) {
  const hero = renderHero(page.hero);

  const benefits = (page.benefits || [])
    .map(
      (item) => `
        <article class="card">
          ${item.image ? `<img class="media" src="${safeUrl(item.image)}" alt="${escapeAttr(item.title)}" />` : ""}
          <div class="card-content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.introTitle || "")}</h2>
        <p>${escapeHtml(page.introText || "")}</p>
        <div class="grid cards-2">${benefits}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <article class="card">
          <div class="card-content">
            <h3>${escapeHtml(page.alumniTitle || "")}</h3>
            <p>${escapeHtml(page.alumniText || "")}</p>
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderProgram(page, currentKey) {
  const hero = renderHero(page.hero, { secondaryAction: page.hero?.secondaryAction });
  const checklist = (page.checklist || []).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("");
  const schedule = (page.schedule || [])
    .map(
      (item) => `
        <article class="timeline-item">
          <span class="timeline-label">${escapeHtml(item.date)}</span>
          <h3>${escapeHtml(item.city)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container split">
        <article>
          <h2>${escapeHtml(page.themeTitle || "")}</h2>
          <p>${escapeHtml(page.themeText || "")}</p>
          <div class="badge-list">${checklist}</div>
        </article>
        <article class="card">
          <img class="media" src="${safeUrl(page.themeImage)}" alt="${escapeAttr(page.themeTitle || "")}" />
          <div class="card-content">
            <h3>${escapeHtml(page.scheduleTitle || "")}</h3>
            <p>${escapeHtml(page.scheduleText || "")}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>${escapeHtml(page.scheduleTitle || "")}</h2>
        <div class="timeline">${schedule}</div>
      </div>
    </section>
    <section id="form" class="section application">
      <div class="container">
        <h2>${escapeHtml(page.form?.title || "Candidature")}</h2>
        <p>${escapeHtml(page.form?.description || "")}</p>
        <div class="application-card">
          ${buildApplicationForm(page.form || {}, currentKey)}
        </div>
      </div>
    </section>
  `;
}

function renderLegal(page) {
  const hero = renderHero(page.hero);
  const paragraphs = (page.paragraphs || []).map((text) => `<p>${escapeHtml(text)}</p>`).join("");
  return `
    ${hero}
    <section class="section">
      <div class="container">
        <article class="legal-panel">
          ${paragraphs}
        </article>
      </div>
    </section>
  `;
}

function buildApplicationForm(form, currentKey) {
  const hasVideoField = Boolean(form.videoField);
  return `
    <form class="form-grid" method="post" action="#" onsubmit="event.preventDefault()">
      <div class="field">
        <label for="first-name">Prenom *</label>
        <input id="first-name" name="first_name" required />
      </div>
      <div class="field">
        <label for="last-name">Nom *</label>
        <input id="last-name" name="last_name" required />
      </div>
      <div class="field">
        <label for="email">Email *</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div class="field">
        <label for="phone">Telephone *</label>
        <input id="phone" name="phone" type="tel" required />
      </div>
      <div class="field full">
        <label for="company">Nom de l'entreprise *</label>
        <input id="company" name="company" required />
      </div>
      <div class="field">
        <label for="website">Site web</label>
        <input id="website" name="website" type="url" />
      </div>
      <div class="field">
        <label for="region">Region *</label>
        <select id="region" name="region" required>
          <option value="">Selectionner</option>
          <option>Ile-de-France</option>
          <option>Nord-Est</option>
          <option>Sud-Est</option>
          <option>Nord-Ouest</option>
          <option>Sud-Ouest</option>
        </select>
      </div>
      ${
        hasVideoField
          ? `
        <div class="field full">
          <label for="video">${escapeHtml(form.videoField || "Lien video de presentation")}</label>
          <input id="video" name="video_url" type="url" />
        </div>
      `
          : ""
      }
      <div class="field full">
        <label for="summary">Resume du projet *</label>
        <textarea id="summary" name="summary" required></textarea>
      </div>
      <div class="field">
        <label for="kbis">KBis (max 10 MB)</label>
        <input id="kbis" name="kbis" type="file" />
      </div>
      <div class="field">
        <label for="deck">Presentation (max 10 MB)</label>
        <input id="deck" name="deck" type="file" />
      </div>
      <input type="hidden" name="program" value="${escapeAttr(currentKey)}" />
      <div class="field full">
        <label>
          <input type="checkbox" name="terms" required />
          J'accepte les conditions de participation et les mentions RGPD.
        </label>
      </div>
      <div class="field full submit-row">
        <button class="btn btn-primary" type="submit">${escapeHtml(form.submitLabel || "Envoyer")}</button>
        ${
          form.regulationUrl
            ? `<a class="btn btn-ghost" href="${safeUrl(form.regulationUrl)}" target="_blank" rel="noopener">${escapeHtml(form.regulationLabel || "Voir le reglement")}</a>`
            : ""
        }
      </div>
    </form>
    <p class="help">${escapeHtml(form.notice || "Le back-end de candidature sera connecte dans une etape suivante.")}</p>
  `;
}

function renderHero(hero = {}, options = {}) {
  const style = hero.image ? ` style="--hero-image: url('${escapeAttr(hero.image)}')"` : "";
  const primaryAction = hero.ctaLabel && hero.ctaUrl ? `<a class="btn btn-primary" href="${safeUrl(hero.ctaUrl)}">${escapeHtml(hero.ctaLabel)}</a>` : "";
  const secondary = options.secondaryAction;
  const secondaryAction =
    secondary?.label && secondary?.url ? `<a class="btn btn-ghost" href="${safeUrl(secondary.url)}">${escapeHtml(secondary.label)}</a>` : "";

  return `
    <section class="hero"${style}>
      <div class="container">
        ${hero.eyebrow ? `<p class="eyebrow">${escapeHtml(hero.eyebrow)}</p>` : ""}
        <h1>${escapeHtml(hero.title || "")}</h1>
        <p>${escapeHtml(hero.subtitle || "")}</p>
        ${primaryAction || secondaryAction ? `<div class="hero-actions">${primaryAction}${secondaryAction}</div>` : ""}
      </div>
    </section>
  `;
}

function wireMobileMenu() {
  const button = document.querySelector("[data-menu-toggle]");
  const header = document.querySelector("[data-site-header]");
  if (!button || !header) {
    return;
  }
  button.addEventListener("click", () => {
    header.classList.toggle("open");
  });
}

function normalizePath(path) {
  if (!path) {
    return "/";
  }
  const withoutSlash = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return withoutSlash || "/";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function safeUrl(value) {
  if (!value) {
    return "#";
  }
  return escapeAttr(value);
}
