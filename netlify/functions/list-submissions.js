const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig, listSubmissionRecords } = require("./_submissions");
const { getSupabaseConfig, listObjects, getObject } = require("./_supabase");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const config = getSubmissionConfig();
    const user = await getUserFromEvent(event, context);
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
      const submissions = await collectSubmissionPaths(supabase, prefix, limit);
      const parsed = [];
      for (const name of submissions) {
        const raw = await getObject(supabase, name);
        const record = normalizeSubmissionRecord(JSON.parse(raw), name);
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

async function collectSubmissionPaths(supabase, prefix, limit) {
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
      if (entry.name === "submission.json") {
        results.push(nextPath);
      }
      if (results.length >= limit) {
        break;
      }
    }
  }

  return results.sort((a, b) => b.localeCompare(a));
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
      city: toSingleValue(fields.city),
    },
  };
}

function extractReferenceFromPath(path) {
  const parts = String(path || "").split("/");
  return parts[parts.length - 2] || "";
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
