const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig } = require("./_submissions");
const { getSupabaseConfig, listObjects, removeObjects } = require("./_supabase");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
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

    const body = JSON.parse(event.body || "{}");
    const reference = String(body.reference || "").trim();
    if (!reference) {
      return response(400, { error: "Missing reference" });
    }

    const submissionPrefix = await findSubmissionPrefix(supabase, `${config.dataDir}/`, reference, 1000);
    if (!submissionPrefix) {
      return response(404, { error: "Submission not found" });
    }

    const objectPaths = await collectObjectPaths(supabase, submissionPrefix, 2000);
    if (!objectPaths.length) {
      return response(404, { error: "Submission files not found" });
    }

    await removeObjects(supabase, objectPaths);

    return response(200, {
      ok: true,
      reference,
      deletedFiles: objectPaths.length,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

async function findSubmissionPrefix(supabase, prefix, reference, limit) {
  const queue = [prefix];

  while (queue.length) {
    const currentPrefix = queue.shift();
    const entries = await listObjects(supabase, currentPrefix, 200, 0);

    for (const entry of entries) {
      if (!entry?.name) {
        continue;
      }
      const nextPath = `${currentPrefix}${entry.name}`;
      if (entry.id === null) {
        if (entry.name === reference) {
          return `${nextPath}/`;
        }
        queue.push(`${nextPath}/`);
      }
    }

    if (queue.length > limit) {
      break;
    }
  }

  return "";
}

async function collectObjectPaths(supabase, prefix, limit) {
  const queue = [prefix];
  const results = [];

  while (queue.length && results.length < limit) {
    const currentPrefix = queue.shift();
    const entries = await listObjects(supabase, currentPrefix, 200, 0);

    for (const entry of entries) {
      if (!entry?.name) {
        continue;
      }
      const nextPath = `${currentPrefix}${entry.name}`;
      if (entry.id === null) {
        queue.push(`${nextPath}/`);
        continue;
      }
      results.push(nextPath);
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
}
