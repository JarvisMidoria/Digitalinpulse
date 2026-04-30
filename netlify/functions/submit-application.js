const { normalizeFileName, response, createHttpError } = require("./_github");
const { getSubmissionConfig, ensureAllowedOrigin, readHeader } = require("./_submissions");
const { getSupabaseConfig, uploadObject, putJson, listObjects } = require("./_supabase");
const { sendSubmissionSuccessEmail, sendSubmissionFailureEmail } = require("./_submission-alerts");

const ALLOWED_PROGRAMS = new Set(["smart_mobility"]);

const MAX_FILES = 6;
const MAX_FIELDS = 120;
const RATE_LIMIT_WINDOW_SECONDS = 60;

exports.handler = async (event) => {
  let config = null;
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    config = getSubmissionConfig();
    const supabase = getSupabaseConfig();
    ensureAllowedOrigin(config, event);

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (_error) {
      throw createHttpError(400, "Invalid JSON payload");
    }

    const normalized = normalizeSubmission(payload, config);
    const timestamp = normalized.createdAt ? new Date(normalized.createdAt) : new Date();
    if (Number.isNaN(timestamp.getTime())) {
      throw createHttpError(400, "Invalid submission timestamp");
    }
    const createdAt = timestamp.toISOString();
    await enforceRateLimit(supabase, event, normalized, timestamp);
    const reference = normalized.reference || buildReference(normalized.program, timestamp);
    const basePath = `${config.dataDir}/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${reference}`;

    const storedFiles = await materializeSubmissionFiles(supabase, normalized, basePath);

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
    await putJson(supabase, `${basePath}/submission.json`, record);

    const notificationWarnings = await notifyIntegrations(config, record);

    return response(200, {
      ok: true,
      reference,
      storedFiles: storedFiles.length,
      warnings: notificationWarnings,
    });
  } catch (error) {
    await notifyFailureSafely(config, event, error, "submit-application");
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

function normalizeSubmission(payload, config) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Invalid payload");
  }
  if (String(payload.honeypot || "").trim()) {
    throw createHttpError(400, "Spam protection triggered");
  }

  const rawProgram = payload.program || payload.fields?.program;
  let program = String(rawProgram || "")
    .trim()
    .toLowerCase();
  if (program === "tech_for_competitivity") {
    program = "smart_mobility";
  }
  if (!ALLOWED_PROGRAMS.has(program)) {
    throw createHttpError(400, "Unknown program");
  }

  const fields = normalizeFields(payload.fields || {});
  const emailValue = Array.isArray(fields.email) ? fields.email[0] : fields.email;
  if (!emailValue || !String(emailValue).includes("@")) {
    throw createHttpError(400, "Email is required");
  }

  const files = normalizeFiles(payload.files, config.maxFileSize);
  const uploadedFiles = normalizeUploadedFiles(payload.uploadedFiles, config.maxFileSize);
  const fileFields = new Set((uploadedFiles.length ? uploadedFiles : files).map((file) => file.fieldName));
  if (!fileFields.has("kbis") || !fileFields.has("deck")) {
    throw createHttpError(400, "Missing required files (kbis, deck)");
  }

  return {
    program,
    fields,
    files,
    uploadedFiles,
    reference: trimText(payload.reference, 64),
    createdAt: trimText(payload.createdAt, 64),
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
    const contentType = String(file.contentType || "application/octet-stream").toLowerCase().trim();

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

function normalizeUploadedFiles(rawFiles, maxFileSize) {
  if (!Array.isArray(rawFiles)) {
    return [];
  }
  if (rawFiles.length > MAX_FILES) {
    throw createHttpError(400, "Too many files");
  }

  const normalized = [];
  for (const file of rawFiles) {
    if (!file || typeof file !== "object") {
      throw createHttpError(400, "Invalid uploaded file payload");
    }
    const filename = normalizeFileName(file.filename || "file");
    const fieldName = String(file.fieldName || "file")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    const contentType = String(file.contentType || "application/octet-stream").toLowerCase().trim();
    const size = Number(file.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw createHttpError(400, `Invalid file payload for ${filename}`);
    }
    if (size > maxFileSize) {
      throw createHttpError(400, `File too large: ${filename}`);
    }
    const path = String(file.path || "").replace(/^\/+/, "");
    if (!path) {
      throw createHttpError(400, `Missing file path for ${filename}`);
    }
    normalized.push({
      fieldName,
      filename,
      contentType,
      size,
      path,
    });
  }
  return normalized;
}

async function materializeSubmissionFiles(supabase, normalized, basePath) {
  if (normalized.uploadedFiles.length) {
    await verifyUploadedFiles(supabase, normalized.uploadedFiles, basePath);
    return normalized.uploadedFiles.map((file) => ({
      fieldName: file.fieldName,
      filename: file.filename,
      contentType: file.contentType,
      size: file.size,
      path: file.path,
    }));
  }

  const storedFiles = [];
  for (const [index, file] of normalized.files.entries()) {
    const extension = getPreferredExtension(file);
    const baseName = normalizeFileName(file.filename || `file-${index + 1}`).replace(/\.[^.]+$/, "");
    const fileName = `${String(index + 1).padStart(2, "0")}-${baseName || `file-${index + 1}`}.${extension}`;
    const filePath = `${basePath}/files/${fileName}`;
    await uploadObject(supabase, filePath, file.binary, file.contentType);
    storedFiles.push({
      fieldName: file.fieldName,
      filename: file.filename,
      contentType: file.contentType,
      size: file.binary.length,
      path: filePath,
    });
  }
  return storedFiles;
}

async function verifyUploadedFiles(supabase, uploadedFiles, basePath) {
  const expectedPrefix = `${basePath}/files/`;
  const entries = await listObjects(supabase, expectedPrefix, 200, 0);
  const byPath = new Map();

  for (const entry of entries) {
    if (!entry?.name || entry.id === null) {
      continue;
    }
    byPath.set(`${expectedPrefix}${entry.name}`, entry);
  }

  for (const file of uploadedFiles) {
    if (!String(file.path || "").startsWith(expectedPrefix)) {
      throw createHttpError(400, `Unexpected upload path for ${file.filename}`);
    }
    const entry = byPath.get(file.path);
    if (!entry) {
      throw createHttpError(400, `Uploaded file is missing: ${file.filename}`);
    }
  }
}

async function notifyIntegrations(config, record) {
  const warnings = [];

  const jobs = [
    sendSubmissionSuccessEmail(config, record),
    sendCrmWebhook(config, record),
  ];
  const results = await Promise.allSettled(jobs);

  for (const result of results) {
    if (result.status === "rejected") {
      warnings.push(result.reason?.message || "Notification failed");
    }
  }

  return warnings;
}

async function enforceRateLimit(supabase, event, normalized, timestamp) {
  const ip = extractClientIp(event);
  const email = String(Array.isArray(normalized.fields.email) ? normalized.fields.email[0] : normalized.fields.email || "").toLowerCase();
  const slot = Math.floor(timestamp.getTime() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  const key = hashRateLimitKey(`${ip}::${email}::${slot}`);
  const objectPath = `rate-limit/${normalized.program}/${key}.json`;

  const responseRateLimit = await fetch(`${supabase.url}/storage/v1/object/${supabase.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabase.serviceKey}`,
      apikey: supabase.serviceKey,
      "Content-Type": "application/json",
      "x-upsert": "false",
    },
    body: JSON.stringify({
      createdAt: timestamp.toISOString(),
      ip,
      email,
    }),
  });

  if (!responseRateLimit.ok) {
    const text = await responseRateLimit.text();
    if (responseRateLimit.status === 409 || text.includes("\"Duplicate\"") || text.includes("already exists")) {
      throw createHttpError(429, "Trop de tentatives. Merci de patienter une minute avant de renvoyer votre candidature.");
    }
    throw new Error(`Rate limit storage failed: ${responseRateLimit.status} ${text}`);
  }
}

