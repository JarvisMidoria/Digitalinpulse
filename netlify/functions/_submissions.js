const { getConfig, requestGitHub, createHttpError } = require("./_github");

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

function getSubmissionConfig() {
  const base = getConfig();
  const maxFileSize = Number(process.env.SUBMISSIONS_MAX_FILE_SIZE || DEFAULT_MAX_FILE_SIZE);
  const dataDir = normalizePathFragment(process.env.SUBMISSIONS_DATA_DIR || "submissions");

  return {
    token: process.env.SUBMISSIONS_GITHUB_TOKEN || base.token,
    repo: process.env.SUBMISSIONS_GITHUB_REPO || base.repo,
    branch: process.env.SUBMISSIONS_GITHUB_BRANCH || base.branch,
    dataDir: dataDir || "submissions",
    allowedEmails: base.allowedEmails,
    maxFileSize: Number.isFinite(maxFileSize) && maxFileSize > 0 ? maxFileSize : DEFAULT_MAX_FILE_SIZE,
    allowedOrigins: parseCsv(process.env.SUBMISSIONS_ALLOWED_ORIGINS || "").map((value) => value.toLowerCase().replace(/\/+$/, "")),
    notifyEmails: parseCsv(process.env.SUBMISSIONS_NOTIFY_EMAILS || ""),
    fromEmail: process.env.SUBMISSIONS_FROM_EMAIL || "Digital InPulse <noreply@digitalinpulse.local>",
    resendApiKey: process.env.RESEND_API_KEY || "",
    crmWebhookUrl: process.env.SUBMISSIONS_CRM_WEBHOOK_URL || "",
    crmWebhookSecret: process.env.SUBMISSIONS_CRM_WEBHOOK_SECRET || "",
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

async function listSubmissionRecords(config, options = {}) {
  const limit = clampNumber(options.limit, DEFAULT_LIST_LIMIT, 1, MAX_LIST_LIMIT);
  const programFilter = String(options.program || "")
    .trim()
    .toLowerCase();
  const prefix = `${config.dataDir}/`;

  const tree = await requestGitHub(
    config,
    `/repos/${config.repo}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`,
  );
  const allPaths = Array.isArray(tree.tree) ? tree.tree : [];
  const recordPaths = allPaths
    .filter((item) => item?.type === "blob" && typeof item.path === "string")
    .map((item) => item.path)
    .filter((path) => path.startsWith(prefix) && path.endsWith("/submission.json"))
    .sort((a, b) => b.localeCompare(a));

  const records = [];
  for (const path of recordPaths) {
    if (records.length >= limit) {
      break;
    }

    const parsed = await loadSubmissionRecord(config, path);
    if (!parsed) {
      continue;
    }
    if (programFilter && parsed.program !== programFilter) {
      continue;
    }
    records.push(parsed);
  }

  return records;
}

async function loadSubmissionRecord(config, path) {
  try {
    const file = await requestGitHub(
      config,
      `/repos/${config.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(config.branch)}`,
    );
    const raw = decodeGitHubContent(file.content);
    const parsed = JSON.parse(raw);
    return normalizeSubmissionRecord(parsed, path);
  } catch (_error) {
    return null;
  }
}

function normalizeSubmissionRecord(record, recordPath) {
  const fields = record?.fields && typeof record.fields === "object" ? record.fields : {};
  const files = Array.isArray(record?.files) ? record.files : [];
  const firstName = toSingleValue(fields.first_name);
  const lastName = toSingleValue(fields.last_name);

  return {
    reference: String(record?.reference || extractReferenceFromPath(recordPath) || ""),
    createdAt: String(record?.createdAt || ""),
    program: String(record?.program || ""),
    fields,
    files: files.map((file) => ({
      fieldName: String(file?.fieldName || ""),
      filename: String(file?.filename || ""),
      contentType: String(file?.contentType || ""),
      size: Number(file?.size || 0),
      path: String(file?.path || ""),
    })),
    fileCount: files.length,
    recordPath,
    summary: {
      name: [firstName, lastName].filter(Boolean).join(" ").trim(),
      email: toSingleValue(fields.email),
      company: toSingleValue(fields.company),
      region: toSingleValue(fields.region),
      city: toSingleValue(fields.city),
    },
  };
}

function decodeGitHubContent(content) {
  const normalized = String(content || "").replace(/\n/g, "");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function encodePath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function extractReferenceFromPath(path) {
  const parts = String(path || "").split("/");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 2] || "";
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePathFragment(value) {
  return String(value || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "")
    .replace(/\/{2,}/g, "/");
}

function readHeader(event, name) {
  const headers = event?.headers || {};
  const target = String(name || "").toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return headers[key];
    }
  }
  return "";
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

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

module.exports = {
  getSubmissionConfig,
  ensureAllowedOrigin,
  listSubmissionRecords,
  readHeader,
};
