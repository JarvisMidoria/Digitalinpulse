const LIST_SUBMISSIONS_ENDPOINT = "/.netlify/functions/list-submissions";
const SUBMISSION_FILE_URL_ENDPOINT = "/.netlify/functions/submission-file-url";
const EXPORT_SUBMISSIONS_ENDPOINT = "/.netlify/functions/export-submissions";
const DELETE_SUBMISSION_ENDPOINT = "/.netlify/functions/delete-submission";
const FIELD_LABELS = {
  last_name: "Nom",
  first_name: "Prénom",
  email: "E-mail",
  phone: "Téléphone portable",
  company: "Nom de l'entreprise",
  address: "Adresse",
  postal_code: "Code postal",
  city: "Ville",
  website: "Site web",
  founded_at: "Date de création",
  sector: "Secteur d'activité",
  stage: "Stade d'évolution",
  revenue_2025: "Chiffre d'affaires 2025",
  revenue_2026: "Chiffre d'affaires prévisionnel 2026",
  employees: "Nombre de salariés",
  pitch_english: "Pitch en anglais",
  video_url: "Lien vidéo",
  summary: "Présentation de l'entreprise et du projet",
  impact_statement: "Réponse aux enjeux du concours",
  tech_stack: "Technologies utilisées",
  source: "Comment avez-vous connu le concours ?",
  conflict: "Conflit d'intérêts avec Huawei France",
  kbis: "Kbis",
  deck: "Présentation entreprise/projet",
  region: "Région",
};

const state = {
  user: null,
  submissions: [],
  filteredSubmissions: [],
  selectedSubmissionReference: "",
};

const authScreen = document.getElementById("auth-screen");
const appRoot = document.getElementById("app");
const statusText = document.getElementById("status-text");
const resultMessage = document.getElementById("result-message");
const submissionsCount = document.getElementById("submissions-count");
const submissionsTableBody = document.getElementById("submissions-table-body");
const submissionsSearchInput = document.getElementById("submissions-search");
const submissionsProgramFilter = document.getElementById("submissions-program-filter");
const submissionsDownloadAllButton = document.getElementById("submissions-download-all-btn");
const submissionDetailNode = document.getElementById("submission-detail");
const submissionDetailTitle = document.getElementById("submission-detail-title");
const submissionDetailMeta = document.getElementById("submission-detail-meta");
const submissionDetailFields = document.getElementById("submission-detail-fields");
const submissionDetailFiles = document.getElementById("submission-detail-files");
const submissionDetailDownloadButton = document.getElementById("submission-detail-download-btn");
const submissionDetailDeleteButton = document.getElementById("submission-detail-delete-btn");

init();

function init() {
  wireIdentity();
  wireActions();
}

function wireIdentity() {
  if (!window.netlifyIdentity) {
    setStatus("Netlify Identity non disponible");
    return;
  }

  window.netlifyIdentity.on("init", async (user) => {
    state.user = user;
    if (!user) {
      showAuth();
      if (hasIdentityToken()) {
        window.netlifyIdentity.open();
      }
      return;
    }
    await enterReaderMode();
  });

  window.netlifyIdentity.on("login", async (user) => {
    state.user = user;
    window.netlifyIdentity.close();
    await enterReaderMode();
  });

  window.netlifyIdentity.on("logout", () => {
    state.user = null;
    state.submissions = [];
    state.filteredSubmissions = [];
    state.selectedSubmissionReference = "";
    showAuth();
    setStatus("Deconnecte");
    setResult("");
  });

  window.netlifyIdentity.init();
}

function wireActions() {
  document.getElementById("login-btn")?.addEventListener("click", () => {
    window.netlifyIdentity?.open("login");
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    window.netlifyIdentity?.logout();
  });

  document.getElementById("submissions-refresh-btn")?.addEventListener("click", () => {
    loadSubmissions();
  });
  submissionsDownloadAllButton?.addEventListener("click", downloadAllSubmissions);
  submissionDetailDownloadButton?.addEventListener("click", downloadSubmissionBundle);
  submissionDetailDeleteButton?.addEventListener("click", deleteSubmission);

  submissionsSearchInput?.addEventListener("input", applySubmissionsFilters);
  submissionsProgramFilter?.addEventListener("change", applySubmissionsFilters);
}

async function enterReaderMode() {
  showApp();
  setStatus("Chargement des candidatures...");
  setResult("");
  await loadSubmissions();
}

async function loadSubmissions() {
  if (!state.user) {
    setResult("Session non authentifiee.", true);
    return;
  }

  try {
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
    applySubmissionsFilters();
    setStatus("Candidatures chargees");
    setResult("");
  } catch (error) {
    state.submissions = [];
    state.filteredSubmissions = [];
    state.selectedSubmissionReference = "";
    renderSubmissions();
    renderSubmissionDetail();
    setStatus("Erreur chargement candidatures");
    setResult(error.message || "Erreur de chargement.", true);
  }
}

