const ROUTE_TO_KEY = {
  "/": "home",
  "/digital-in-pulse": "digital_in_pulse",
  "/le-principe": "le_principe",
  "/tech-for-competitivity": "tech_for_competitivity",
  "/women-for-innovation": "women_for_innovation",
  "/mentions-legales": "mentions_legales",
  "/politique-relative-a-lutilisation-des-cookies": "politique_cookies",
  "/conditions-generales-dutilisation": "conditions_utilisation",
  "/politique-de-confidentialite": "politique_confidentialite",
};

const PROGRAM_KEYS = new Set(["tech_for_competitivity", "women_for_innovation"]);
const LEGAL_KEYS = new Set([
  "mentions_legales",
  "politique_cookies",
  "conditions_utilisation",
  "politique_confidentialite",
]);

redirectIdentityTokensToAdmin();

const mainNode = document.querySelector("main[data-page]");
const routePage = ROUTE_TO_KEY[normalizePath(window.location.pathname)];
const pageKey = mainNode?.dataset.page || routePage || "home";

bootstrap().catch((error) => {
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

async function bootstrap() {
  const content = await fetchContent();
  applyTheme(content.meta || {});
  renderNavigation(content, pageKey);
  renderFooter(content);
  renderPage(content, pageKey);
  wireMobileMenu();
  wireReveals();
  wireTestimonialSlider();
  wireDemoForms();
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
      const targetKey = ROUTE_TO_KEY[normalizePath(item.url || "")];
      const active = targetKey === currentKey;
      return `<a class="nav-link${active ? " active" : ""}" href="${safeUrl(item.url)}">${escapeHtml(item.label)}</a>`;
    })
    .join("");

  host.innerHTML = `
    <div class="topline">
      <div class="container">
        <span>${escapeHtml(meta.tagline || "")}</span>
        <a class="topline-mail" href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a>
      </div>
    </div>
    <div class="site-header" data-site-header>
      <div class="container">
        <a class="logo" href="/">
          <span class="logo-mark"></span>
          <span>${escapeHtml(meta.siteName || "Digital InPulse")}</span>
        </a>
        <button class="menu-toggle" type="button" data-menu-toggle>Menu</button>
        <nav class="nav-links" aria-label="Navigation principale">
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
  const socials = (footer.socials || [])
    .map((item) => `<a class="footer-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`)
    .join("");
  const partners = (footer.partners || [])
    .map((item) => `<a class="partner-chip" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`)
    .join("");

  host.classList.add("site-footer");
  host.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <section class="footer-block reveal">
          <h4>Documents</h4>
          <div class="footer-list">${legalLinks}</div>
        </section>
        <section class="footer-block reveal">
          <h4>Partenaires</h4>
          <div class="partner-wrap">${partners}</div>
        </section>
        <section class="footer-block reveal">
          <h4>Contact</h4>
          <div class="footer-list">
            <a class="footer-link" href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a>
            ${socials}
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

  const page = content.pages?.[currentKey];
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
      (item, index) => `
        <article class="card card-pillar reveal" style="--delay:${index * 90}ms">
          <div class="card-content">
            <p class="pill-index">0${index + 1}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </div>
        </article>
      `,
    )
    .join("");
  const categories = (page.categories || [])
    .map(
      (item, index) => `
        <article class="card card-category reveal" style="--delay:${index * 120}ms">
          <img class="media" src="${safeUrl(item.image)}" alt="${escapeAttr(item.title)}" />
          <div class="card-content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
            <a class="btn btn-primary" href="${safeUrl(item.url)}">${escapeHtml(item.ctaLabel || "En savoir plus")}</a>
          </div>
        </article>
      `,
    )
    .join("");
  const testimonials = (page.testimonials || [])
    .map(
      (item, index) => `
        <article class="testimonial-slide${index === 0 ? " active" : ""}" data-slide-index="${index}">
          <blockquote>"${escapeHtml(item.quote)}"</blockquote>
          <p><strong>${escapeHtml(item.author)}</strong></p>
          <p>${escapeHtml(item.role)}</p>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container">
        <header class="section-head reveal">
          <h2>${escapeHtml(page.introTitle || "")}</h2>
          <p>${escapeHtml(page.introText || "")}</p>
        </header>
        <div class="grid pillars">${pillars}</div>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        <header class="section-head reveal">
          <h2>${escapeHtml(page.categoriesTitle || "")}</h2>
          <p>${escapeHtml(page.categoriesText || "")}</p>
        </header>
        <div class="grid cards-2">${categories}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <header class="section-head reveal">
          <h2>${escapeHtml(page.testimonialsTitle || "")}</h2>
        </header>
        <div class="testimonial-slider reveal" data-testimonial-slider>
          <button class="slider-btn prev" type="button" data-slide-prev aria-label="Temoignage precedent">‹</button>
          <div class="testimonial-track">${testimonials}</div>
          <button class="slider-btn next" type="button" data-slide-next aria-label="Temoignage suivant">›</button>
        </div>
      </div>
    </section>
  `;
}

