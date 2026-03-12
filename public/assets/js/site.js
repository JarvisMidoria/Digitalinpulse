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

const BRAND_ASSETS = {
  logoLight: "/assets/media/brand/logo-light.png",
  logoDark: "/assets/media/brand/logo-dark.png",
  footerTexture: "/assets/media/brand/footer-texture.png",
  footerPartnerLogos: {
    "Comite Richelieu": "/assets/media/brand/partner-comite-richelieu.png",
    CCIFC: "/assets/media/brand/partner-ccifc.png",
    FCCIHK: "/assets/media/brand/partner-fccihk.png",
  },
  homeProgramLogos: {
    tech: "/assets/media/brand/home-tech-logo.png",
    women: "/assets/media/brand/home-women-logo.webp",
  },
};

const FORM_SUBMIT_ENDPOINT = "/.netlify/functions/submit-application";
const FORM_MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

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
          <div class="legal-panel">
            <h2>Erreur de chargement</h2>
            <p>Le contenu n'a pas pu etre charge depuis <code>/content/site.json</code>.</p>
          </div>
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
  document.body.classList.add("js-dynamic");
  wireHeader();
  wireReveals();
  wireTestimonialSlider();
  wireMultiSelectFields();
  wireApplicationForms();
  wireDynamicEnhancements();
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
    root.setProperty("--primary", meta.primaryColor);
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
  const entries = content.navigation || [];
  const desktopEntries = entries.filter((item) => normalizePath(item.url || "") !== "/");
  const desktopLinks = desktopEntries
    .map((item) => {
      const targetKey = ROUTE_TO_KEY[normalizePath(item.url || "")];
      const active = targetKey === currentKey;
      return `<a class="nav-link${active ? " active" : ""}" href="${safeUrl(item.url)}" data-nav-link>${escapeHtml(item.label)}</a>`;
    })
    .join("");
  const mobileLinks = entries
    .map((item) => {
      const targetKey = ROUTE_TO_KEY[normalizePath(item.url || "")];
      const active = targetKey === currentKey;
      return `<a class="mobile-nav-link${active ? " active" : ""}" href="${safeUrl(item.url)}" data-nav-link>${escapeHtml(item.label)}</a>`;
    })
    .join("");

  host.innerHTML = `
    <div class="header-shell" data-site-header>
      <div class="scroll-progress" data-scroll-progress aria-hidden="true"></div>
      <div class="container header-main">
        <a class="brand" href="/" aria-label="${escapeAttr(meta.siteName || "Digital InPulse")}">
          <img class="brand-logo brand-logo-light" src="${safeUrl(BRAND_ASSETS.logoLight)}" alt="${escapeAttr(meta.siteName || "Digital InPulse")}" />
          <img class="brand-logo brand-logo-dark" src="${safeUrl(BRAND_ASSETS.logoDark)}" alt="${escapeAttr(meta.siteName || "Digital InPulse")}" />
        </a>
        <nav class="desktop-nav" aria-label="Navigation principale">
          ${desktopLinks}
        </nav>
        <button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-nav">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="mobile-nav" id="mobile-nav" data-mobile-nav>
        <div class="mobile-nav-inner">
          <nav class="mobile-nav-links" aria-label="Navigation mobile">
            ${mobileLinks}
          </nav>
          <div class="mobile-nav-footer">
            <p>${escapeHtml(meta.tagline || "")}</p>
            <a href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a>
          </div>
        </div>
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
    .map((item) => `<li><a href="${safeUrl(item.url)}">${escapeHtml(item.label)}</a></li>`)
    .join("");

  const socials = (footer.socials || [])
    .map((item) => {
      const icon = socialIconLabel(item.label || "");
      return `<a class="social-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(item.label || "")}"><span>${icon}</span>${escapeHtml(item.label || "")}</a>`;
    })
    .join("");

  const partners = (footer.partners || [])
    .map((item) => {
      const logo = BRAND_ASSETS.footerPartnerLogos[item.name] || "";
      if (logo) {
        return `<a class="partner-logo" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl(logo)}" alt="${escapeAttr(item.name)}" /></a>`;
      }
      return `<a class="partner-chip" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`;
    })
    .join("");

  host.classList.add("site-footer");
  host.style.setProperty("--footer-texture", `url('${BRAND_ASSETS.footerTexture}')`);
  host.innerHTML = `
    <div class="container footer-partners">${partners}</div>
    <div class="container footer-grid">
      <section class="footer-column">
        <h4>Liens</h4>
        <ul>${legalLinks}</ul>
      </section>
      <section class="footer-column">
        <h4>Suivez-nous</h4>
        <div class="footer-socials">${socials}</div>
      </section>
      <section class="footer-column">
        <h4>Contactez-nous</h4>
        <p><a href="mailto:${escapeAttr(meta.contactEmail || "")}">${escapeHtml(meta.contactEmail || "")}</a></p>
      </section>
    </div>
    <div class="container footer-bottom">${escapeHtml(meta.copyright || "")}</div>
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
          <div class="legal-panel">
            <h2>Page introuvable</h2>
            <p>Cette page n'existe pas dans le contenu central.</p>
          </div>
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
  const hero = renderHero(page.hero, {
    variant: "home",
    sideContent: renderHomePrograms(),
    secondaryAction: page.hero?.secondaryAction,
  });
  const homeVideo = renderHomeVideo(page.video || {});
  const pillars = (page.pillars || [])
    .map(
      (item, index) => `
        <article class="feature-card reveal" style="--delay:${index * 80}ms">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `,
    )
    .join("");
  const categories = (page.categories || [])
    .map(
      (item, index) => `
        <article class="program-card reveal" style="--delay:${index * 100}ms">
          <img class="program-card-media" src="${safeUrl(item.image)}" alt="${escapeAttr(item.title)}" />
          <div class="program-card-content">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.text)}</p>
            <a class="btn btn-outline" href="${safeUrl(item.url)}">${escapeHtml(item.ctaLabel || "En savoir plus")}</a>
          </div>
        </article>
      `,
    )
    .join("");
  const testimonials = (page.testimonials || [])
    .map((item, index) => {
      const companyName = item.company || extractCompanyName(item.role || "");
      const companyInitials = textInitials(companyName || item.author || "DIP");
      const authorInitials = textInitials(item.author || "DIP");
      const logoNode = item.logo
        ? `<img src="${safeUrl(item.logo)}" alt="${escapeAttr(companyName || "Entreprise")}" />`
        : `<span class="testimonial-company-mark">${escapeHtml(companyInitials)}</span>`;
      return `
        <article class="testimonial-slide${index === 0 ? " active" : ""}" data-slide-index="${index}">
          <header class="testimonial-head">
            <span class="testimonial-avatar" aria-hidden="true">${escapeHtml(authorInitials)}</span>
            <div class="testimonial-meta">
              <p class="testimonial-author">${escapeHtml(item.author)}</p>
              <p class="testimonial-role">${escapeHtml(item.role || "")}</p>
            </div>
            ${
              companyName
                ? `
              <div class="testimonial-company">
                ${logoNode}
                <span class="testimonial-company-name">${escapeHtml(companyName)}</span>
              </div>
            `
                : ""
            }
          </header>
          <blockquote>"${escapeHtml(item.quote)}"</blockquote>
        </article>
      `;
    })
    .join("");

  return `
    ${hero}
    ${homeVideo}
    <section class="section section-soft">
      <div class="container">
        ${renderSectionHead(page.introTitle || "", page.introText || "", { centered: true })}
        <div class="feature-grid">${pillars}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        ${renderSectionHead(page.categoriesTitle || "", page.categoriesText || "", { centered: true })}
        <div class="program-grid">${categories}</div>
      </div>
    </section>
    <section class="section section-testimonials">
      <div class="container">
        ${renderSectionHead(page.testimonialsTitle || "", "", { centered: true })}
        <div class="testimonial-slider reveal" data-testimonial-slider>
          <div class="testimonial-track">${testimonials}</div>
          <div class="testimonial-controls">
            <button class="slider-btn prev" type="button" data-slide-prev aria-label="Temoignage precedent">‹</button>
            <button class="slider-btn next" type="button" data-slide-next aria-label="Temoignage suivant">›</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderContest(page) {
  const hero = renderHero(page.hero);
  const tags = (page.tags || []).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("");
  const timeline = (page.timeline || [])
    .map(
      (item, index) => `
        <article class="timeline-item reveal" style="--delay:${index * 90}ms">
          <p class="timeline-date">${escapeHtml(item.date)}</p>
          <h3>${escapeHtml(item.step)}</h3>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `,
    )
    .join("");

  return `
    ${hero}
    <section class="section">
      <div class="container split-layout">
        <article class="content-block reveal">
          ${renderSectionHead(page.summaryTitle || "", page.summaryText || "", { compact: true })}
          <div class="tag-list">${tags}</div>
        </article>
        <article class="highlight-card reveal">
          <img src="${safeUrl(page.summaryImage)}" alt="${escapeAttr(page.summaryTitle || "")}" />
          <h3>${escapeHtml(page.summaryCardTitle || "")}</h3>
          <p>${escapeHtml(page.summaryCardText || "")}</p>
        </article>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        ${renderSectionHead(page.timelineTitle || "", "", { centered: true })}
        <div class="timeline">${timeline}</div>
      </div>
    </section>
  `;
}

