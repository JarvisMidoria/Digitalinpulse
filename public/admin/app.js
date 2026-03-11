const CONTENT_ENDPOINT = "/content/site.json";
const SAVE_ENDPOINT = "/.netlify/functions/save-content";
const UPLOAD_ENDPOINT = "/.netlify/functions/upload-media";
const LIST_SUBMISSIONS_ENDPOINT = "/.netlify/functions/list-submissions";
const DRAFT_KEY = "dip_admin_draft_v2";

const state = {
  user: null,
  content: null,
  original: null,
  submissions: [],
  filteredSubmissions: [],
  submissionsLoaded: false,
};

const authScreen = document.getElementById("auth-screen");
const appRoot = document.getElementById("app");
const statusText = document.getElementById("status-text");
const publishResult = document.getElementById("publish-result");
const rawJsonInput = document.getElementById("raw-json");
const mediaFileInput = document.getElementById("media-file-input");
const mediaUrlOutput = document.getElementById("media-url-output");
const submissionsCount = document.getElementById("submissions-count");
const submissionsTableBody = document.getElementById("submissions-table-body");
const submissionsSearchInput = document.getElementById("submissions-search");
const submissionsProgramFilter = document.getElementById("submissions-program-filter");

init();

function init() {
  wireIdentity();
  wireSidebar();
  wireActions();
}

function wireIdentity() {
  if (!window.netlifyIdentity) {
    setStatus("Netlify Identity non disponible");
    return;
  }

  window.netlifyIdentity.on("init", async (user) => {
    state.user = user;
    if (user) {
      await enterEditorMode();
    } else {
      showAuth();
      if (hasIdentityToken()) {
        window.netlifyIdentity.open();
      }
    }
  });

  window.netlifyIdentity.on("login", async (user) => {
    state.user = user;
    window.netlifyIdentity.close();
    await enterEditorMode();
  });

  window.netlifyIdentity.on("logout", () => {
    state.user = null;
    state.submissions = [];
    state.filteredSubmissions = [];
    state.submissionsLoaded = false;
    showAuth();
    setStatus("Deconnecte");
  });

  window.netlifyIdentity.init();
}

function wireSidebar() {
  const navItems = [...document.querySelectorAll(".nav-item")];
  for (const item of navItems) {
    item.addEventListener("click", () => {
      navItems.forEach((node) => node.classList.remove("active"));
      item.classList.add("active");
      const panelTarget = item.dataset.panelTarget;
      showPanel(panelTarget);
      if (panelTarget === "panel-submissions") {
        loadSubmissions();
      }
    });
  }
}

function wireActions() {
  document.getElementById("login-btn")?.addEventListener("click", () => {
    window.netlifyIdentity?.open("login");
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    window.netlifyIdentity?.logout();
  });

  document.getElementById("save-draft-btn")?.addEventListener("click", saveDraft);
  document.getElementById("restore-draft-btn")?.addEventListener("click", restoreDraft);
  document.getElementById("publish-btn")?.addEventListener("click", publishContent);
  document.getElementById("upload-media-btn")?.addEventListener("click", uploadMedia);
  document.getElementById("copy-media-url-btn")?.addEventListener("click", copyMediaUrl);
  document.getElementById("apply-json-btn")?.addEventListener("click", applyRawJson);
  document.getElementById("submissions-refresh-btn")?.addEventListener("click", () => loadSubmissions(true));
  document.getElementById("submissions-export-btn")?.addEventListener("click", exportSubmissionsCsv);
  submissionsSearchInput?.addEventListener("input", applySubmissionsFilters);
  submissionsProgramFilter?.addEventListener("change", applySubmissionsFilters);
}

async function enterEditorMode() {
  showApp();
  setStatus("Chargement du contenu...");
  setResult("");

  try {
    state.content = await fetchContent();
    state.original = deepClone(state.content);
    hydrateInputs();
    bindInputs();
    updateRawJson();
    updatePreview();
    setStatus("Pret");
  } catch (error) {
    setResult(`Erreur chargement contenu: ${error.message}`, true);
    setStatus("Erreur de chargement");
  }
}

