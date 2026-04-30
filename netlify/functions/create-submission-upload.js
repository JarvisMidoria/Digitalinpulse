const { normalizeFileName, response, createHttpError } = require("./_github");
const { getSubmissionConfig, ensureAllowedOrigin } = require("./_submissions");
const { getSupabaseConfig, createSignedUpload } = require("./_supabase");
const { sendSubmissionFailureEmail } = require("./_submission-alerts");

const ALLOWED_PROGRAMS = new Set(["smart_mobility"]);

const MAX_FILES = 6;

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

    const program = normalizeProgram(payload.program);
    const files = normalizeFiles(payload.files, config.maxFileSize);
    const timestamp = new Date();
    const createdAt = timestamp.toISOString();
    const reference = buildReference(program, timestamp);
    const basePath = `${config.dataDir}/${createdAt.slice(0, 4)}/${createdAt.slice(5, 7)}/${reference}`;

    const uploads = [];
    for (const [index, file] of files.entries()) {
      const extension = getPreferredExtension(file);
      const baseName = String(file.safeFilename || normalizeFileName(file.filename || `file-${index + 1}`)).replace(/\.[^.]+$/, "");
      const fileName = `${String(index + 1).padStart(2, "0")}-${baseName || `file-${index + 1}`}.${extension}`;
      const filePath = `${basePath}/files/${fileName}`;
      const signed = await createSignedUpload(supabase, filePath, { upsert: true });
      uploads.push({
        fieldName: file.fieldName,
        filename: file.filename,
        contentType: file.contentType,
        size: file.size,
        path: filePath,
        uploadUrl: `${supabase.url}/storage/v1${String(signed.url || "")}`,
        token: String(signed.token || ""),
      });
    }

    return response(200, {
      ok: true,
      program,
      reference,
      createdAt,
      uploads,
    });
  } catch (error) {
    await notifyFailureSafely(config, event, error);
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

function normalizeProgram(rawProgram) {
  let program = String(rawProgram || "")
    .trim()
    .toLowerCase();
  if (program === "tech_for_competitivity") {
    program = "smart_mobility";
  }
  if (!ALLOWED_PROGRAMS.has(program)) {
    throw createHttpError(400, "Unknown program");
  }
  return program;
}

function normalizeFiles(rawFiles, maxFileSize) {
  if (!Array.isArray(rawFiles) || !rawFiles.length) {
    throw createHttpError(400, "No files provided");
  }
  if (rawFiles.length > MAX_FILES) {
    throw createHttpError(400, "Too many files");
  }

  const normalized = [];
  for (const file of rawFiles) {
    if (!file || typeof file !== "object") {
      throw createHttpError(400, "Invalid file payload");
    }
    const originalFilename = String(file.filename || "").trim() || "file";
    const safeFilename = normalizeFileName(originalFilename);
    const fieldName = String(file.fieldName || "file")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80);
    const contentType = String(file.contentType || "application/octet-stream").toLowerCase().trim();
    const size = Number(file.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
      throw createHttpError(400, `Invalid file payload for ${safeFilename}`);
    }
    if (size > maxFileSize) {
      throw createHttpError(400, `File too large: ${safeFilename}`);
    }
    normalized.push({
      fieldName,
      filename: originalFilename,
      safeFilename,
      contentType,
      size,
    });
  }

  const requiredFields = new Set(normalized.map((file) => file.fieldName));
  if (!requiredFields.has("kbis") || !requiredFields.has("deck")) {
    throw createHttpError(400, "Missing required files (kbis, deck)");
  }

  return normalized;
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

async function notifyFailureSafely(config, event, error) {
  if (!config) {
    return;
  }
  try {
    const payload = parseEventBody(event);
    await sendSubmissionFailureEmail(config, {
      stage: "create-submission-upload",
      error: error?.message || "Erreur inconnue",
      program: payload.program || "",
      email: "",
      company: "",
      reference: "",
      origin: readHeaderSafe(event, "origin"),
      referer: readHeaderSafe(event, "referer"),
      ip: extractClientIp(event),
      userAgent: readHeaderSafe(event, "user-agent"),
      files: Array.isArray(payload.files)
        ? payload.files.slice(0, 10).map((file) => ({
            fieldName: String(file?.fieldName || ""),
            filename: String(file?.filename || ""),
            size: Number(file?.size || 0),
          }))
        : [],
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

function readHeaderSafe(event, name) {
  const headers = event?.headers || {};
  const target = String(name || "").toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function extractClientIp(event) {
  const forwarded = readHeaderSafe(event, "x-forwarded-for")
    .split(",")[0]
    .trim();
  const netlifyIp = String(readHeaderSafe(event, "client-ip") || readHeaderSafe(event, "x-nf-client-connection-ip") || "").trim();
  return forwarded || netlifyIp || "unknown";
}