function applySubmissionsFilters() {
  const selectedProgram = String(submissionsProgramFilter?.value || "all");
  const query = String(submissionsSearchInput?.value || "")
    .toLowerCase()
    .trim();

  state.filteredSubmissions = state.submissions.filter((item) => {
    if (selectedProgram !== "all" && String(item.program || "") !== selectedProgram) {
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

  const current = state.filteredSubmissions.find((item) => item.reference === state.selectedSubmissionReference);
  state.selectedSubmissionReference = current?.reference || state.filteredSubmissions[0]?.reference || "";
  renderSubmissions();
  renderSubmissionDetail();
}

function renderSubmissions() {
  if (!submissionsTableBody) {
    return;
  }

  if (!state.filteredSubmissions.length) {
    submissionsTableBody.innerHTML = `
      <tr>
        <td colspan="9">Aucune candidature chargee.</td>
      </tr>
    `;
  } else {
    submissionsTableBody.innerHTML = state.filteredSubmissions
      .map((item) => {
        const reference = item.reference || "";
        const isSelected = reference && reference === state.selectedSubmissionReference;
        return `
          <tr${isSelected ? ' class="is-selected"' : ""}>
            <td>${escapeHtml(formatDate(item.createdAt))}</td>
            <td><span class="chip">${escapeHtml(programToLabel(item.program))}</span></td>
            <td>${escapeHtml(item.summary?.name || "-")}</td>
            <td>${escapeHtml(item.summary?.email || "-")}</td>
            <td>${escapeHtml(item.summary?.company || "-")}</td>
            <td>${escapeHtml(item.summary?.region || item.summary?.city || "-")}</td>
            <td><span class="mono">${escapeHtml(reference || "-")}</span></td>
            <td>${escapeHtml(String(item.fileCount || 0))}</td>
            <td class="actions-cell">
              <button type="button" class="btn btn-ghost btn-xs" data-submission-view="${escapeAttr(reference)}">Voir</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  submissionsTableBody.querySelectorAll("[data-submission-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSubmissionReference = button.dataset.submissionView || "";
      renderSubmissions();
      renderSubmissionDetail();
    });
  });

  if (submissionsCount) {
    submissionsCount.textContent = `${state.filteredSubmissions.length} affichee(s) / ${state.submissions.length} total`;
  }
}

function renderSubmissionDetail() {
  if (!submissionDetailNode) {
    return;
  }

  const item = state.submissions.find((entry) => entry.reference === state.selectedSubmissionReference);
  if (!item) {
    submissionDetailNode.classList.add("hidden");
    return;
  }

  submissionDetailNode.classList.remove("hidden");
  submissionDetailTitle.textContent = `${item.summary?.company || "Entreprise"} - ${item.reference || ""}`;
  submissionDetailMeta.innerHTML = [
    `<span class="chip">${escapeHtml(programToLabel(item.program))}</span>`,
    `<span class="chip">${escapeHtml(formatDate(item.createdAt))}</span>`,
    `<span class="chip">${escapeHtml(item.summary?.company || "Entreprise inconnue")}</span>`,
  ].join("");
  if (submissionDetailDownloadButton) {
    submissionDetailDownloadButton.disabled = false;
  }
  if (submissionDetailDeleteButton) {
    submissionDetailDeleteButton.disabled = false;
  }

  submissionDetailFields.innerHTML = Object.entries(item.fields || {})
    .filter(([key]) => key !== "program" && key !== "website_confirm")
    .map(([key, value]) => `
      <div class="submission-detail-row">
        <strong>${escapeHtml(humanizeFieldName(key))}</strong>
        <span>${escapeHtml(formatFieldValue(value))}</span>
      </div>
    `)
    .join("");

  submissionDetailFiles.innerHTML = (item.files || [])
    .map((file, index) => `
      <div class="submission-detail-row">
        <strong>${escapeHtml(file.filename || `Fichier ${index + 1}`)}</strong>
        <span>${escapeHtml(file.contentType || "")} - ${escapeHtml(formatBytes(file.size || 0))}</span>
        <a href="#" data-submission-file="${escapeAttr(file.path || "")}">Telecharger</a>
      </div>
    `)
    .join("") || "<p class=\"muted\">Aucun fichier.</p>";

  submissionDetailFiles.querySelectorAll("[data-submission-file]").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const path = link.dataset.submissionFile || "";
      if (!path || !state.user) {
        return;
      }
      try {
        const jwt = await state.user.jwt(true);
        const response = await fetch(`${SUBMISSION_FILE_URL_ENDPOINT}?path=${encodeURIComponent(path)}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });
        const payload = await readJsonSafe(response);
        if (!response.ok) {
          throw new Error(payload.error || `Impossible de generer le lien (${response.status})`);
        }
        if (payload.url) {
          window.open(payload.url, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        setResult(error.message || "Erreur de telechargement.", true);
      }
    });
  });
}

async function downloadSubmissionBundle() {
  if (!state.user || !state.selectedSubmissionReference) {
    return;
  }

  const button = submissionDetailDownloadButton;
  const previousLabel = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparation...";
  }

  try {
    const jwt = await state.user.jwt(true);
    const response = await fetch(EXPORT_SUBMISSIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        references: [state.selectedSubmissionReference],
      }),
    });
    if (!response.ok) {
      const payload = await readJsonSafe(response);
      throw new Error(payload.error || `Export impossible (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDownloadFilename(response, `${buildSubmissionArchiveName(item)}.zip`);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    setResult(error.message || "Erreur export dossier.", true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel || "Telecharger le dossier complet";
    }
  }
}

async function downloadAllSubmissions() {
  if (!state.filteredSubmissions.length) {
    setResult("Aucune candidature a telecharger.", true);
    return;
  }

  const references = state.filteredSubmissions
    .map((item) => String(item.reference || "").trim())
    .filter(Boolean);
  if (!references.length) {
    setResult("Aucune candidature a telecharger.", true);
    return;
  }

  const button = submissionsDownloadAllButton;
  const previousLabel = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparation...";
  }

  try {
    const jwt = await state.user.jwt(true);
    const response = await fetch(EXPORT_SUBMISSIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ references }),
    });
    if (!response.ok) {
      const payload = await readJsonSafe(response);
      throw new Error(payload.error || `Export impossible (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDownloadFilename(response, "digital-inpulse-candidatures.zip");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    setResult(error.message || "Erreur export candidatures.", true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel || "Tout telecharger";
    }
  }
}

function buildSubmissionArchiveName(item) {
  const company = String(item?.summary?.company || "Entreprise").replace(/[\\/:*?"<>|]/g, "-").trim() || "Entreprise";
  const reference = String(item?.reference || "submission").replace(/[\\/:*?"<>|]/g, "-").trim() || "submission";
  return `${company} (${reference})`;
}

function getDownloadFilename(response, fallback) {
  const header = response.headers.get("Content-Disposition") || response.headers.get("content-disposition") || "";
  const match = header.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) {
    return match[1];
  }
  return fallback;
}

async function deleteSubmission() {
  if (!state.user || !state.selectedSubmissionReference) {
    return;
  }

  const item = state.submissions.find((entry) => entry.reference === state.selectedSubmissionReference);
  const label = item?.summary?.name || state.selectedSubmissionReference;
  const confirmed = window.confirm(`Supprimer definitivement la candidature "${label}" ?`);
  if (!confirmed) {
    return;
  }

  const button = submissionDetailDeleteButton;
  const previousLabel = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Suppression...";
  }

  try {
    const jwt = await state.user.jwt(true);
    const response = await fetch(DELETE_SUBMISSION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        reference: state.selectedSubmissionReference,
      }),
    });
    const payload = await readJsonSafe(response);
    if (!response.ok) {
      throw new Error(payload.error || `Suppression impossible (${response.status})`);
    }

    state.submissions = state.submissions.filter((entry) => entry.reference !== state.selectedSubmissionReference);
    state.filteredSubmissions = state.filteredSubmissions.filter((entry) => entry.reference !== state.selectedSubmissionReference);
    state.selectedSubmissionReference = "";
    applySubmissionsFilters();
    setStatus("Candidature supprimee");
    setResult("Candidature supprimee.");
  } catch (error) {
    setResult(error.message || "Erreur suppression candidature.", true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousLabel || "Supprimer la candidature";
    }
  }
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

function showAuth() {
  authScreen?.classList.remove("hidden");
  appRoot?.classList.add("hidden");
}

function showApp() {
  authScreen?.classList.add("hidden");
  appRoot?.classList.remove("hidden");
}

function setStatus(text) {
  if (statusText) {
    statusText.textContent = text;
  }
}

function setResult(text, isError = false) {
  if (!resultMessage) {
    return;
  }
  if (!text) {
    resultMessage.textContent = "";
    resultMessage.classList.add("hidden");
    resultMessage.classList.remove("error");
    return;
  }
  resultMessage.textContent = text;
  resultMessage.classList.remove("hidden");
  resultMessage.classList.toggle("error", isError);
}

function hasIdentityToken() {
  const pattern = /(invite_token|recovery_token|confirmation_token|email_change_token)=/;
  return pattern.test(window.location.hash) || pattern.test(window.location.search);
}

function programToLabel(program) {
  if (String(program || "").toLowerCase() === "smart_mobility") {
    return "Smart Mobility";
  }
  return program || "-";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizeFieldName(value) {
  if (FIELD_LABELS[value]) {
    return FIELD_LABELS[value];
  }
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValue(item)).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }
  return String(value ?? "-");
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let current = size;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
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
  return escapeHtml(value);
}