async function fetchContent() {
  const response = await fetch(CONTENT_ENDPOINT, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Impossible de charger le contenu: ${response.status}`);
  }
  return response.json();
}

function hydrateInputs() {
  const inputs = [...document.querySelectorAll("[data-path]")];
  for (const input of inputs) {
    const value = getByPath(state.content, input.dataset.path);
    if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
      input.value = value == null ? "" : String(value);
    }
  }
}

function bindInputs() {
  const inputs = [...document.querySelectorAll("[data-path]")];
  for (const input of inputs) {
    if (input.dataset.bound === "true") {
      continue;
    }
    input.dataset.bound = "true";
    input.addEventListener("input", () => {
      setByPath(state.content, input.dataset.path, input.value);
      updateRawJson();
      updatePreview();
      setStatus("Modification locale non publiee");
    });
  }
}

function updateRawJson() {
  if (!rawJsonInput) {
    return;
  }
  rawJsonInput.value = JSON.stringify(state.content, null, 2);
}

function applyRawJson() {
  if (!rawJsonInput) {
    return;
  }
  try {
    const parsed = JSON.parse(rawJsonInput.value);
    state.content = parsed;
    hydrateInputs();
    updatePreview();
    setStatus("JSON applique localement");
    setResult("");
  } catch (error) {
    setResult(`JSON invalide: ${error.message}`, true);
  }
}

function updatePreview() {
  setText("preview-home-title", getByPath(state.content, "pages.home.hero.title"));
  setText("preview-home-subtitle", getByPath(state.content, "pages.home.hero.subtitle"));
  setText("preview-tech-title", getByPath(state.content, "pages.tech_for_competitivity.hero.title"));
  setText("preview-tech-date", `Finale: ${getByPath(state.content, "pages.tech_for_competitivity.schedule[3].date")}`);
  setText("preview-women-title", getByPath(state.content, "pages.women_for_innovation.hero.title"));
  setText("preview-women-date", `Finale: ${getByPath(state.content, "pages.women_for_innovation.schedule[3].date")}`);
  setText("preview-privacy-link", `Confidentialite: ${getByPath(state.content, "footer.legalLinks[3].url")}`);
  setText("preview-rules-link", `Reglement: ${getByPath(state.content, "footer.legalLinks[4].url")}`);
}

function saveDraft() {
  if (!state.content) {
    return;
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
  setStatus("Brouillon sauvegarde localement");
  setResult("Brouillon local sauvegarde.");
}

function restoreDraft() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (!draft) {
    setResult("Aucun brouillon local trouve.", true);
    return;
  }
  try {
    state.content = JSON.parse(draft);
    hydrateInputs();
    updateRawJson();
    updatePreview();
    setStatus("Brouillon restaure");
    setResult("Brouillon local restaure.");
  } catch (error) {
    setResult(`Brouillon invalide: ${error.message}`, true);
  }
}

async function publishContent() {
  if (!state.user) {
    setResult("Session non authentifiee.", true);
    return;
  }

  try {
    setStatus("Publication en cours...");
    setResult("");

    const jwt = await state.user.jwt(true);
    const response = await fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        content: state.content,
        source: "custom-admin",
      }),
    });

    const payload = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(payload.error || `Echec de publication (${response.status})`);
    }

    state.original = deepClone(state.content);
    const commitLabel = payload.commitUrl ? `Commit cree: ${payload.commitUrl}` : "Publication reussie.";
    setResult(commitLabel);
    setStatus("Publication reussie");
  } catch (error) {
    setResult(`Erreur publication: ${error.message}`, true);
    setStatus("Erreur de publication");
  }
}

async function uploadMedia() {
  if (!state.user) {
    setResult("Session non authentifiee.", true);
    return;
  }
  const file = mediaFileInput?.files?.[0];
  if (!file) {
    setResult("Selectionnez un fichier media avant upload.", true);
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setResult("Fichier trop volumineux (max 10 MB).", true);
    return;
  }

  try {
    setStatus("Upload media en cours...");
    setResult("");

    const base64 = await fileToBase64(file);
    const jwt = await state.user.jwt(true);
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        base64,
      }),
    });
    const payload = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(payload.error || `Upload media impossible (${response.status})`);
    }

    mediaUrlOutput.value = payload.url || "";
    setResult(`Media upload reussi: ${payload.url}`);
    setStatus("Upload media reussi");
  } catch (error) {
    setResult(`Erreur upload: ${error.message}`, true);
    setStatus("Erreur upload media");
  }
}

async function copyMediaUrl() {
  if (!mediaUrlOutput?.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(mediaUrlOutput.value);
    setStatus("URL media copiee");
  } catch (_error) {
    setStatus("Impossible de copier automatiquement");
  }
}

async function loadSubmissions(force = false) {
  if (!state.user) {
    setResult("Session non authentifiee.", true);
    return;
  }
  if (state.submissionsLoaded && !force) {
    applySubmissionsFilters();
    return;
  }

  try {
    setStatus("Chargement des candidatures...");
    const jwt = await state.user.jwt(true);
    const response = await fetch(`${LIST_SUBMISSIONS_ENDPOINT}?limit=300`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
    const payload = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(payload.error || `Echec chargement candidatures (${response.status})`);
    }

    state.submissions = Array.isArray(payload.items) ? payload.items : [];
    state.submissionsLoaded = true;
    applySubmissionsFilters();
    setStatus("Candidatures chargees");
  } catch (error) {
    setResult(`Erreur candidatures: ${error.message}`, true);
    setStatus("Erreur chargement candidatures");
  }
}

function applySubmissionsFilters() {
  const selectedProgram = String(submissionsProgramFilter?.value || "all");
  const query = String(submissionsSearchInput?.value || "")
    .toLowerCase()
    .trim();

  state.filteredSubmissions = state.submissions.filter((item) => {
    if (selectedProgram !== "all" && String(item.program) !== selectedProgram) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [
      item.reference,
      item.program,
      item.summary?.name,
      item.summary?.email,
      item.summary?.company,
      item.summary?.region,
      item.summary?.city,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });

  renderSubmissions();
}

function renderSubmissions() {
  if (!submissionsTableBody) {
    return;
  }

  submissionsTableBody.innerHTML = state.filteredSubmissions
    .map((item) => {
      const displayDate = formatDate(item.createdAt);
      const programLabel = programToLabel(item.program);
      const name = item.summary?.name || "-";
      const email = item.summary?.email || "-";
      const company = item.summary?.company || "-";
      const region = item.summary?.region || item.summary?.city || "-";
      const reference = item.reference || "-";
      const fileCount = Number(item.fileCount || 0);

      return `
        <tr>
          <td>${escapeHtml(displayDate)}</td>
          <td><span class="chip">${escapeHtml(programLabel)}</span></td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(email)}</td>
          <td>${escapeHtml(company)}</td>
          <td>${escapeHtml(region)}</td>
          <td><span class="mono">${escapeHtml(reference)}</span></td>
          <td>${escapeHtml(String(fileCount))}</td>
        </tr>
      `;
    })
    .join("");

  if (submissionsCount) {
    const total = state.submissions.length;
    const shown = state.filteredSubmissions.length;
    submissionsCount.textContent = `${shown} candidature(s) affichee(s) / ${total} total.`;
  }
}

function exportSubmissionsCsv() {
  if (!state.filteredSubmissions.length) {
    setResult("Aucune candidature a exporter.", true);
    return;
  }

  const headers = [
    "reference",
    "created_at",
    "program",
    "name",
    "email",
    "phone",
    "company",
    "website",
    "region",
    "city",
    "stage",
    "source",
    "pitch_english",
    "employees",
    "revenue_2024",
    "revenue_2025",
    "summary",
    "impact_statement",
    "file_count",
  ];

  const rows = state.filteredSubmissions.map((item) => {
    return [
      item.reference || "",
      item.createdAt || "",
      item.program || "",
      item.summary?.name || "",
      getSubmissionField(item, "email"),
      getSubmissionField(item, "phone"),
      getSubmissionField(item, "company"),
      getSubmissionField(item, "website"),
      getSubmissionField(item, "region"),
      getSubmissionField(item, "city"),
      getSubmissionField(item, "stage"),
      getSubmissionField(item, "source"),
      getSubmissionField(item, "pitch_english"),
      getSubmissionField(item, "employees"),
      getSubmissionField(item, "revenue_2024"),
      getSubmissionField(item, "revenue_2025"),
      getSubmissionField(item, "summary"),
      getSubmissionField(item, "impact_statement"),
      String(item.fileCount || 0),
    ];
  });

  const csv = [headers.join(";"), ...rows.map((row) => row.map(csvEscape).join(";"))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `digital-inpulse-candidatures-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Export CSV genere");
}