function renderPrinciple(page) {
  const hero = renderHero(page.hero);
  const benefits = (page.benefits || [])
    .map(
      (item, index) => `
        <article class="benefit-card reveal" style="--delay:${index * 80}ms">
          ${item.image ? `<img src="${safeUrl(item.image)}" alt="${escapeAttr(item.title)}" />` : ""}
          <div class="benefit-card-content">
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
        ${renderSectionHead(page.introTitle || "", page.introText || "", { centered: true })}
        <div class="benefit-grid">${benefits}</div>
      </div>
    </section>
    <section class="section section-soft">
      <div class="container">
        <article class="alumni-panel reveal">
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
          <p class="timeline-date">${escapeHtml(item.date)}</p>
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
      <div class="container split-layout">
        <article class="content-block reveal">
          ${renderSectionHead(page.themeTitle || "", page.themeText || "", { compact: true })}
          <ul class="check-list">${checklist}</ul>
        </article>
        <article class="highlight-card reveal">
          <img src="${safeUrl(page.themeImage)}" alt="${escapeAttr(page.themeTitle || "")}" />
          <h3>${escapeHtml(page.scheduleTitle || "")}</h3>
          <p>${escapeHtml(page.scheduleText || "")}</p>
        </article>
      </div>
    </section>
    <section class="section section-dark">
      <div class="container">
        ${renderSectionHead("Champs d'application", "", { centered: true, light: true })}
        <div class="scope-grid">${areas}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        ${renderSectionHead(page.scheduleTitle || "", "", { centered: true })}
        <div class="timeline">${schedule}</div>
      </div>
    </section>
    <section id="form" class="section">
      <div class="container">
        <div class="application-panel">
          ${renderSectionHead(page.form?.title || "Candidature", page.form?.description || "", { compact: true })}
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

function renderHero(hero = {}, options = {}) {
  const style = hero.image ? ` style="--hero-image: url('${escapeAttr(hero.image)}')"` : "";
  const primaryAction =
    hero.ctaLabel && hero.ctaUrl ? `<a class="btn btn-light" href="${safeUrl(hero.ctaUrl)}">${escapeHtml(hero.ctaLabel)}</a>` : "";
  const secondary = options.secondaryAction;
  const secondaryAction =
    secondary?.label && secondary?.url ? `<a class="btn btn-outline-light" href="${safeUrl(secondary.url)}">${escapeHtml(secondary.label)}</a>` : "";
  const actions = primaryAction || secondaryAction ? `<div class="hero-actions">${primaryAction}${secondaryAction}</div>` : "";
  const side = options.sideContent ? `<aside class="hero-side reveal">${options.sideContent}</aside>` : "";
  const isHome = options.variant === "home";

  return `
    <section class="hero${isHome ? " hero-home" : ""}"${style}>
      <div class="container hero-grid${side ? " with-side" : ""}">
        <div class="hero-copy reveal">
          ${hero.eyebrow ? `<p class="hero-eyebrow">${escapeHtml(hero.eyebrow)}</p>` : ""}
          <h1>${escapeHtml(hero.title || "")}</h1>
          <p>${escapeHtml(hero.subtitle || "")}</p>
          ${actions}
        </div>
        ${side}
      </div>
    </section>
  `;
}

function renderHomePrograms() {
  return `
    <a class="home-program-card" href="/tech-for-competitivity/">
      <img src="${safeUrl(BRAND_ASSETS.homeProgramLogos.tech)}" alt="Tech For Competitivity" />
      <p>Innovation pour la competitivite technologique, industrielle et economique.</p>
    </a>
    <a class="home-program-card" href="/women-for-innovation/">
      <img src="${safeUrl(BRAND_ASSETS.homeProgramLogos.women)}" alt="Women For Innovation" />
      <p>Une categorie dediee aux femmes qui entreprennent dans la tech.</p>
    </a>
  `;
}

function renderHomeVideo(video) {
  if (!video?.url) {
    return "";
  }

  const media = renderVideoMedia(video);
  if (!media) {
    return "";
  }
  const hideOnMobile = shouldHideVideoOnMobile(video);

  return `
    <section class="section section-video${hideOnMobile ? " hide-on-mobile" : ""}">
      <div class="container home-video-layout">
        <article class="home-video-copy reveal">
          <p class="hero-eyebrow">Video</p>
          <h2>${escapeHtml(video.title || "Digital InPulse en video")}</h2>
          ${video.text ? `<p>${escapeHtml(video.text)}</p>` : ""}
        </article>
        <article class="home-video-frame reveal">
          ${media}
        </article>
      </div>
    </section>
  `;
}

function renderVideoMedia(video) {
  const url = String(video.url || "").trim();
  const title = escapeAttr(video.title || "Video Digital InPulse");

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    const src = `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`;
    return `<iframe src="${safeUrl(src)}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }

  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    const src = `https://player.vimeo.com/video/${vimeoId}`;
    return `<iframe src="${safeUrl(src)}" title="${title}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  }

  const poster = video.poster ? ` poster="${safeUrl(video.poster)}"` : "";
  return `<video controls preload="metadata"${poster}><source src="${safeUrl(url)}" />Votre navigateur ne supporte pas la lecture video.</video>`;
}

function extractYoutubeId(url) {
  const value = String(url || "").trim();
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
  );
  return match?.[1] || "";
}

function extractVimeoId(url) {
  const value = String(url || "").trim();
  const match = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] || "";
}

function shouldHideVideoOnMobile(video) {
  const visibility = String(video?.mobileVisibility || "")
    .trim()
    .toLowerCase();
  if (!visibility) {
    return Boolean(video?.hideOnMobile);
  }
  return ["off", "false", "0", "no", "hidden"].includes(visibility);
}

function renderSectionHead(title, text, options = {}) {
  const classes = ["section-head"];
  if (options.centered) {
    classes.push("centered");
  }
  if (options.light) {
    classes.push("light");
  }
  if (options.compact) {
    classes.push("compact");
  }

  return `
    <header class="${classes.join(" ")} reveal">
      <h2>${escapeHtml(title)}</h2>
      <span class="section-divider"></span>
      ${text ? `<p>${escapeHtml(text)}</p>` : ""}
    </header>
  `;
}

function buildProgramAreas(programKey) {
  const techAreas = [
    "Efficacite des entreprises / Productivite",
    "Informatique decisionnelle / Business intelligence",
    "Innovation industrielle",
    "Marketing et performance commerciale",
    "Data / IA / Cloud",
    "Transformation numerique mesurable",
  ];
  const womenAreas = [
    "Leadership feminin dans la tech",
    "Innovation produit ou service",
    "Traction business",
    "Resilience entrepreneuriale",
    "Impact social et economique",
    "Passage a l'echelle",
  ];
  const list = programKey === "women_for_innovation" ? womenAreas : techAreas;
  return list
    .map(
      (item, index) => `
        <article class="scope-card reveal" style="--delay:${index * 60}ms">
          <h3>${escapeHtml(item)}</h3>
        </article>
      `,
    )
    .join("");
}

function buildProgramForm(form, programKey) {
  const isWomen = programKey === "women_for_innovation";
  const idPrefix = isWomen ? "wfi" : "tfc";
  return `
    <form class="program-form" data-program-form method="post" action="#">
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
        <legend>Votre Entreprise</legend>
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
          ${buildTechStackField(idPrefix)}
          <div class="field">
            <label for="${idPrefix}-source">Comment avez-vous connu le concours ? *</label>
            <select id="${idPrefix}-source" name="source" required>
              <option value="">Selectionner</option>
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
            <input id="${idPrefix}-kbis" name="kbis" type="file" data-max-size="10485760" accept=".pdf,.png,.jpg,.jpeg,.webp" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-deck">Presentation entreprise/projet (max 10 MB) *</label>
            <input id="${idPrefix}-deck" name="deck" type="file" data-max-size="10485760" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp" required />
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

      <input class="hp-field" type="text" name="website_confirm" tabindex="-1" autocomplete="off" />
      <input type="hidden" name="program" value="${escapeAttr(programKey)}" />
      <div class="submit-row">
        <button class="btn btn-primary" type="submit">${escapeHtml(form.submitLabel || "Envoyer la candidature")}</button>
        ${
          form.regulationUrl
            ? `<a class="btn btn-outline" href="${safeUrl(form.regulationUrl)}" target="_blank" rel="noopener">${escapeHtml(form.regulationLabel || "Voir le reglement")}</a>`
            : ""
        }
      </div>
      <p class="help">${escapeHtml(form.notice || "Le back-end de soumission sera connecte dans une etape suivante.")}</p>
      <p class="form-feedback" data-form-feedback role="status" aria-live="polite"></p>
    </form>
  `;
}

function buildTechStackField(idPrefix) {
  const options = ["Intelligence artificielle", "Cloud", "Blockchain", "AR/VR", "IoT"];
  const optionNodes = options
    .map((label, index) => {
      const id = `${idPrefix}-tech-option-${index + 1}`;
      return `
        <label class="multi-option" for="${id}">
          <input id="${id}" data-multi-select-option type="checkbox" value="${escapeAttr(label)}" />
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    })
    .join("");

  return `
    <div class="field multi-select" data-multi-select data-field-name="tech_stack">
      <label for="${idPrefix}-tech-stack-trigger">Technologies utilisees</label>
      <button
        id="${idPrefix}-tech-stack-trigger"
        class="multi-select-trigger"
        data-multi-select-trigger
        type="button"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        Selectionner une ou plusieurs technologies
      </button>
      <div class="multi-select-menu" data-multi-select-menu role="listbox" aria-multiselectable="true">
        ${optionNodes}
      </div>
      <div class="multi-select-values" data-multi-select-values></div>
    </div>
  `;
}

