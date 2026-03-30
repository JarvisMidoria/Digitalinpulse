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
  logoStickyDip: "/assets/media/brand/sticky-dip-transparent.png",
  logoStickyMobility: "/assets/media/brand/sticky-center-mobility.png",
  heroFooterVideo: "/assets/media/video/headervideo.mp4",
  footerTexture: "/assets/media/brand/footer-texture.png",
  footerFeaturedPartner: "/assets/media/brand/footer-comite-richelieu-sahar-white.png",
  footerPartnerMaddyness: "/assets/media/brand/footer-maddyness-white.png",
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
  wireHomeIntro();
  wireHeader();
  wireReveals();
  wireTestimonialSlider();
  wireHomeCarousel();
  wireApplicationForms();
  wireProgramPanels();
  wireProgramFlipCards();
  wireHomePreviewDrift();
  wireScrollProgress();
  wireHeroCounters();
  wireAutoplayVideos();
  wireDocumentPreviews();
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
    <div class="header-shell" data-site-header id="site-top">
      <div class="container header-main" data-scroll-progress-target>
        <a class="brand" href="#site-top" aria-label="${escapeAttr(meta.siteName || "Digital InPulse")}">
          <img class="brand-logo brand-logo-light" src="${safeUrl(BRAND_ASSETS.logoLight)}" alt="${escapeAttr(meta.siteName || "Digital InPulse")}" />
          <img class="brand-logo brand-logo-dark" src="${safeUrl(BRAND_ASSETS.logoDark)}" alt="${escapeAttr(meta.siteName || "Digital InPulse")}" />
          <span class="brand-sticky-group" aria-hidden="true">
            <img class="brand-logo-sticky brand-logo-sticky-dip" src="${safeUrl(BRAND_ASSETS.logoStickyDip)}" alt="" />
          </span>
        </a>
        <a class="header-sticky-center" href="#site-top" aria-label="Retour en haut de page">
          <img class="brand-logo-sticky brand-logo-sticky-center" src="${safeUrl(BRAND_ASSETS.logoStickyMobility)}" alt="" />
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
    .map((item) => `<li><a href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a></li>`)
    .join("");

  const socials = (footer.socials || [])
    .map((item) => {
      const icon = socialIconLabel(item.label || "", item.url || "");
      return `<a class="social-link" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(item.label || "")}"><span>${icon}</span>${escapeHtml(item.label || "")}</a>`;
    })
    .join("");

  const partners = (footer.partners || []).map((item) => {
      const logo = BRAND_ASSETS.footerPartnerLogos[item.name] || "";
      if (logo) {
        return `<a class="partner-logo" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${safeUrl(logo)}" alt="${escapeAttr(item.name)}" /></a>`;
      }
      return `<a class="partner-chip" href="${safeUrl(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}</a>`;
    });
  const secondaryPartners = partners.slice(1).join("");
  const maddynessPartner = `<a class="partner-logo partner-logo-maddyness" href="https://maddyness.com" target="_blank" rel="noopener noreferrer"><img src="${safeUrl(BRAND_ASSETS.footerPartnerMaddyness)}" alt="Maddyness" /></a>`;

  host.classList.add("site-footer");
  host.style.setProperty("--footer-texture", `url('${BRAND_ASSETS.footerTexture}')`);
  host.innerHTML = `
    <div class="footer-video-shell" aria-hidden="true">
      <video autoplay muted loop playsinline preload="metadata">
        <source src="${safeUrl(BRAND_ASSETS.heroFooterVideo)}" type="video/mp4" />
      </video>
    </div>
    <div class="container footer-partners-wrap">
      <div class="footer-partners-head">
        <h4 class="footer-partners-title">Nos partenaires</h4>
      </div>
      <div class="footer-partners">${secondaryPartners}</div>
      <div class="footer-partners-extra">${maddynessPartner}</div>
    </div>
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

  document.body.dataset.currentPage = currentKey;

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
    const techPage = content.pages?.tech_for_competitivity || {};
    const homePage = {
      ...page,
      techProgramForm: techPage.form || null,
      techScheduleTitle: techPage.scheduleTitle || "",
      techSchedule: techPage.schedule || [],
      womenProgramForm: content.pages?.women_for_innovation?.form || null,
    };
    mainNode.innerHTML = renderHome(
      homePage,
      techPage.introCard,
      content.pages?.women_for_innovation?.introCard || content.pages?.tech_for_competitivity?.womenIntroCard,
    );
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

function renderHome(page, techIntroCard = null, womenIntroCard = null) {
  const techFormBack = page.techProgramForm ? renderProgramFlipBack(page.techProgramForm, "tech_for_competitivity") : "";
  const techHomeIntroCard = techIntroCard
    ? {
        ...techIntroCard,
        ctaLabel: "Je candidate",
        ctaUrl: "/tech-for-competitivity/#form",
      }
    : null;
  const hero = renderHero(page.hero, {
    variant: "home",
    sideContent: "",
    secondaryAction: page.hero?.secondaryAction,
  });
  const homeVideo = renderHomeVideo(page.video || {});
  const pillars = (page.pillars || [])
    .map(
      (item, index, items) => `
        <article class="feature-card reveal${items.length % 2 === 1 && index === items.length - 1 ? " feature-card-centered" : ""}" style="--delay:${index * 80}ms">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${formatMultilineText(item.text)}</p>
        </article>
      `,
    )
    .join("");
  const techCategory = page.categories?.[0];
  const categoryCard = techCategory
    ? `
      <article class="program-card reveal program-card-tech-home" style="--delay:0ms">
        <img class="program-card-media" src="${safeUrl(techCategory.image)}" alt="${escapeAttr(techCategory.title)}" />
        <div class="program-card-content">
          <h3>${escapeHtml(techCategory.title)}</h3>
          <p>${formatInlineGradientEmphasis(techCategory.text)}</p>
          <a class="btn btn-outline" href="${safeUrl(techCategory.url)}">${escapeHtml(techCategory.ctaLabel || "En savoir plus")}</a>
        </div>
      </article>
    `
    : "";
  const categoryImageCard = techCategory?.videoAside
    ? `
      <article class="program-card reveal program-card-tech-aside" style="--delay:80ms" aria-hidden="true">
        <video class="program-card-media-aside-standalone" autoplay muted loop playsinline preload="metadata">
          <source src="${safeUrl(techCategory.videoAside)}" type="video/mp4" />
        </video>
      </article>
    `
    : techCategory?.imageAside
    ? `
      <article class="program-card reveal program-card-tech-aside" style="--delay:80ms" aria-hidden="true">
        <img class="program-card-media-aside-standalone" src="${safeUrl(techCategory.imageAside)}" alt="${escapeAttr(techCategory.title)} illustration" />
      </article>
    `
    : "";
  const categoryCardCompact = techCategory
    ? `
      <article class="program-card reveal program-card-compact program-card-tech-home" style="--delay:0ms">
        <img class="program-card-media" src="${safeUrl(techCategory.image)}" alt="${escapeAttr(techCategory.title)}" />
        <div class="program-card-content">
          <h3>${escapeHtml(techCategory.compactTitle || techCategory.title)}</h3>
        </div>
      </article>
    `
    : "";
  const categoryPreviews = `
    <div class="program-grid-home program-grid-home-preview" data-home-preview>
      <div class="program-stack program-stack-combined program-stack-combined-tech reveal">
        ${categoryCard}
      </div>
      ${categoryImageCard}
    </div>
  `;
  const categories = `
    <div class="program-grid-home program-grid-home-single">
      <div class="program-stack program-stack-combined program-stack-combined-tech reveal" data-program-panel data-panel-key="tech" tabindex="0" aria-label="Afficher Tech For Competitivity">
        <div class="program-flip-card" data-program-flip="tech">
          <div class="program-flip-card-inner">
            <div class="program-flip-face program-flip-front">
              ${categoryCardCompact}
              ${techHomeIntroCard ? renderSingleProgramIntroCard(techHomeIntroCard, "program-intro-card-home-embedded") : ""}
            </div>
            <div class="program-flip-face program-flip-back">
              ${techFormBack}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const homeSchedule = (page.techSchedule || [])
    .map((item, index) => {
      const isFinal = /finale/i.test(item.city || "");
      const isFolder = /candidatures ouvertes/i.test(item.city || "") || /sur dossier/i.test(item.city || "");
      const dateLabel = isFolder ? "📂" : `${isFinal ? "🥇" : "✈️"} ${escapeHtml(item.date)}`;
      return `
        <article class="timeline-item timeline-item-tech ${isFinal ? "timeline-item-final" : "timeline-item-regional"} reveal" style="--delay:${index * 90}ms">
          <p class="timeline-date">${dateLabel}</p>
          <h3>${escapeHtml(item.city)}</h3>
          <p>${escapeHtml(item.text)}</p>
          ${
            item.video
              ? `
          <video class="timeline-card-image" autoplay muted loop playsinline preload="metadata">
            <source src="${safeUrl(item.video)}" type="video/mp4" />
          </video>
          `
              : ""
          }
          ${item.image ? `<img class="timeline-card-image" src="${safeUrl(item.image)}" alt="${escapeAttr(item.city)}" />` : ""}
          ${item.mediaPlaceholder ? `<div class="timeline-card-image timeline-card-image-placeholder" aria-hidden="true"></div>` : ""}
        </article>
      `;
    })
    .join("");
  const testimonials = (page.testimonials || [])
    .map(
      (item, index) => `
        <article class="testimonial-slide${index === 0 ? " active" : ""}" data-slide-index="${index}">
          <blockquote>"${escapeHtml(item.quote)}"</blockquote>
          <p class="testimonial-author">${escapeHtml(item.author)}</p>
          <p>${escapeHtml(item.role)}</p>
        </article>
      `,
    )
    .join("");

  return `
    <div class="home-intro" data-home-intro aria-hidden="true">
      <div class="home-intro-frost"></div>
    </div>
    ${hero}
    <section class="section">
      <div class="container">
        ${categoryPreviews}
      </div>
    </section>
    <section id="experience-digital-inpulse" class="section section-soft section-experience">
      <div class="container">
        ${renderSectionHead(page.introTitle || "", page.introText || "", { centered: true })}
        <div class="feature-grid">${pillars}</div>
      </div>
    </section>
    <section id="parcours-candidature" class="section">
      <div class="container">
        ${renderSectionHead(page.categoriesTitle || "", page.categoriesText || "", { centered: true })}
        ${categories}
      </div>
    </section>
    ${
      homeSchedule
        ? `
    <section class="section">
      <div class="container">
        ${renderSectionHead(page.techScheduleTitle || "", "", { centered: true })}
        <div class="timeline timeline-horizontal">${homeSchedule}</div>
      </div>
    </section>
    `
        : ""
    }
    ${homeVideo}
    <section class="section section-testimonials">
      <div class="container">
        ${renderSectionHead(page.testimonialsTitle || "", "", { centered: true })}
        <div class="testimonial-coming reveal">À venir</div>
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
      (item, index) => {
        const isTech = programKey === "tech_for_competitivity";
        const isFinal = /finale/i.test(item.city || "");
        const isFolder = /sur dossier/i.test(item.city || "");
        const timelineClass = isTech
          ? `timeline-item timeline-item-tech ${isFinal ? "timeline-item-final" : "timeline-item-regional"}`
          : "timeline-item";
        const dateLabel = isTech ? `${isFinal ? "🥇" : isFolder ? "📂" : "✈️"} ${escapeHtml(item.date)}` : escapeHtml(item.date);

        return `
        <article class="${timelineClass} reveal" style="--delay:${index * 90}ms">
          <p class="timeline-date">${dateLabel}</p>
          <h3>${escapeHtml(item.city)}</h3>
          <p>${escapeHtml(item.text)}</p>
          ${
            item.video
              ? `
          <video class="timeline-card-image" autoplay muted loop playsinline preload="metadata">
            <source src="${safeUrl(item.video)}" type="video/mp4" />
          </video>
          `
              : ""
          }
          ${item.image ? `<img class="timeline-card-image" src="${safeUrl(item.image)}" alt="${escapeAttr(item.city)}" />` : ""}
          ${item.mediaPlaceholder ? `<div class="timeline-card-image timeline-card-image-placeholder" aria-hidden="true"></div>` : ""}
        </article>
      `;
      },
    )
    .join("");
  const areas = buildProgramAreas(programKey);
  const layoutClass = programKey === "tech_for_competitivity" ? " split-layout-single" : "";
  const introCard = renderProgramIntroCard(page.introCard, page.womenIntroCard, programKey);
  const introCardHasCriteria =
    programKey === "tech_for_competitivity" &&
    (page.introCard?.eligibilityItems?.length || page.introCard?.evaluationItems?.length);

  return `
    ${hero}
    ${introCard}
    <section class="section">
      <div class="container split-layout${layoutClass}">
        ${
          programKey === "tech_for_competitivity"
            ? ""
            : introCardHasCriteria
              ? ""
              : `
        <article class="content-block reveal">
          ${renderSectionHead(page.themeTitle || "", page.themeText || "", { compact: true })}
          <ul class="check-list">${checklist}</ul>
        </article>
        `
        }
        ${
          programKey === "tech_for_competitivity"
            ? ""
            : `
        <article class="highlight-card reveal">
          <img src="${safeUrl(page.themeImage)}" alt="${escapeAttr(page.themeTitle || "")}" />
          <h3>${escapeHtml(page.scheduleTitle || "")}</h3>
          <p>${escapeHtml(page.scheduleText || "")}</p>
        </article>
        `
        }
      </div>
    </section>
    ${
      programKey === "tech_for_competitivity"
        ? ""
        : `
    <section class="section section-dark">
      <div class="container">
        ${renderSectionHead("Champs d'application", "", { centered: true, light: true })}
        <div class="scope-grid">${areas}</div>
      </div>
    </section>
    `
    }
    <section class="section">
      <div class="container">
        ${renderSectionHead(page.scheduleTitle || "", "", { centered: true })}
        <div class="timeline${programKey === "tech_for_competitivity" ? " timeline-horizontal" : ""}">${schedule}</div>
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