function getSubmissionField(item, key) {
  const value = item?.fields?.[key];
  if (Array.isArray(value)) {
    return value.join(" | ");
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.toLocaleDateString("fr-FR")} ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function programToLabel(value) {
  if (value === "tech_for_competitivity") {
    return "Tech";
  }
  if (value === "women_for_innovation") {
    return "Women";
  }
  return value || "N/A";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function showAuth() {
  authScreen.classList.remove("hidden");
  appRoot.classList.add("hidden");
}

function showApp() {
  authScreen.classList.add("hidden");
  appRoot.classList.remove("hidden");
}

function showPanel(panelId) {
  const panels = [...document.querySelectorAll(".panel")];
  for (const panel of panels) {
    panel.classList.toggle("active", panel.id === panelId);
  }
}

function setStatus(text) {
  if (statusText) {
    statusText.textContent = text;
  }
}

function setResult(text, isError = false) {
  if (!publishResult) {
    return;
  }
  publishResult.textContent = text;
  publishResult.classList.toggle("error", isError);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (!node) {
    return;
  }
  node.textContent = value == null ? "" : String(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasIdentityToken() {
  const pattern = /(invite_token|recovery_token|confirmation_token|email_change_token)=/;
  return pattern.test(window.location.hash) || pattern.test(window.location.search);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const split = result.split(",");
      if (split.length < 2) {
        reject(new Error("Fichier non lisible"));
        return;
      }
      resolve(split[1]);
    };
    reader.onerror = () => reject(new Error("Lecture fichier echouee"));
    reader.readAsDataURL(file);
  });
}

async function readJsonSafe(response) {
  const payload = await response.text();
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(payload);
  } catch (_error) {
    return { error: payload };
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getByPath(object, path) {
  const parts = pathToParts(path);
  let cursor = object;
  for (const part of parts) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setByPath(object, path, value) {
  const parts = pathToParts(path);
  let cursor = object;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const nextPart = parts[index + 1];
    if (cursor[part] == null) {
      cursor[part] = Number.isInteger(nextPart) ? [] : {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function pathToParts(path) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}
