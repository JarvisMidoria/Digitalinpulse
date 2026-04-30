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
  identityCallback: null,
  identityWired: false,
};

const authScreen = document.getElementById("auth-screen");
const authLoginPanel = document.getElementById("auth-login-panel");
const authPasswordPanel = document.getElementById("auth-password-panel");
const passwordPanelTitle = document.getElementById("password-panel-title");
const passwordPanelCopy = document.getElementById("password-panel-copy");
const passwordForm = document.getElementById("password-form");
const passwordInput = document.getElementById("password-input");
const passwordConfirmInput = document.getElementById("password-confirm-input");
const passwordFormMessage = document.getElementById("password-form-message");
const passwordSubmitButton = document.getElementById("password-submit-btn");
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
  if (normalizeIdentityCallbackLocation()) {
    return;
  }
  wireActions();
  state.identityCallback = getIdentityCallback();
  if (state.identityCallback) {
    showIdentityPasswordFlow(state.identityCallback);
    return;
  }
  wireIdentity();
}

function wireIdentity() {
  if (state.identityWired) {
    return;
  }
  if (!window.netlifyIdentity) {
    setStatus("Netlify Identity non disponible");
    return;
  }
  state.identityWired = true;

  window.netlifyIdentity.on("init", async (user) => {
    state.user = user;
    if (!user) {
      showAuth();
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

  window.netlifyIdentity.on("error", (error) => {
    const message = String(error?.message || "Erreur Netlify Identity");
    setResult(message, true);
  });

  window.netlifyIdentity.init();
}

function wireActions() {
  document.getElementById("login-btn")?.addEventListener("click", () => {
    window.netlifyIdentity?.open("login");
  });
  passwordForm?.addEventListener("submit", submitIdentityPasswordForm);

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
  const item = state.submissions.find((entry) => entry.reference === state.selectedSubmissionReference);

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
    const contentType = response.headers.get("Content-Type") || response.headers.get("content-type") || "";
    if (!response.ok) {
      const payload = await readJsonSafe(response);
      throw new Error(payload.error || `Export impossible (${response.status})`);
    }
    if (contentType.includes("application/json")) {
      const payload = await readJsonSafe(response);
      if (!payload.downloadUrl) {
        throw new Error("Lien de téléchargement manquant.");
      }
      triggerBrowserDownload(payload.downloadUrl, payload.filename || `${buildSubmissionArchiveName(item)}.zip`);
      return;
    }

    const blob = await response.blob();
    triggerBlobDownload(blob, getDownloadFilename(response, `${buildSubmissionArchiveName(item)}.zip`));
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
    const contentType = response.headers.get("Content-Type") || response.headers.get("content-type") || "";
    if (!response.ok) {
      const payload = await readJsonSafe(response);
      throw new Error(payload.error || `Export impossible (${response.status})`);
    }
    if (contentType.includes("application/json")) {
      const payload = await readJsonSafe(response);
      if (!payload.downloadUrl) {
        throw new Error("Lien de téléchargement manquant.");
      }
      triggerBrowserDownload(payload.downloadUrl, payload.filename || "digital-inpulse-candidatures.zip");
      return;
    }

    const blob = await response.blob();
    triggerBlobDownload(blob, getDownloadFilename(response, "digital-inpulse-candidatures.zip"));
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

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload(url, filename, true);
}

function triggerBrowserDownload(url, filename, revokeObjectUrl = false) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    if (revokeObjectUrl) {
      URL.revokeObjectURL(url);
    }
  }, 1000);
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
  authLoginPanel?.classList.remove("hidden");
  authPasswordPanel?.classList.add("hidden");
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

function getIdentityCallback() {
  const params = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.search.slice(1));
  const inviteToken = params.get("invite_token");
  if (inviteToken) {
    return { type: "invite", token: inviteToken };
  }
  const recoveryToken = params.get("recovery_token");
  if (recoveryToken) {
    return { type: "recovery", token: recoveryToken };
  }
  const confirmationToken = params.get("confirmation_token");
  if (confirmationToken) {
    return { type: "confirmation", token: confirmationToken };
  }
  const emailChangeToken = params.get("email_change_token");
  if (emailChangeToken) {
    return { type: "email_change", token: emailChangeToken };
  }
  return null;
}

function normalizeIdentityCallbackLocation() {
  const pattern = /(invite_token|recovery_token|confirmation_token|email_change_token)=/;
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  if (!pattern.test(search)) {
    return false;
  }
  if (pattern.test(hash)) {
    return false;
  }
  const nextHash = search.startsWith("?") ? `#${search.slice(1)}` : `#${search}`;
  window.location.replace(`${window.location.pathname}${nextHash}`);
  return true;
}