function wireHeader() {
  const header = document.querySelector("[data-site-header]");
  const button = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const links = [...document.querySelectorAll("[data-nav-link]")];
  if (!header || !button || !mobileNav) {
    return;
  }

  const setSticky = () => {
    header.classList.toggle("is-sticky", window.scrollY > 45);
  };
  setSticky();
  window.addEventListener("scroll", setSticky, { passive: true });

  button.addEventListener("click", () => {
    const isOpen = header.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
  });

  for (const link of links) {
    link.addEventListener("click", () => {
      header.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    });
  }

  mobileNav.addEventListener("click", (event) => {
    if (event.target === mobileNav) {
      header.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    }
  });
}

function wireDynamicEnhancements() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  wireScrollProgress();
  wireInteractiveCards(prefersReducedMotion);
  if (!prefersReducedMotion) {
    wireHeroParallax();
  }
}

function wireMultiSelectFields() {
  const groups = [...document.querySelectorAll("[data-multi-select]")];
  if (!groups.length) {
    return;
  }

  const closeGroup = (group) => {
    const trigger = group.querySelector("[data-multi-select-trigger]");
    group.classList.remove("open");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  };

  const closeAll = (except = null) => {
    for (const group of groups) {
      if (group === except) {
        continue;
      }
      closeGroup(group);
    }
  };

  for (const group of groups) {
    const fieldName = String(group.dataset.fieldName || "").trim();
    const trigger = group.querySelector("[data-multi-select-trigger]");
    const valuesHost = group.querySelector("[data-multi-select-values]");
    const options = [...group.querySelectorAll("[data-multi-select-option]")];
    if (!fieldName || !trigger || !valuesHost || !options.length) {
      continue;
    }

    const sync = () => {
      const selected = options.filter((option) => option.checked).map((option) => option.value);
      valuesHost.replaceChildren();
      for (const value of selected) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = fieldName;
        input.value = value;
        valuesHost.appendChild(input);
      }

      const label =
        selected.length === 0
          ? "Selectionner une ou plusieurs technologies"
          : `${selected.length} technologie(s) selectionnee(s)`;
      trigger.textContent = label;
      trigger.classList.toggle("has-value", selected.length > 0);
    };

    group.syncMultiSelect = sync;
    sync();

    trigger.addEventListener("click", () => {
      const nextState = !group.classList.contains("open");
      closeAll(group);
      group.classList.toggle("open", nextState);
      trigger.setAttribute("aria-expanded", String(nextState));
    });

    for (const option of options) {
      option.addEventListener("change", sync);
    }

    group.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeGroup(group);
      }
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      closeAll();
      return;
    }
    const inside = groups.some((group) => group.contains(target));
    if (!inside) {
      closeAll();
    }
  });
}

