const JSZip = require("jszip");

const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig } = require("./_submissions");
const { getSupabaseConfig, listObjects, getObject, getObjectBuffer } = require("./_supabase");

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
    const references = Array.isArray(body.references) ? body.references.map((item) => String(item || "").trim()).filter(Boolean) : [];
    if (!references.length) {
      return response(400, { error: "No submissions selected" });
    }

    const records = await collectRecordsByReference(supabase, config.dataDir, references);
    const zip = new JSZip();
    const manifestRows = [[
      "reference",
      "created_at",
      "program",
      "name",
      "email",
      "company",
      "city",
      "file_count",
    ]];

    for (const record of records) {
      const folder = zip.folder(safeFolderName(record.reference || "submission"));
      folder.file("submission.json", `${JSON.stringify(record, null, 2)}\n`);

      for (const file of record.files || []) {
        if (!file.path) {
          continue;
        }
        const fileBuffer = await getObjectBuffer(supabase, file.path);
        folder.file(file.filename || "file.bin", fileBuffer);
      }

      manifestRows.push([
        record.reference || "",
        record.createdAt || "",
        record.program || "",
        record.summary?.name || "",
        record.summary?.email || "",
        record.summary?.company || "",
        record.summary?.city || "",
        String(record.fileCount || 0),
      ]);
    }

    zip.file("manifest.csv", manifestRows.map((row) => row.map(csvEscape).join(";")).join("\n"));
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=\"digital-inpulse-candidatures-${new Date().toISOString().slice(0, 10)}.zip\"`,
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

async function collectRecordsByReference(supabase, dataDir, references) {
  const wanted = new Set(references);
  const paths = await collectSubmissionPaths(supabase, `${dataDir}/`, 1000);
  const matched = paths.filter((path) => wanted.has(extractReferenceFromPath(path)));
  const records = [];

  for (const path of matched) {
    const raw = await getObject(supabase, path);
    records.push(normalizeSubmissionRecord(JSON.parse(raw), path));
  }

  return records.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

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

  return results;
}

function normalizeSubmissionRecord(record, recordPath) {
  const fields = record?.fields && typeof record.fields === "object" ? record.fields : {};
  const files = Array.isArray(record?.files) ? record.files : [];

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
    summary: {
      name: [toSingleValue(fields.first_name), toSingleValue(fields.last_name)].filter(Boolean).join(" ").trim(),
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

function safeFolderName(value) {
  return String(value || "submission").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
