const {
  getConfig,
  requestGitHub,
  getUserFromEvent,
  ensureAuthorizedEmail,
  normalizeFileName,
  response,
} = require("./_github");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const config = getConfig();
    const user = getUserFromEvent(event);
    if (!user) {
      return response(401, { error: "Authentication required" });
    }
    ensureAuthorizedEmail(config, user);

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (_error) {
      return response(400, { error: "Invalid JSON payload" });
    }
    const filename = normalizeFileName(body.filename || "media");
    const contentType = String(body.contentType || "").toLowerCase();
    const base64 = String(body.base64 || "");

    if (!base64) {
      return response(400, { error: "Missing base64 payload" });
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return response(400, { error: "Unsupported media type" });
    }

    const binary = Buffer.from(base64, "base64");
    if (!binary.length) {
      return response(400, { error: "Invalid media payload" });
    }
    if (binary.length > MAX_FILE_SIZE) {
      return response(400, { error: "File too large (max 10 MB)" });
    }

    const mediaName = withUniquePrefix(filename, contentType);
    const mediaPath = `${config.mediaDir}/${mediaName}`;
    const filePath = `/repos/${config.repo}/contents/${mediaPath}`;
    const commitMessage = `[ADMIN] upload media ${mediaName} by ${user.email}`;

    const createPayload = {
      message: commitMessage,
      content: binary.toString("base64"),
      branch: config.branch,
      committer: {
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
      },
    };

    const created = await requestGitHub(config, filePath, "PUT", createPayload);
    const publicUrl = `/${mediaPath.replace(/^public\//, "")}`;

    return response(200, {
      ok: true,
      url: publicUrl,
      commitSha: created.commit?.sha || null,
      commitUrl: created.commit?.html_url || null,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

function withUniquePrefix(filename, contentType) {
  const extension = getExtension(filename, contentType);
  const stem = filename.replace(/\.[^.]+$/, "") || "media";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomChunk = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${randomChunk}-${stem}.${extension}`;
}

function getExtension(filename, contentType) {
  const fromName = filename.split(".").pop() || "";
  if (fromName && fromName !== filename) {
    return fromName.toLowerCase();
  }
  const map = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  return map[contentType] || "bin";
}