function wireScrollProgress() {
  const progressBar = document.querySelector("[data-scroll-progress]");
  if (!progressBar) {
    return;
  }

  const updateProgress = () => {
    const scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, window.scrollY / scrollMax));
    progressBar.style.setProperty("--progress-scale", ratio.toFixed(4));
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
}

function wireHeroParallax() {
  const hero = document.querySelector(".hero");
  if (!hero) {
    return;
  }

  const updateShift = () => {
    const shift = Math.min(42, window.scrollY * 0.08);
    hero.style.setProperty("--hero-shift", `${shift.toFixed(2)}px`);
  };

  updateShift();
  window.addEventListener("scroll", updateShift, { passive: true });

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  hero.addEventListener("mousemove", (event) => {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty("--hero-spot-x", `${Math.min(100, Math.max(0, x)).toFixed(2)}%`);
    hero.style.setProperty("--hero-spot-y", `${Math.min(100, Math.max(0, y)).toFixed(2)}%`);
  });

  hero.addEventListener("mouseleave", () => {
    hero.style.setProperty("--hero-spot-x", "86%");
    hero.style.setProperty("--hero-spot-y", "16%");
  });
}

function wireInteractiveCards(prefersReducedMotion = false) {
  const cards = [
    ...document.querySelectorAll(
      ".feature-card, .program-card, .timeline-item, .scope-card, .home-program-card, .highlight-card, .benefit-card, .alumni-panel",
    ),
  ];
  if (!cards.length) {
    return;
  }

  for (const card of cards) {
    card.classList.add("interactive-card");
  }

  if (prefersReducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }

  for (const card of cards) {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--tilt-y", `${(x * 5).toFixed(2)}deg`);
      card.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
    });

    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--tilt-y", "0deg");
      card.style.setProperty("--tilt-x", "0deg");
    });
  }
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
    { threshold: 0.12 },
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

  let timer = window.setInterval(() => setActive(index + 1), 6000);
  slider.addEventListener("mouseenter", () => window.clearInterval(timer));
  slider.addEventListener("mouseleave", () => {
    timer = window.setInterval(() => setActive(index + 1), 6000);
  });
}

