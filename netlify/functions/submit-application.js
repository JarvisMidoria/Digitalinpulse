const { getConfig, requestGitHub, normalizeFileName, response, createHttpError } = require("./_github");

const ALLOWED_PROGRAMS = new Set(["tech_for_competitivity", "women_for_innovation"]);
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 6;
const MAX_FIELDS = 120;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const config = getSubmissionConfig();
    ensureAllowedOrigin(config, event);

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (_error) {
      throw createHttpError(400, "Invalid JSON payload");
    }

    const normalized = normalizeSubmission(payload, config);
    const timestamp = new Date();
    const createdAt = timestamp.toISOString();
    const reference = buildReference(normalized.program, timestamp);
    const basePath = `${config.dataDir}/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${reference}`;

    const storedFiles = [];
    for (const [index, file] of normalized.files.entries()) {
      const extension = getPreferredExtension(file);
      const baseName = normalizeFileName(file.filename || `file-${index + 1}`).replace(/\.[^.]+$/, "");
      const fileName = `${String(index + 1).padStart(2, "0")}-${baseName || `file-${index + 1}`}.${extension}`;
      const filePath = `${basePath}/files/${fileName}`;
      await writeGitHubFile(config, filePath, file.binary, `[FORM] ${reference} file ${index + 1}`);
      storedFiles.push({
        fieldName: file.fieldName,
        filename: file.filename,
        contentType: file.contentType,
        size: file.binary.length,
        path: filePath,
      });
    }

    const record = {
      reference,
      createdAt,
      program: normalized.program,
      fields: normalized.fields,
      files: storedFiles,
      metadata: {
        submittedAt: normalized.submittedAt || createdAt,
        origin: readHeader(event, "origin"),
        referer: readHeader(event, "referer"),
        userAgent: normalized.userAgent || null,
      },
    };
    const recordBody = `${JSON.stringify(record, null, 2)}\n`;
    await writeGitHubFile(config, `${basePath}/submission.json`, Buffer.from(recordBody, "utf-8"), `[FORM] ${reference} submission`);

    return response(200, {
      ok: true,
      reference,
      storedFiles: storedFiles.length,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

function getSubmissionConfig() {
  const base = getConfig();
  const maxFileSize = Number(process.env.SUBMISSIONS_MAX_FILE_SIZE || DEFAULT_MAX_FILE_SIZE);
  const allowedOrigins = (process.env.SUBMISSIONS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/\/+$/, ""))
    .filter(Boolean);
  const dataDir = String(process.env.SUBMISSIONS_DATA_DIR || "submissions")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
    .replace(/\/{2,}/g, "/");

  return {
    token: process.env.SUBMISSIONS_GITHUB_TOKEN || base.token,
    repo: process.env.SUBMISSIONS_GITHUB_REPO || base.repo,
    branch: process.env.SUBMISSIONS_GITHUB_BRANCH || base.branch,
    dataDir: dataDir || "submissions",
    maxFileSize: Number.isFinite(maxFileSize) && maxFileSize > 0 ? maxFileSize : DEFAULT_MAX_FILE_SIZE,
    allowedOrigins,
    committerName: process.env.SUBMISSIONS_COMMITTER_NAME || "Digital InPulse Bot",
    committerEmail: process.env.SUBMISSIONS_COMMITTER_EMAIL || "noreply@digitalinpulse.local",
  };
}

function ensureAllowedOrigin(config, event) {
  if (!config.allowedOrigins.length) {
    return;
  }
  const origin = String(readHeader(event, "origin") || "")
    .toLowerCase()
    .replace(/\/+$/, "");
  const referer = String(readHeader(event, "referer") || "").toLowerCase();
  const hasAllowedOrigin = origin && config.allowedOrigins.includes(origin);
  const hasAllowedReferer = referer && config.allowedOrigins.some((allowed) => referer.startsWith(`${allowed}/`));
  if (!hasAllowedOrigin && !hasAllowedReferer) {
    throw createHttpError(403, "Origin is not allowed");
  }
}

function normalizeSubmission(payload, config) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Invalid payload");
  }
  if (String(payload.honeypot || "").trim()) {
    throw createHttpError(400, "Spam protection triggered");
  }

  const rawProgram = payload.program || payload.fields?.program;
  const program = String(rawProgram || "")
    .trim()
    .toLowerCase();
  if (!ALLOWED_PROGRAMS.has(program)) {
    throw createHttpError(400, "Unknown program");
  }

  const fields = normalizeFields(payload.fields || {});
  const emailValue = Array.isArray(fields.email) ? fields.email[0] : fields.email;
  if (!emailValue || !String(emailValue).includes("@")) {
    throw createHttpError(400, "Email is required");
  }

  const files = normalizeFiles(payload.files, config.maxFileSize);
  const fileFields = new Set(files.map((file) => file.fieldName));
  if (!fileFields.has("kbis") || !fileFields.has("deck")) {
    throw createHttpError(400, "Missing required files (kbis, deck)");
  }

  return {
    program,
    fields,
    files,
    userAgent: trimText(payload.userAgent, 512),
    submittedAt: trimText(payload.submittedAt, 64),
  };
}

