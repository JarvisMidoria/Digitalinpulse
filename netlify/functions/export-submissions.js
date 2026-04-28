const JSZip = require("jszip");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const FIELD_LABELS = {
  last_name: "Nom",
  first_name: "Prénom",
  email: "E-mail",
  phone: "Téléphone portable",
  company: "Nom de l'entreprise",
  address: "Adresse",
  postal_code: "Code postal",
  city: "Ville",
  website: "Site web",
  founded_at: "Date de création",
  sector: "Secteur d'activité",
  stage: "Stade d'évolution",
  revenue_2025: "Chiffre d'affaires 2025",
  revenue_2026: "Chiffre d'affaires prévisionnel 2026",
  employees: "Nombre de salariés",
  pitch_english: "Pitch en anglais",
  video_url: "Lien vidéo",
  summary: "Présentation de l'entreprise et du projet",
  impact_statement: "Réponse aux enjeux du concours",
  tech_stack: "Technologies utilisées",
  source: "Comment avez-vous connu le concours ?",
  conflict: "Conflit d'intérêts avec Huawei France",
  kbis: "Kbis",
  deck: "Présentation entreprise/projet",
  region: "Région",
};

const { getUserFromEvent, ensureAuthorizedEmail, response } = require("./_github");
const { getSubmissionConfig } = require("./_submissions");
const { getSupabaseConfig, listObjects, getObject, getObjectBuffer, uploadObject, createSignedUrl } = require("./_supabase");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
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

    const references = getRequestedReferences(event);
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
      const folder = zip.folder(buildSubmissionBundleName(record));
      const pdfBuffer = await renderSubmissionPdf(record);
      folder.file("dossier-candidature.pdf", pdfBuffer);

      for (const file of record.files || []) {
        if (!file.path) {
          continue;
        }
        const fileBuffer = await getObjectBuffer(supabase, file.path);
        folder.file(`pieces-jointes/${file.filename || "file.bin"}`, fileBuffer);
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

    const filename = buildArchiveName(records);
    const exportPath = buildExportPath(filename);
    await uploadObject(supabase, exportPath, buffer, "application/zip");
    const downloadUrl = await createSignedUrl(supabase, exportPath, 900);

    return response(200, {
      ok: true,
      filename,
      downloadUrl,
    });
  } catch (error) {
    return response(Number(error.statusCode) || 500, { error: error.message });
  }
};