function renderProgramIntroCard(card = {}, womenCard = null, programKey) {
  if (programKey !== "tech_for_competitivity" || !card) {
    return "";
  }

  return `
    <section class="section section-tech-intro">
      <div class="container">
        <div class="program-intro-grid">
          ${renderSingleProgramIntroCard(card)}
          ${womenCard ? renderSingleProgramIntroCard(womenCard) : ""}
        </div>
      </div>
    </section>
  `;
}

function renderSingleProgramIntroCard(card = {}, extraClass = "") {
  const points = (card.points || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const eligibilityItems = (card.eligibilityItems || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const evaluationItems = (card.evaluationItems || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const applicationItems = (card.applicationItems || [])
    .map((item) => `<li class="program-intro-application-item">${escapeHtml(item)}</li>`)
    .join("");
  const cta =
    card.ctaLabel && card.ctaUrl
      ? `<div class="program-intro-actions"><a class="btn btn-outline" href="${safeUrl(card.ctaUrl)}">${escapeHtml(card.ctaLabel)}</a></div>`
      : "";
  const renderIconTitle = (title, icon) => {
    if (!title) {
      return "";
    }
    const cleanedTitle = escapeHtml(String(title).replace(/^[^\p{L}\p{N}]+/u, "").trim());
    const iconMap = {
      flash: "/assets/media/pages/flash.png",
      wrench: "/assets/media/pages/wrench.png",
      check: "/assets/media/pages/check.png",
    };
    const iconMarkup = icon ? `<img class="program-intro-title-icon program-intro-title-icon-${escapeAttr(icon)}" src="${safeUrl(iconMap[icon])}" alt="" aria-hidden="true" />` : "";
    return `<p class="program-intro-highlight-title">${iconMarkup}<span>${cleanedTitle}</span></p>`;
  };

  return `
    <article class="program-intro-card reveal${extraClass ? ` ${extraClass}` : ""}">
      ${card.text ? `<p class="program-intro-text">${escapeHtml(card.text)}</p>` : ""}
      ${points ? `<ul class="program-intro-list">${points}</ul>` : ""}
      ${
        card.highlightTitle || card.highlightText
          ? `
            <div class="program-intro-highlight program-intro-highlight-profile">
              ${renderIconTitle(card.highlightTitle, "flash")}
              ${card.highlightText ? `<p class="program-intro-highlight-text">${formatMultilineText(card.highlightText)}</p>` : ""}
            </div>
          `
          : ""
      }
      ${
        card.eligibilityTitle || card.eligibilityText || eligibilityItems
          ? `
            <div class="program-intro-highlight program-intro-highlight-eligibility">
              ${renderIconTitle(card.eligibilityTitle, "wrench")}
              ${card.eligibilityText ? `<p class="program-intro-highlight-text">${formatMultilineText(card.eligibilityText)}</p>` : ""}
              ${eligibilityItems ? `<ul class="program-intro-points program-intro-points-wrench">${eligibilityItems}</ul>` : ""}
            </div>
          `
          : ""
      }
      ${
        card.evaluationTitle || evaluationItems
          ? `
            <div class="program-intro-highlight program-intro-highlight-evaluation">
              ${renderIconTitle(card.evaluationTitle, "check")}
              ${evaluationItems ? `<ul class="program-intro-points program-intro-points-check">${evaluationItems}</ul>` : ""}
            </div>
          `
          : ""
      }
      ${cta}
      ${
        card.applicationTitle || applicationItems
          ? `
            <div class="program-intro-highlight program-intro-highlight-application">
              ${card.applicationTitle ? `<p class="program-intro-highlight-title">${escapeHtml(card.applicationTitle)}</p>` : ""}
              ${applicationItems ? `<ul class="program-intro-application-grid">${applicationItems}</ul>` : ""}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderProgramFlipBack(form = {}, programKey) {
  const isWomen = programKey === "women_for_innovation";
  const label = isWomen ? "Women For Innovation" : "Smart Mobility";
  return `
    <article class="program-intro-card program-intro-card-home-embedded program-intro-card-form-back">
      <div class="program-form-back-head">
        <p class="program-form-back-kicker">Formulaire</p>
        <button class="btn btn-outline btn-sm" type="button" data-program-flip-close>Retour</button>
      </div>
      <h3 class="program-form-back-title">Je candidate</h3>
      <p class="program-form-back-text">Complétez ce formulaire pour transmettre votre candidature au parcours ${label}.</p>
      <div class="program-form-back-body">
        ${buildProgramForm(form, programKey)}
      </div>
    </article>
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
  const style = hero.image
    ? isHomeStyle(options.variant === "home", hero.image)
    : "";
  const visual = renderHeroVisual(hero, options);
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
      ${visual}
      <div class="container hero-grid${side ? " with-side" : ""}">
        <div class="hero-copy reveal">
          ${hero.eyebrow ? `<p class="hero-eyebrow">${escapeHtml(hero.eyebrow)}</p>` : ""}
          <h1>${formatHeroCounters(hero.title || "")}</h1>
          <p>${escapeHtml(hero.subtitle || "")}</p>
          ${hero.highlight ? `<p class="hero-highlight">${formatHeroCounters(hero.highlight)}</p>` : ""}
          ${actions}
        </div>
        ${side}
      </div>
    </section>
  `;
}

function renderHeroVisual(hero = {}, options = {}) {
  const isHome = options.variant === "home";
  if (!isHome) {
    return "";
  }
  if (hero.video) {
    return `
      <div class="hero-home-visual hero-home-visual-video" aria-hidden="true">
        <video autoplay muted loop playsinline preload="metadata">
          <source src="${safeUrl(hero.video)}" type="video/mp4" />
        </video>
      </div>
    `;
  }
  if (hero.image) {
    return '<div class="hero-home-visual" aria-hidden="true"></div>';
  }
  return "";
}

function isHomeStyle(isHome, image) {
  if (isHome) {
    return ` style="--hero-visual-image: url('${escapeAttr(image)}')"`;
  }
  return ` style="--hero-image: url('${escapeAttr(image)}')"`;
}

function renderHomePrograms() {
  return `
    <a class="home-program-card home-program-card-tech" href="/tech-for-competitivity/">
      <img src="${safeUrl("/assets/media/pages/dip-btransparent-hero-tech.png")}" alt="Tech For Competitivity" />
      <p>La mobilité intelligente : pour une mobilité urbaine, durable & inclusive</p>
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
  const carouselImages = (video.carouselImages || [])
    .map(
      (item, index) => `
        <figure class="home-carousel-slide${index === 0 ? " active" : ""}" data-home-carousel-slide="${index}">
          <img src="${safeUrl(item)}" alt="Photo Digital InPulse ${index + 1}" loading="lazy" />
        </figure>
      `,
    )
    .join("");
  const carouselDots = (video.carouselImages || [])
    .map(
      (_, index) => `
        <button class="home-carousel-dot${index === 0 ? " active" : ""}" type="button" data-home-carousel-dot="${index}" aria-label="Afficher la photo ${index + 1}"></button>
      `,
    )
    .join("");

  return `
    <section class="section section-video${hideOnMobile ? " hide-on-mobile" : ""}">
      <div class="container">
        ${renderSectionHead(video.title || "", video.text || "", { centered: true })}
        <div class="home-video-layout home-video-layout-expanded">
          <article class="home-video-frame reveal">
            ${media}
          </article>
          <article class="home-video-frame home-carousel-frame reveal" aria-label="Carrousel photos" data-home-carousel>
            <div class="home-carousel-track">
              ${carouselImages}
            </div>
            <div class="home-carousel-dots">
              ${carouselDots}
            </div>
          </article>
        </div>
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
  return `<video autoplay muted loop playsinline preload="metadata"${poster}><source src="${safeUrl(url)}" />Votre navigateur ne supporte pas la lecture video.</video>`;
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
            <label for="${idPrefix}-first-name">Prénom *</label>
            <input id="${idPrefix}-first-name" name="first_name" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-email">Adresse email *</label>
            <input id="${idPrefix}-email" name="email" type="email" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-phone">Téléphone portable *</label>
            <input id="${idPrefix}-phone" name="phone" type="tel" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-region">Région de candidature *</label>
            <select id="${idPrefix}-region" name="region" required>
              <option value="">Sélectionner</option>
              <option>Île-de-France</option>
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
            <label for="${idPrefix}-founded">Date de création *</label>
            <input id="${idPrefix}-founded" name="founded_at" type="date" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-sector">Secteur d’activité *</label>
            <input id="${idPrefix}-sector" name="sector" required />
          </div>
          <div class="field">
            <label for="${idPrefix}-stage">Stade d’évolution *</label>
            <select id="${idPrefix}-stage" name="stage" required>
              <option value="">Sélectionner</option>
              <option>Amorçage</option>
              <option>Croissance</option>
              <option>Scale-up</option>
            </select>
          </div>
          <div class="field">
            <label for="${idPrefix}-rev-2024">Chiffre d'affaires 2024</label>
            <input id="${idPrefix}-rev-2024" name="revenue_2024" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-rev-2025">CA prévisionnel 2025</label>
            <input id="${idPrefix}-rev-2025" name="revenue_2025" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-employees">Nombre de salariés</label>
            <input id="${idPrefix}-employees" name="employees" type="number" min="0" />
          </div>
          <div class="field">
            <label for="${idPrefix}-pitch-en">Pouvez-vous pitcher en anglais ? *</label>
            <select id="${idPrefix}-pitch-en" name="pitch_english" required>
              <option value="">Sélectionner</option>
              <option>Oui</option>
              <option>Non</option>
            </select>
          </div>
          ${
            isWomen
              ? `
            <div class="field full">
              <label for="${idPrefix}-video">${escapeHtml(form.videoField || "Lien vers votre vidéo de présentation")}</label>
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
            <label for="${idPrefix}-summary">Présentation de votre entreprise et de votre projet *</label>
            <textarea id="${idPrefix}-summary" name="summary" required></textarea>
          </div>
          <div class="field full">
            <label for="${idPrefix}-impact">En quoi votre entreprise répond aux enjeux du concours ? *</label>
            <textarea id="${idPrefix}-impact" name="impact_statement" required></textarea>
          </div>
          <div class="field">
            <label for="${idPrefix}-tech-stack">Technologies utilisées</label>
            <select id="${idPrefix}-tech-stack" name="tech_stack" multiple>
              <option>Intelligence artificielle</option>
              <option>Cloud</option>
              <option>Blockchain</option>
              <option>AR/VR</option>
              <option>IoT</option>
            </select>
          </div>
          <div class="field">
            <label for="${idPrefix}-source">Comment avez-vous connu le concours ? *</label>
            <select id="${idPrefix}-source" name="source" required>
              <option value="">Sélectionner</option>
              <option>Maddyness</option>
              <option>Comité Richelieu</option>
              <option>Huawei</option>
              <option>Partenaire régional</option>
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
            <label for="${idPrefix}-deck">Présentation entreprise/projet (max 10 MB) *</label>
            <input id="${idPrefix}-deck" name="deck" type="file" data-max-size="10485760" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp" required />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Conformité</legend>
        <div class="form-grid">
          <div class="field full">
            <label for="${idPrefix}-conflict">Conflit d’intérêts avec Huawei France ?</label>
            <select id="${idPrefix}-conflict" name="conflict">
              <option value="">Sélectionner</option>
              <option>Non</option>
              <option>Oui</option>
            </select>
          </div>
          <div class="field full">
            <label for="${idPrefix}-conflict-details">Détails (si applicable)</label>
            <textarea id="${idPrefix}-conflict-details" name="conflict_details"></textarea>
          </div>
          <div class="field full">
            <label class="inline-check">
              <input type="checkbox" name="terms" required />
              Je confirme avoir pris connaissance et accepte les conditions de participation, les mentions RGPD et le règlement du concours.
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
            ? `<a class="btn btn-outline" href="${safeUrl(form.regulationUrl)}" target="_blank" rel="noopener">${escapeHtml(form.regulationLabel || "Voir le règlement")}</a>`
            : ""
        }
      </div>
      <p class="help">${escapeHtml(form.notice || "Le back-end de soumission sera connecté dans une étape suivante.")}</p>
      <p class="form-feedback" data-form-feedback role="status" aria-live="polite"></p>
    </form>
  `;
}

function wireHeader() {
  const header = document.querySelector("[data-site-header]");
  const button = document.querySelector("[data-menu-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const links = [...document.querySelectorAll("[data-nav-link]")];
  const topAnchors = [...document.querySelectorAll('a[href="#site-top"]')];
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

  for (const anchor of topAnchors) {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      header.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    });
  }
}

function wireScrollProgress() {
  const target = document.querySelector("[data-scroll-progress-target]");
  if (!target) {
    return;
  }

  let ticking = false;

  const update = () => {
    const doc = document.documentElement;
    const max = Math.max(doc.scrollHeight - window.innerHeight, 0);
    const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    target.style.setProperty("--scroll-progress", progress.toFixed(4));
    ticking = false;
  };

  const requestUpdate = () => {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
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

function wireHomeCarousel() {
  const carousel = document.querySelector("[data-home-carousel]");
  if (!carousel) {
    return;
  }
  const slides = [...carousel.querySelectorAll("[data-home-carousel-slide]")];
  const dots = [...carousel.querySelectorAll("[data-home-carousel-dot]")];
  if (!slides.length) {
    return;
  }

  let index = 0;
  let timer = null;

  const setActive = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === index);
    });
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
  };

  const start = () => {
    timer = window.setInterval(() => setActive(index + 1), 3200);
  };

  const stop = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      setActive(dotIndex);
      stop();
      start();
    });
  });

  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);

  setActive(0);
  start();
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

