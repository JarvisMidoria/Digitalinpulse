const {
  getConfig,
  requestGitHub,
  getUserFromEvent,
  ensureAuthorizedEmail,
  response,
} = require("./_github");

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
    const content = body.content;
    if (!content || typeof content !== "object") {
      return response(400, { error: "Invalid content payload" });
    }

    const prettyJson = `${JSON.stringify(content, null, 2)}\n`;
    if (prettyJson.length > 2_000_000) {
      return response(400, { error: "Content payload too large" });
    }

    const encoded = Buffer.from(prettyJson, "utf-8").toString("base64");
    const filePath = `/repos/${config.repo}/contents/${config.contentPath}`;
    const existing = await requestGitHub(config, `${filePath}?ref=${config.branch}`);

    const commitMessage = `[ADMIN] update site content by ${user.email}`;
    const updatePayload = {
      message: commitMessage,
      content: encoded,
      sha: existing.sha,
      branch: config.branch,
      committer: {
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
      },
    };

    const updated = await requestGitHub(config, filePath, "PUT", updatePayload);

    return response(200, {
      ok: true,
      commitUrl: updated.commit?.html_url || null,
      commitSha: updated.commit?.sha || null,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};
