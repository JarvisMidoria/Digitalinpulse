const API_BASE = "https://api.github.com";

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN environment variable");
  }
  const repo = process.env.GITHUB_REPO || "JarvisMidoria/Digitalinpulse";
  const branch = process.env.GITHUB_BRANCH || "main";
  const contentPath = process.env.GITHUB_CONTENT_PATH || "public/content/site.json";
  const mediaDir = process.env.GITHUB_MEDIA_DIR || "public/uploads";
  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return { token, repo, branch, contentPath, mediaDir, allowedEmails };
}

async function requestGitHub(config, path, method = "GET", body = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "User-Agent": "digitalinpulse-admin",
      Accept: "application/vnd.github+json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`GitHub API ${response.status}: ${errorPayload}`);
  }

  return response.json();
}

async function getUserFromEvent(event, context) {
  const directUser = event?.clientContext?.user || context?.clientContext?.user;
  if (directUser) {
    return directUser;
  }

  const rawNetlifyContext =
    context?.clientContext?.custom?.netlify ||
    event?.clientContext?.custom?.netlify;
  if (!rawNetlifyContext) {
    return null;
  }

  try {
    const decoded = Buffer.from(String(rawNetlifyContext), "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (parsed?.user) {
      return parsed.user;
    }
  } catch (_error) {
    // Fall through to Authorization header lookup.
  }

  const authorization = readHeader(event, "authorization");
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const siteOrigin = getSiteOrigin(event);
  if (!siteOrigin) {
    return null;
  }

  try {
    const response = await fetch(`${siteOrigin}/.netlify/identity/user`, {
      headers: {
        Authorization: authorization,
      },
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : null;
  } catch (_error) {
    return null;
  }
}

function getSiteOrigin(event) {
  const proto = readHeader(event, "x-forwarded-proto") || "https";
  const host =
    readHeader(event, "x-forwarded-host") ||
    readHeader(event, "host") ||
    "";
  if (!host) {
    return "";
  }
  return `${proto}://${host}`;
}

function readHeader(event, name) {
  const headers = event?.headers || {};
  const target = String(name || "").toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return String(headers[key] || "");
    }
  }
  return "";
}

function ensureAuthorizedEmail(config, user) {
  if (!user?.email) {
    throw createHttpError(401, "Missing authenticated user email");
  }
  if (!config.allowedEmails.length) {
    return;
  }
  const userEmail = String(user.email).toLowerCase();
  if (!config.allowedEmails.includes(userEmail)) {
    throw createHttpError(403, "User email is not authorized");
  }
}

function normalizeFileName(name) {
  return String(name || "media-file")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  getConfig,
  requestGitHub,
  getUserFromEvent,
  ensureAuthorizedEmail,
  normalizeFileName,
  response,
  createHttpError,
};