function normalizeFields(rawFields) {
  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
    throw createHttpError(400, "Invalid fields payload");
  }

  const entries = Object.entries(rawFields);
  if (entries.length > MAX_FIELDS) {
    throw createHttpError(400, "Too many fields");
  }

  const normalized = {};
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    if (!key) {
      continue;
    }
    normalized[key] = normalizeFieldValue(rawValue);
  }
  return normalized;
}

function normalizeFieldValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.slice(0, 25).map((item) => normalizeScalar(item));
  }
  return normalizeScalar(rawValue);
}

function normalizeScalar(rawValue) {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (rawValue == null) {
    return "";
  }
  const text = String(rawValue).trim();
  if (text.toLowerCase() === "on") {
    return true;
  }
  return trimText(text, 4000);
}

function normalizeFiles(rawFiles, maxFileSize) {
  if (!Array.isArray(rawFiles)) {
    return [];
  }
  if (rawFiles.length > MAX_FILES) {
    throw createHttpError(400, "Too many files");
  }

  const normalized = [];
  for (const file of rawFiles) {
    if (!file || typeof file !== "object") {
      throw createHttpError(400, "Invalid file payload");
    }
    const filename = normalizeFileName(file.filename || "file");
    const fieldName = String(file.fieldName || "file")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    const contentType = String(file.contentType || "").toLowerCase().trim();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw createHttpError(400, `Unsupported file type: ${contentType || "unknown"}`);
    }

    const base64 = String(file.base64 || "");
    const binary = Buffer.from(base64, "base64");
    if (!binary.length) {
      throw createHttpError(400, `Invalid file payload for ${filename}`);
    }
    if (binary.length > maxFileSize) {
      throw createHttpError(400, `File too large: ${filename}`);
    }

    normalized.push({
      fieldName,
      filename,
      contentType,
      binary,
    });
  }
  return normalized;
}

async function writeGitHubFile(config, path, binary, message) {
  const filePath = `/repos/${config.repo}/contents/${path}`;
  await requestGitHub(config, filePath, "PUT", {
    message,
    content: binary.toString("base64"),
    branch: config.branch,
    committer: {
      name: config.committerName,
      email: config.committerEmail,
    },
  });
}

function buildReference(program, date) {
  const shortProgram = program === "women_for_innovation" ? "WFI" : "TFC";
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DIP-${shortProgram}-${day}-${random}`;
}

function getPreferredExtension(file) {
  const fromName = String(file.filename || "")
    .split(".")
    .pop()
    .toLowerCase();
  if (fromName && fromName !== file.filename) {
    return fromName;
  }
  const map = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
  };
  return map[file.contentType] || "bin";
}

function readHeader(event, name) {
  const headers = event?.headers || {};
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key];
    }
  }
  return "";
}

function trimText(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}
