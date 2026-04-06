const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig, listSubmissionRecords } = require("./_submissions");
const { getSupabaseConfig, listObjects, getObject } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const config = getSubmissionConfig();
    const user = getUserFromEvent(event);
    if (!user) {
      return response(401, { error: "Authentication required" });
    }
    ensureAuthorizedEmail(config, user);

    const query = event.queryStringParameters || {};
    const limit = Number(query.limit || 120);
    const program = String(query.program || "").trim().toLowerCase();
    let items = [];
    try {
      const supabase = getSupabaseConfig();
      const prefix = `${config.dataDir}/`;
      const objects = await listObjects(supabase, prefix, limit, 0);
      const submissions = objects
        .map((item) => item.name)
        .filter((name) => name && name.endsWith("/submission.json"))
        .slice(0, limit);
      const parsed = [];
      for (const name of submissions) {
        const raw = await getObject(supabase, name);
        const record = JSON.parse(raw);
        if (program && String(record.program || "").toLowerCase() !== program) {
          continue;
        }
        parsed.push(record);
      }
      items = parsed;
    } catch (_error) {
      items = await listSubmissionRecords(config, { limit, program });
    }

    return response(200, {
      ok: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};