function wireApplicationForms() {
  const forms = [...document.querySelectorAll("[data-program-form]")];
  for (const form of forms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const feedback = form.querySelector("[data-form-feedback]");
      const submitButton = form.querySelector("button[type='submit']");

      const invalidFile = findInvalidFile(form);
      if (invalidFile) {
        setFormFeedback(feedback, "Un fichier depasse la taille maximale autorisee de 10 MB.", true);
        return;
      }

      if (!form.reportValidity()) {
        return;
      }

      setFormBusy(form, submitButton, true);
      setFormFeedback(feedback, "Envoi en cours, merci de patienter...");

      try {
        const payload = await buildSubmissionPayload(form);
        const response = await fetch(FORM_SUBMIT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseBody = await readJsonSafe(response);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Le service de soumission n'est pas disponible sur cet environnement.");
          }
          throw new Error(responseBody.error || `Soumission impossible (${response.status})`);
        }

        form.reset();
        resetFormEnhancements(form);
        setFormFeedback(
          feedback,
          `Candidature envoyee avec succes. Reference: ${String(responseBody.reference || "DIP-UNKNOWN")}.`,
        );
      } catch (error) {
        setFormFeedback(feedback, error.message || "Erreur de soumission.", true);
      } finally {
        setFormBusy(form, submitButton, false);
      }
    });
  }
}