function renderContest(page) {
  const hero = renderHero(page.hero);
  const tags = (page.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("");
  const timeline = (page.timeline || [])
    .map(
      (item, index) => `
        <article class="timeline-item reveal" style="--delay:${index * 120}ms">
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
        <article class="reveal">
          <h2>${escapeHtml(page.summaryTitle || "")}</h2>
          <p>${escapeHtml(page.summaryText || "")}</p>
          <div class="badge-list">${tags}</div>
        </article>
        <article class="card reveal">
          <img class="media" src="${safeUrl(page.summaryImage)}" alt="${escapeAttr(page.summaryTitle || "")}" />
          <div class="card-content">
            <h3>${escapeHtml(page.summaryCardTitle || "")}</h3>
            <p>${escapeHtml(page.summaryCardText || "")}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        <header class="section-head reveal">
          <h2>${escapeHtml(page.timelineTitle || "")}</h2>
        </header>
        <div class="timeline">${timeline}</div>
      </div>
    </section>
    <section class="section">
      <div class="container dual-cta reveal">
        <a class="btn btn-primary" href="/tech-for-competitivity/">Explorer Tech For Competitivity</a>
        <a class="btn btn-ghost dark" href="/women-for-innovation/">Explorer Women For Innovation</a>
      </div>
    </section>
  `;
}

function renderPrinciple(page) {
  const hero = renderHero(page.hero);
  const benefits = (page.benefits || [])
    .map(
      (item, index) => `
        <article class="card reveal" style="--delay:${index * 90}ms">
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
        <header class="section-head reveal">
          <h2>${escapeHtml(page.introTitle || "")}</h2>
          <p>${escapeHtml(page.introText || "")}</p>
        </header>
        <div class="grid cards-2">${benefits}</div>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        <article class="alumni-callout reveal">
          <h3>${escapeHtml(page.alumniTitle || "")}</h3>
          <p>${escapeHtml(page.alumniText || "")}</p>
        </article>
      </div>
    </section>
  `;
}

function renderProgram(page, programKey) {
  const hero = renderHero(page.hero, { secondaryAction: page.hero?.secondaryAction });
  const checklist = (page.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const schedule = (page.schedule || [])
    .map(
      (item, index) => `
        <article class="timeline-item reveal" style="--delay:${index * 90}ms">
          <span class="timeline-label">${escapeHtml(item.date)}</span>
          <h3>${escapeHtml(item.city)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `,
    )
    .join("");
  const areas = buildProgramAreas(programKey);

  return `
    ${hero}
    <section class="section">
      <div class="container split">
        <article class="reveal">
          <h2>${escapeHtml(page.themeTitle || "")}</h2>
          <p>${escapeHtml(page.themeText || "")}</p>
          <ul class="list-check">${checklist}</ul>
        </article>
        <article class="card reveal">
          <img class="media" src="${safeUrl(page.themeImage)}" alt="${escapeAttr(page.themeTitle || "")}" />
          <div class="card-content">
            <h3>${escapeHtml(page.scheduleTitle || "")}</h3>
            <p>${escapeHtml(page.scheduleText || "")}</p>
          </div>
        </article>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        <header class="section-head reveal">
          <h2>Champs d'application</h2>
        </header>
        <div class="grid cards-3">${areas}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <header class="section-head reveal">
          <h2>${escapeHtml(page.scheduleTitle || "")}</h2>
        </header>
        <div class="timeline">${schedule}</div>
      </div>
    </section>
    <section id="form" class="section application">
      <div class="container">
        <header class="section-head reveal light">
          <h2>${escapeHtml(page.form?.title || "Candidature")}</h2>
          <p>${escapeHtml(page.form?.description || "")}</p>
        </header>
        <div class="application-card reveal">
          ${buildProgramForm(page.form || {}, programKey)}
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
        <article class="legal-panel reveal">${paragraphs}</article>
      </div>
    </section>
  `;
}

function buildProgramAreas(programKey) {
  const techAreas = [
    "Productivite et efficacite operationnelle",
    "Informatique decisionnelle et pilotage de la performance",
    "Transformation industrielle et chaine de valeur",
    "Competitivite economique et optimisation des couts",
    "Automatisation, data, IA et cloud",
    "Impact mesurable sur la croissance",
  ];
  const womenAreas = [
    "Leadership feminin dans la tech",
    "Innovation produit ou service",
    "Traction business et projection internationale",
    "Resilience et execution",
    "Impact social, industriel ou economique",
    "Vision long terme et passage a l'echelle",
  ];
  const list = programKey === "women_for_innovation" ? womenAreas : techAreas;
  return list
    .map(
      (item, index) => `
        <article class="card card-mini reveal" style="--delay:${index * 70}ms">
          <div class="card-content">
            <h3>${escapeHtml(item)}</h3>
          </div>
        </article>
      `,
    )
    .join("");
}

function buildProgramForm(form, programKey) {
  const isWomen = programKey === "women_for_innovation";
  const idPrefix = isWomen ? "wfi" : "tfc";
  return `
    <form class="program-form" data-demo-form method="post" action="#">
      <fieldset>
        <legend>Vous</legend>
        <div class="form-grid">
          <div class="field">
            <label for="${idPrefix}-last-name">Nom *</label>
            <input id="${idPrefix}-last-name" name="last_name" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-first-name">Prenom *</label>
            <input id="${idPrefix}-first-name" name="first_name" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-email">Adresse email *</label>
            <input id="${idPrefix}-email" name="email" type="email" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-phone">Telephone portable *</label>
            <input id="${idPrefix}-phone" name="phone" type="tel" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-region">Region de candidature *</label>
            <select id="${idPrefix}-region" name="region" required>
              <option value="">Selectionner</option>
              <option>Ile-de-France</option>
              <option>Nord-Est</option>
              <option>Sud-Est</option>
              <option>Nord-Ouest</option>
              <option>Sud-Ouest</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Entreprise</legend>
        <div class="form-grid">
          <div class="field full">
            <label for="${idPrefix}-company">Nom de l'entreprise *</label>
            <input id="${idPrefix}-company" name="company" required />
          </div>
          <div class="field full">
            <label for="${idPrefix}-address">Adresse *</label>
            <input id="${idPrefix}-address" name="address" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-postal">Code postal *</label>
            <input id="${idPrefix}-postal" name="postal_code" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-city">Ville *</label>
            <input id="${idPrefix}-city" name="city" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-website">Site web *</label>
            <input id="${idPrefix}-website" name="website" type="url" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-founded">Date de creation *</label>
            <input id="${idPrefix}-founded" name="founded_at" type="date" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-sector">Secteur d'activite *</label>
            <input id="${idPrefix}-sector" name="sector" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-stage">Stade d'evolution *</label>
            <select id="${idPrefix}-stage" name="stage" required>
              <option value="">Selectionner</option>
              <option>Amorcage</option>
              <option>Croissance</option>
              <option>Scale-up</option>
            </select>
          </div>
          <div class="field">
            <label for="${idPrefix}-rev-2024">Chiffre d'affaires 2024</label>
            <input id="${idPrefix}-rev-2024" name="revenue_2024" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-rev-2025">CA previsionnel 2025</label>
            <input id="${idPrefix}-rev-2025" name="revenue_2025" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-employees">Nombre de salaries</label>
            <input id="${idPrefix}-employees" name="employees" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-pitch-en">Pouvez-vous pitcher en anglais ? *</label>
            <select id="${idPrefix}-pitch-en" name="pitch_english" required>
              <option value="">Selectionner</option>
              <option>Oui</option>
              <option>Non</option>
            </select>
          </div>
          ${
            isWomen
              ? `
            <div class="field full">
              <label for="${idPrefix}-video">${escapeHtml(form.videoField || "Lien vers votre video de presentation")}</label>
              <input id="${idPrefix}-video" name="video_url" type="url" />
            </div>
          `
              : ""
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>Projet</legend>
        <div class="form-grid">
          <div class="field full">
            <label for="${idPrefix}-summary">Presentation de votre entreprise et de votre projet *</label>
            <textarea id="${idPrefix}-summary" name="summary" required></textarea>
          </div>
          <div class="field full">
            <label for="${idPrefix}-impact">En quoi votre entreprise repond aux enjeux du concours ? *</label>
            <textarea id="${idPrefix}-impact" name="impact_statement" required></textarea>
          </div>
          <div class="field">
            <label for="${idPrefix}-tech-stack">Technologies utilisees</label>
            <select id="${idPrefix}-tech-stack" name="tech_stack" multiple>
              <option>Intelligence Artificielle</option>
              <option>Cloud</option>
              <option>Blockchain</option>
              <option>AR/VR</option>
              <option>IoT</option>
            </select>
          </div>
          <div class="field">
            <label for="${idPrefix}-source">Comment avez-vous connu le concours ? *</label>
            <select id="${idPrefix}-source" name="source" multiple required>
              <option>Maddyness</option>
              <option>Comite Richelieu</option>
              <option>Huawei</option>
              <option>Partenaire regional</option>
              <option>Autre</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Documents</legend>
        <div class="form-grid">
          <div class="field">
            <label for="${idPrefix}-kbis">KBis (max 10 MB) *</label>
            <input id="${idPrefix}-kbis" name="kbis" type="file" data-max-size="10485760" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-deck">Presentation entreprise/projet (max 10 MB) *</label>
            <input id="${idPrefix}-deck" name="deck" type="file" data-max-size="10485760" required />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Conformite</legend>
        <div class="form-grid">
          <div class="field full">
            <label for="${idPrefix}-conflict">Conflit d'interets avec Huawei France ?</label>
            <select id="${idPrefix}-conflict" name="conflict">
              <option value="">Selectionner</option>
              <option>Non</option>
              <option>Oui</option>
            </select>
          </div>
          <div class="field full">
            <label for="${idPrefix}-conflict-details">Details (si applicable)</label>
            <textarea id="${idPrefix}-conflict-details" name="conflict_details"></textarea>
          </div>
          <div class="field full">
            <label class="inline-check">
              <input type="checkbox" name="terms" required />
              Je confirme avoir pris connaissance et accepte les conditions de participation, les mentions RGPD et le reglement du concours.
            </label>
          </div>
        </div>
      </fieldset>

      <input type="hidden" name="program" value="${escapeAttr(programKey)}" />
      <div class="submit-row">
        <button class="btn btn-primary" type="submit">${escapeHtml(form.submitLabel || "Envoyer la candidature")}</button>
        ${
          form.regulationUrl
            ? `<a class="btn btn-ghost dark" href="${safeUrl(form.regulationUrl)}" target="_blank" rel="noopener">${escapeHtml(form.regulationLabel || "Voir le reglement")}</a>`
            : ""
        }
      </div>
      <p class="help">${escapeHtml(form.notice || "Le back-end d'envoi des candidatures sera connecte dans une etape suivante.")}</p>
      <p class="form-feedback" data-form-feedback role="status" aria-live="polite"></p>
    </form>
  `;
}

function renderHero(hero = {}, options = {}) {
  const style = hero.image ? ` style="--hero-image: url('${escapeAttr(hero.image)}')"` : "";
  const primaryAction =
    hero.ctaLabel && hero.ctaUrl ? `<a class="btn btn-primary" href="${safeUrl(hero.ctaUrl)}">${escapeHtml(hero.ctaLabel)}</a>` : "";
  const secondary = options.secondaryAction;
  const secondaryAction =
    secondary?.label && secondary?.url ? `<a class="btn btn-ghost" href="${safeUrl(secondary.url)}">${escapeHtml(secondary.label)}</a>` : "";

  return `
    <section class="hero"${style}>
      <div class="container hero-grid">
        <div class="hero-copy reveal">
          ${hero.eyebrow ? `<p class="eyebrow">${escapeHtml(hero.eyebrow)}</p>` : ""}
          <h1>${escapeHtml(hero.title || "")}</h1>
          <p>${escapeHtml(hero.subtitle || "")}</p>
          ${primaryAction || secondaryAction ? `<div class="hero-actions">${primaryAction}${secondaryAction}</div>` : ""}
        </div>
        <aside class="hero-panel reveal">
          <p class="hero-panel-title">Digital InPulse</p>
          <p class="hero-panel-text">Programme de soutien aux start-ups francaises depuis 2014.</p>
          <p class="hero-panel-text">Edition annuelle, candidature nationale, accompagnement international.</p>
        </aside>
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

function wireReveals() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length || !("IntersectionObserver" in window)) {
    for (const node of nodes) {
      node.classList.add("show");
    }
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  for (const node of nodes) {
    observer.observe(node);
  }
}

function wireTestimonialSlider() {
  const slider = document.querySelector("[data-testimonial-slider]");
  if (!slider) {
    return;
  }
  const slides = [...slider.querySelectorAll(".testimonial-slide")];
  const prev = slider.querySelector("[data-slide-prev]");
  const next = slider.querySelector("[data-slide-next]");
  if (!slides.length || !prev || !next) {
    return;
  }

  let index = 0;
  const setActive = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });
  };

  prev.addEventListener("click", () => setActive(index - 1));
  next.addEventListener("click", () => setActive(index + 1));

  let timer = window.setInterval(() => setActive(index + 1), 5500);
  slider.addEventListener("mouseenter", () => window.clearInterval(timer));
  slider.addEventListener("mouseleave", () => {
    timer = window.setInterval(() => setActive(index + 1), 5500);
  });
}

function wireDemoForms() {
  const forms = [...document.querySelectorAll("[data-demo-form]")];
  for (const form of forms) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const feedback = form.querySelector("[data-form-feedback]");
      const invalidFile = findInvalidFile(form);
      if (invalidFile && feedback) {
        feedback.textContent = "Un fichier depasse la taille maximale autorisee de 10 MB.";
        feedback.classList.add("error");
        return;
      }
      if (feedback) {
        feedback.textContent = "Version de demonstration: candidature non envoyee. Connecter un back-end pour la soumission finale.";
        feedback.classList.remove("error");
      }
    });
  }
}

function findInvalidFile(form) {
  const fileInputs = [...form.querySelectorAll("input[type='file'][data-max-size]")];
  for (const input of fileInputs) {
    const maxSize = Number(input.dataset.maxSize || "0");
    if (!maxSize || !input.files || !input.files.length) {
      continue;
    }
    if (input.files[0].size > maxSize) {
      return input;
    }
  }
  return null;
}

function redirectIdentityTokensToAdmin() {
  const pattern = /(invite_token|recovery_token|confirmation_token|email_change_token)=/;
  const hasToken = pattern.test(window.location.hash) || pattern.test(window.location.search);
  if (window.location.pathname.startsWith("/admin") || !hasToken) {
    return;
  }
  const suffix = `${window.location.search}${window.location.hash}`;
  window.location.replace(`/admin/${suffix}`);
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