function extractClientIp(event) {
  const forwarded = String(readHeader(event, "x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  const netlifyIp = String(readHeader(event, "client-ip") || readHeader(event, "x-nf-client-connection-ip") || "").trim();
  return forwarded || netlifyIp || "unknown";
}

function hashRateLimitKey(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function sendCrmWebhook(config, record) {
  if (!config.crmWebhookUrl) {
    return;
  }

  const responseCrm = await fetch(config.crmWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.crmWebhookSecret ? { "X-Webhook-Secret": config.crmWebhookSecret } : {}),
    },
    body: JSON.stringify({
      source: "digital-inpulse",
      event: "application_submitted",
      submittedAt: record.createdAt,
      reference: record.reference,
      program: record.program,
      fields: record.fields,
      files: record.files,
    }),
  });

  if (!responseCrm.ok) {
    const payload = await responseCrm.text();
    throw new Error(`CRM webhook failed: ${responseCrm.status} ${payload}`);
  }
}

function buildReference(program, date) {
  const shortProgram = program === "smart_mobility" ? "SM" : "DIP";
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
    "image/heic": "heic",
    "image/heif": "heif",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
  };
  return map[file.contentType] || "bin";
}

function toSingleValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function trimText(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

async function notifyFailureSafely(config, event, error, stage) {
  if (!config) {
    return;
  }
  try {
    const payload = parseEventBody(event);
    await sendSubmissionFailureEmail(config, {
      stage,
      error: error?.message || "Erreur inconnue",
      program: payload.program || payload.fields?.program || "",
      email: toSingleValue(payload.fields?.email),
      company: toSingleValue(payload.fields?.company),
      reference: trimText(payload.reference, 64),
      origin: readHeader(event, "origin"),
      referer: readHeader(event, "referer"),
      ip: extractClientIp(event),
      userAgent: trimText(payload.userAgent || readHeader(event, "user-agent"), 512),
      files: collectFileDetails(payload),
    });
  } catch (_notifyError) {
    // Swallow notification errors to preserve the original response.
  }
}

function parseEventBody(event) {
  try {
    return JSON.parse(event?.body || "{}");
  } catch (_error) {
    return {};
  }
}

function collectFileDetails(payload) {
  const candidates = Array.isArray(payload?.uploadedFiles) && payload.uploadedFiles.length
    ? payload.uploadedFiles
    : Array.isArray(payload?.files)
      ? payload.files
      : [];
  return candidates.slice(0, 10).map((file) => ({
    fieldName: String(file?.fieldName || ""),
    filename: String(file?.filename || ""),
    size: Number(file?.size || 0),
  }));
}