function resetFormEnhancements(form) {
  const groups = [...form.querySelectorAll("[data-multi-select]")];
  for (const group of groups) {
    const options = [...group.querySelectorAll("[data-multi-select-option]")];
    for (const option of options) {
      option.checked = false;
    }
    if (typeof group.syncMultiSelect === "function") {
      group.syncMultiSelect();
    }
    group.classList.remove("open");
    const trigger = group.querySelector("[data-multi-select-trigger]");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  }
}

async function buildSubmissionPayload(form) {
  const formData = new FormData(form);
  const honeypot = String(formData.get("website_confirm") || "").trim();
  const files = [];
  const fields = {};

  for (const [name, value] of formData.entries()) {
    if (name === "website_confirm") {
      continue;
    }
    if (value instanceof File) {
      if (!value.name || value.size <= 0) {
        continue;
      }
      files.push({
        fieldName: name,
        filename: value.name,
        contentType: value.type || "application/octet-stream",
        size: value.size,
        base64: await fileToBase64(value),
      });
      continue;
    }
    appendSubmissionField(fields, name, String(value));
  }

  return {
    program: String(fields.program || ""),
    fields,
    files,
    honeypot,
    submittedAt: new Date().toISOString(),
    userAgent: navigator.userAgent || "",
  };
}