function wireProgramPanels() {
  const wrappers = document.querySelectorAll("[data-program-panels]");
  if (!wrappers.length) {
    return;
  }

  const media = window.matchMedia("(min-width: 941px)");

  wrappers.forEach((wrapper) => {
    const panels = wrapper.querySelectorAll("[data-program-panel]");
    const setActive = (key) => {
      if (!media.matches) {
        wrapper.classList.remove("active-tech", "active-women");
        return;
      }
      wrapper.classList.toggle("active-tech", key === "tech");
      wrapper.classList.toggle("active-women", key === "women");
    };

    panels.forEach((panel) => {
      panel.addEventListener("click", (event) => {
        if (!media.matches) {
          return;
        }
        if (wrapper.querySelector(".is-flipped")) {
          return;
        }
        if (event.target.closest("a, button, input, select, textarea, label") || panel.classList.contains("is-flipped")) {
          return;
        }
        const key = panel.dataset.panelKey || "tech";
        const isAlreadyActive =
          (key === "tech" && wrapper.classList.contains("active-tech")) ||
          (key === "women" && wrapper.classList.contains("active-women"));
        setActive(isAlreadyActive ? "" : key);
      });

      panel.addEventListener("keydown", (event) => {
        if (!media.matches) {
          return;
        }
        if (wrapper.querySelector(".is-flipped")) {
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        const key = panel.dataset.panelKey || "tech";
        const isAlreadyActive =
          (key === "tech" && wrapper.classList.contains("active-tech")) ||
          (key === "women" && wrapper.classList.contains("active-women"));
        setActive(isAlreadyActive ? "" : key);
      });
    });

    media.addEventListener("change", () => {
      if (!media.matches) {
        setActive("tech");
      }
    });
  });
}

function wireProgramFlipCards() {
  const cards = document.querySelectorAll("[data-program-flip]");
  if (!cards.length) {
    return;
  }

  cards.forEach((card) => {
    const panel = card.closest("[data-program-panel]");
    const wrapper = card.closest("[data-program-panels]");
    const openTrigger = card.querySelector(".program-intro-actions .btn");
    const closeTrigger = card.querySelector("[data-program-flip-close]");
    let switchTimer = null;
    let scrollTimer = null;

    const setFlipped = (state) => {
      card.classList.add("is-switching");
      window.clearTimeout(switchTimer);
      window.clearTimeout(scrollTimer);
      card.classList.toggle("is-flipped", state);
      panel?.classList.toggle("is-flipped", state);
      if (wrapper) {
        if (state && window.matchMedia("(min-width: 941px)").matches) {
          wrapper.classList.toggle("active-tech", panel?.dataset.panelKey === "tech");
          wrapper.classList.toggle("active-women", panel?.dataset.panelKey === "women");
        } else {
          wrapper.classList.remove("active-tech", "active-women");
        }
      }
      if (state && panel) {
        scrollTimer = window.setTimeout(() => {
          const offset = window.matchMedia("(min-width: 941px)").matches ? 96 : 72;
          const top = panel.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({
            top: Math.max(0, top),
            behavior: "smooth",
          });
        }, 180);
      }
      switchTimer = window.setTimeout(() => {
        card.classList.remove("is-switching");
      }, 220);
    };

    openTrigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setFlipped(true);
    });

    closeTrigger?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setFlipped(false);
    });
  });
}