function getRequestedReferences(event) {
  if (event.httpMethod === "GET") {
    const raw = String(event.queryStringParameters?.reference || "");
    return raw
      .split(",")
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const body = JSON.parse(event.body || "{}");
  return Array.isArray(body.references) ? body.references.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

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

function buildArchiveName(records) {
  if (records.length === 1 && records[0]?.reference) {
    return `${buildSubmissionBundleName(records[0])}.zip`;
  }
  return `digital-inpulse-candidatures-${new Date().toISOString().slice(0, 10)}.zip`;
}

function buildSubmissionBundleName(record) {
  const company = safeFolderName(record?.summary?.company || "Entreprise");
  const reference = safeFolderName(record?.reference || "submission");
  return `${company} (${reference})`;
}

function buildExportPath(filename) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `exports/${stamp}-${safeFolderName(filename)}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function renderSubmissionPdf(record) {
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 595, height: 842 };
  const margin = 34;
  const lineGap = 3;
  const bodySize = 9;
  const smallSize = 9;
  const titleSize = 22;
  const sectionTitleSize = 12;
  const colors = {
    ink: rgb(0.1, 0.17, 0.25),
    muted: rgb(0.35, 0.42, 0.5),
    accent: rgb(0.06, 0.36, 0.75),
    accentSoft: rgb(0.91, 0.95, 1),
    line: rgb(0.84, 0.88, 0.93),
    white: rgb(1, 1, 1),
  };

  let page = pdf.addPage([pageSize.width, pageSize.height]);
  let cursorY = pageSize.height - margin;
  let currentColumn = 0;
  const columnGap = 14;
  const columnWidth = (pageSize.width - margin * 2 - columnGap) / 2;

  const ensureSpace = (heightNeeded) => {
    if (cursorY - heightNeeded >= margin) {
      return;
    }
    page = pdf.addPage([pageSize.width, pageSize.height]);
    cursorY = pageSize.height - margin;
    currentColumn = 0;
    drawPageHeader();
  };

  const drawTextBlock = (text, options = {}) => {
    const {
      x = margin,
      size = bodySize,
      font = fontRegular,
      color = colors.ink,
      maxWidth = pageSize.width - margin * 2,
      after = 6,
    } = options;
    const lines = wrapText(String(text || "-"), font, size, maxWidth);
    const height = lines.length * (size + lineGap);
    ensureSpace(height + after);
    for (const line of lines) {
      page.drawText(line, { x, y: cursorY - size, size, font, color });
      cursorY -= size + lineGap;
    }
    cursorY -= after;
  };

  const resetColumns = () => {
    currentColumn = 0;
  };

  const flushColumns = (gap = 8) => {
    resetColumns();
    cursorY -= gap;
  };

  const drawSectionTitle = (label) => {
    flushColumns(4);
    ensureSpace(24);
    page.drawText(label, {
      x: margin,
      y: cursorY - sectionTitleSize,
      size: sectionTitleSize,
      font: fontBold,
      color: colors.ink,
    });
    cursorY -= sectionTitleSize + 8;
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: pageSize.width - margin, y: cursorY },
      color: colors.line,
      thickness: 1,
    });
    cursorY -= 10;
  };

  const drawFieldCard = (label, value) => {
    const x = margin + currentColumn * (columnWidth + columnGap);
    const labelLines = wrapText(label, fontBold, 9, columnWidth - 18, 2);
    const valueLines = wrapText(formatFieldValueForPdf(value), fontRegular, 9, columnWidth - 18, 8);
    const height = 14 + labelLines.length * 11 + valueLines.length * 11 + 12;
    ensureSpace(height + 8);
    const yTop = cursorY;
    page.drawRectangle({
      x,
      y: yTop - height,
      width: columnWidth,
      height,
      color: colors.white,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 10,
    });
    let textY = yTop - 16;
    for (const line of labelLines) {
      page.drawText(line, { x: x + 9, y: textY, size: 9, font: fontBold, color: colors.ink });
      textY -= 11;
    }
    for (const line of valueLines) {
      page.drawText(line, { x: x + 9, y: textY, size: 9, font: fontRegular, color: colors.muted });
      textY -= 11;
    }
    if (currentColumn === 0) {
      currentColumn = 1;
      return;
    }
    currentColumn = 0;
    cursorY -= height + 8;
  };

  const drawFileCard = (file) => {
    flushColumns(2);
    const name = String(file.filename || "Fichier");
    const meta = `${String(file.contentType || "application/octet-stream")} - ${formatBytes(file.size || 0)}`;
    const height = 48;
    ensureSpace(height + 8);
    page.drawRectangle({
      x: margin,
      y: cursorY - height,
      width: pageSize.width - margin * 2,
      height,
      color: colors.white,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 10,
    });
    page.drawText(name, {
      x: margin + 10,
      y: cursorY - 18,
      size: 11,
      font: fontBold,
      color: colors.ink,
    });
    page.drawText(meta, {
      x: margin + 10,
      y: cursorY - 34,
      size: 9,
      font: fontRegular,
      color: colors.muted,
    });
    cursorY -= height + 8;
  };

  const drawPageHeader = () => {
    page.drawRectangle({
      x: margin,
      y: pageSize.height - margin - 16,
      width: 64,
      height: 6,
      color: colors.accent,
    });
    page.drawText("Digital InPulse", {
      x: margin,
      y: pageSize.height - margin - 30,
      size: 10,
      font: fontBold,
      color: colors.accent,
    });
    cursorY = pageSize.height - margin - 44;
  };

  drawPageHeader();
  page.drawText("Dossier de candidature", {
    x: margin,
    y: cursorY - titleSize,
    size: titleSize,
    font: fontBold,
    color: colors.ink,
  });
  cursorY -= titleSize + 10;

  drawTextBlock(record.summary?.company || "-", {
    size: 14,
    font: fontBold,
    color: colors.accent,
    after: 3,
  });
  drawTextBlock(
    `${record.reference || "-"}  |  ${programToLabel(record.program)}  |  ${formatDate(record.createdAt)}`,
    {
      size: smallSize,
      color: colors.muted,
      after: 10,
    },
  );

  drawSectionTitle("Informations soumises");
  for (const [key, value] of Object.entries(record.fields || {})) {
    if (key === "program" || key === "website_confirm") {
      continue;
    }
    drawFieldCard(humanizeFieldName(key), value);
  }
  flushColumns(8);

  drawSectionTitle("Pieces jointes");
  if (!record.files?.length) {
    drawTextBlock("Aucune piece jointe.", { color: colors.muted, after: 0 });
  } else {
    for (const file of record.files) {
      drawFileCard(file);
    }
  }

  return Buffer.from(await pdf.save());
}

function wrapText(text, font, size, maxWidth, maxLines = 999) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  if (!words[0]) {
    return [""];
  }
  const lines = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[index];
  }
  lines.push(current);
  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    let last = trimmed[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    trimmed[maxLines - 1] = `${last}...`;
    return trimmed;
  }
  return lines;
}

function humanizeFieldName(value) {
  if (FIELD_LABELS[value]) {
    return FIELD_LABELS[value];
  }
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFieldValueForPdf(value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValueForPdf(item)).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }
  return String(value ?? "-");
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let current = size;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(current >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function programToLabel(program) {
  if (String(program || "").toLowerCase() === "smart_mobility") {
    return "Smart Mobility";
  }
  return String(program || "-");
}
