const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig, listSubmissionRecords } = require("./_submissions");

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
    const items = await listSubmissionRecords(config, { limit, program });

    return response(200, {
      ok: true,
      count: items.length,
      items,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};