function wireHomeIntro() {
  if (document.body.dataset.currentPage !== "home") {
    return;
  }
  const intro = document.querySelector("[data-home-intro]");
  if (!intro) {
    return;
  }

  document.body.classList.add("home-intro-active");

  window.setTimeout(() => {
    intro.classList.add("is-leaving");
    document.body.classList.remove("home-intro-active");
    window.setTimeout(() => {
      intro.remove();
    }, 620);
  }, 760);
}

function wireHomePreviewDrift() {
  if (document.body.dataset.currentPage !== "home") {
    return;
  }

  const media = window.matchMedia("(min-width: 941px)");
  const cards = document.querySelectorAll(".program-grid-home-preview .program-card-tech-home, .program-grid-home-preview .program-card-tech-aside");
  if (!cards.length) {
    return;
  }

  const resetCard = (card) => {
    card.style.setProperty("--card-rotate-x", "0deg");
    card.style.setProperty("--card-rotate-y", "0deg");
    card.style.setProperty("--card-shift-x", "0px");
    card.style.setProperty("--card-shift-y", "0px");
  };

  const bindCard = (card) => {
    resetCard(card);

    card.addEventListener("mousemove", (event) => {
      if (!media.matches) {
        return;
      }
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * 8;
      const rotateX = (0.5 - py) * 8;
      const shiftX = (px - 0.5) * 10;
      const shiftY = (py - 0.5) * 8;

      card.style.setProperty("--card-rotate-x", `${rotateX.toFixed(2)}deg`);
      card.style.setProperty("--card-rotate-y", `${rotateY.toFixed(2)}deg`);
      card.style.setProperty("--card-shift-x", `${shiftX.toFixed(2)}px`);
      card.style.setProperty("--card-shift-y", `${shiftY.toFixed(2)}px`);
    });

    card.addEventListener("mouseleave", () => {
      resetCard(card);
    });
  };

  cards.forEach(bindCard);

  media.addEventListener("change", () => {
    if (!media.matches) {
      cards.forEach(resetCard);
    }
  });
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

function socialIconLabel(label, url = "") {
  const lower = `${String(label || "").toLowerCase()} ${String(url || "").toLowerCase()}`;
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

function formatInlineGradientEmphasis(value) {
  return escapeHtml(value).replace(/--(.*?)--/g, '<strong class="gradient-inline-emphasis">$1</strong>');
}

function formatMultilineText(value) {
  return escapeHtml(value).replace(/\n{2,}/g, "<br /><br />").replace(/\n/g, "<br />");
}

function formatHeroCounters(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\+\s*100(?!\d)/g, '<span class="hero-counter" data-counter-target="100" data-counter-prefix="+">0</span>')
    .replace(/\+10(?!\d)/g, "+10");
}

function safeUrl(value) {
  if (!value) {
    return "#";
  }
  return escapeAttr(value);
}

function wireHeroCounters() {
  const counters = Array.from(document.querySelectorAll("[data-counter-target]"));
  if (!counters.length) {
    return;
  }

  window.setTimeout(() => {
    counters.forEach((node) => {
      const target = Number(node.getAttribute("data-counter-target") || "0");
      const prefix = node.getAttribute("data-counter-prefix") || "";
      const start = performance.now();
      const duration = target >= 100 ? 4200 : 1900;

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        node.textContent = `${prefix}${current}`;
        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    });
  }, 1550);
}

function wireAutoplayVideos() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (!videos.length) {
    return;
  }

  const playVideo = (video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
  };

  for (const video of videos) {
    playVideo(video);
    video.addEventListener("loadedmetadata", () => playVideo(video), { passive: true });
    video.addEventListener("canplay", () => playVideo(video), { passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    for (const video of videos) {
      playVideo(video);
    }
  });

  window.addEventListener("pageshow", () => {
    for (const video of videos) {
      playVideo(video);
    }
  });
}

function wireDocumentPreviews() {}
