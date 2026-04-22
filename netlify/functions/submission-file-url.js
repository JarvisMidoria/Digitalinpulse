const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig } = require("./_submissions");
const { getSupabaseConfig, createSignedUrl } = require("./_supabase");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const config = getSubmissionConfig();
    const supabase = getSupabaseConfig();
    const user = await getUserFromEvent(event, context);
    if (!user) {
      return response(401, { error: "Authentication required" });
    }
    ensureAuthorizedEmail(config, user);

    const rawPath = String(event.queryStringParameters?.path || "").trim();
    if (!rawPath.startsWith(`${config.dataDir}/`)) {
      return response(400, { error: "Invalid path" });
    }

    const url = await createSignedUrl(supabase, rawPath, 900);
    return response(200, { ok: true, url });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};