function appendSubmissionField(fields, name, value) {
  if (name in fields) {
    if (!Array.isArray(fields[name])) {
      fields[name] = [fields[name]];
    }
    fields[name].push(value);
    return;
  }
  fields[name] = value;
}

function setFormBusy(form, submitButton, busy) {
  form.classList.toggle("is-submitting", busy);
  form.setAttribute("aria-busy", String(busy));
  if (!submitButton) {
    return;
  }
  if (!submitButton.dataset.defaultLabel) {
    submitButton.dataset.defaultLabel = submitButton.textContent || "Envoyer";
  }
  submitButton.disabled = busy;
  submitButton.textContent = busy ? "Envoi..." : submitButton.dataset.defaultLabel;
}

function setFormFeedback(node, message, isError = false) {
  if (!node) {
    return;
  }
  node.textContent = message;
  node.classList.toggle("error", isError);
}

async function readJsonSafe(response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return { error: raw };
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const parts = result.split(",");
      if (parts.length < 2) {
        reject(new Error("Fichier non lisible"));
        return;
      }
      resolve(parts[1]);
    };
    reader.onerror = () => reject(new Error("Lecture fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function findInvalidFile(form) {
  const fileInputs = [...form.querySelectorAll("input[type='file'][data-max-size]")];
  for (const input of fileInputs) {
    const maxSize = Number(input.dataset.maxSize || String(FORM_MAX_UPLOAD_SIZE));
    if (!maxSize || !input.files || !input.files.length) {
      continue;
    }
    for (const file of input.files) {
      if (file.size > maxSize) {
        return input;
      }
    }
  }
  return null;
}

function extractCompanyName(roleText) {
  const value = String(roleText || "");
  if (!value.includes(",")) {
    return "";
  }
  return value.split(",").slice(1).join(",").trim();
}

function textInitials(text) {
  const tokens = String(text || "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!tokens.length) {
    return "DI";
  }
  return tokens.map((token) => token.charAt(0).toUpperCase()).join("");
}

function socialIconLabel(label) {
  const lower = String(label || "").toLowerCase();
  if (lower.includes("linkedin")) {
    return "in";
  }
  if (lower.includes("twitter") || lower.includes("x")) {
    return "x";
  }
  return "o";
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