function showIdentityPasswordFlow(callback) {
  showAuth();
  authLoginPanel?.classList.add("hidden");
  authPasswordPanel?.classList.remove("hidden");
  if (callback.type === "invite") {
    passwordPanelTitle.textContent = "Créer votre mot de passe";
    passwordPanelCopy.textContent = "Définissez un mot de passe pour activer votre accès à l'espace admin.";
  } else if (callback.type === "recovery") {
    passwordPanelTitle.textContent = "Réinitialiser votre mot de passe";
    passwordPanelCopy.textContent = "Choisissez un nouveau mot de passe pour retrouver l'accès à l'espace admin.";
  } else {
    passwordPanelTitle.textContent = "Finaliser votre accès";
    passwordPanelCopy.textContent = "Validez un mot de passe pour finaliser votre accès à l'espace admin.";
  }
  setPasswordFormMessage("");
}

async function submitIdentityPasswordForm(event) {
  event.preventDefault();
  if (!state.identityCallback?.token) {
    setPasswordFormMessage("Lien de sécurité introuvable. Demandez un nouvel e-mail.", true);
    return;
  }

  const password = String(passwordInput?.value || "");
  const confirmation = String(passwordConfirmInput?.value || "");
  if (password.length < 8) {
    setPasswordFormMessage("Votre mot de passe doit contenir au moins 8 caractères.", true);
    return;
  }
  if (password !== confirmation) {
    setPasswordFormMessage("Les deux mots de passe ne correspondent pas.", true);
    return;
  }

  setPasswordFormBusy(true);
  setPasswordFormMessage("Validation en cours...");

  try {
    if (state.identityCallback.type === "invite" || state.identityCallback.type === "confirmation") {
      await acceptIdentityInvite(state.identityCallback.token, password);
    } else if (state.identityCallback.type === "recovery" || state.identityCallback.type === "email_change") {
      const session = await verifyIdentityRecovery(state.identityCallback.token);
      await updateIdentityPassword(session.access_token, password);
    } else {
      throw new Error("Type de lien non pris en charge.");
    }

    clearIdentityCallbackFromLocation();
    state.identityCallback = null;
    setPasswordFormMessage("Mot de passe enregistré. Vous pouvez maintenant vous connecter.");
    passwordForm?.reset();
    authPasswordPanel?.classList.add("hidden");
    authLoginPanel?.classList.remove("hidden");
    wireIdentity();
    window.netlifyIdentity?.init();
  } catch (error) {
    setPasswordFormMessage(normalizeIdentityError(error), true);
  } finally {
    setPasswordFormBusy(false);
  }
}

async function acceptIdentityInvite(token, password) {
  const response = await fetch("/.netlify/identity/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      password,
      type: "signup",
    }),
  });
  const payload = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error || `Invitation invalide (${response.status})`);
  }
  return payload;
}

async function verifyIdentityRecovery(token) {
  const response = await fetch("/.netlify/identity/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      type: "recovery",
    }),
  });
  const payload = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error || `Lien de réinitialisation invalide (${response.status})`);
  }
  if (!payload.access_token) {
    throw new Error("Session de réinitialisation introuvable.");
  }
  return payload;
}

async function updateIdentityPassword(accessToken, password) {
  const response = await fetch("/.netlify/identity/user", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      password,
    }),
  });
  const payload = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.msg || payload.error || `Impossible d'enregistrer le mot de passe (${response.status})`);
  }
  return payload;
}

function clearIdentityCallbackFromLocation() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function setPasswordFormMessage(text, isError = false) {
  if (!passwordFormMessage) {
    return;
  }
  if (!text) {
    passwordFormMessage.textContent = "";
    passwordFormMessage.classList.add("hidden");
    passwordFormMessage.classList.remove("error");
    return;
  }
  passwordFormMessage.textContent = text;
  passwordFormMessage.classList.remove("hidden");
  passwordFormMessage.classList.toggle("error", isError);
}

function setPasswordFormBusy(isBusy) {
  if (passwordSubmitButton) {
    passwordSubmitButton.disabled = isBusy;
    passwordSubmitButton.textContent = isBusy ? "Validation..." : "Valider";
  }
  if (passwordInput) {
    passwordInput.disabled = isBusy;
  }
  if (passwordConfirmInput) {
    passwordConfirmInput.disabled = isBusy;
  }
}

function normalizeIdentityError(error) {
  const message = String(error?.message || "Erreur Netlify Identity");
  if (message.toLowerCase().includes("invalid token")) {
    return "Ce lien n'est plus valide. Demandez un nouvel e-mail d'invitation ou de réinitialisation.";
  }
  if (message.toLowerCase().includes("password")) {
    return message;
  }
  return message;
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
