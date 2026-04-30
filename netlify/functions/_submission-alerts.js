async function sendSubmissionSuccessEmail(config, record) {
  if (!canSendSubmissionEmails(config)) {
    return;
  }

  const name = `${toSingleValue(record.fields.first_name)} ${toSingleValue(record.fields.last_name)}`.trim() || "Candidat";
  const email = toSingleValue(record.fields.email) || "N/A";
  const company = toSingleValue(record.fields.company) || "N/A";
  const subject = `[Digital InPulse] Nouvelle candidature ${record.reference}`;
  const text = [
    `Reference: ${record.reference}`,
    `Programme: ${record.program}`,
    `Date: ${record.createdAt}`,
    `Nom: ${name}`,
    `Email: ${email}`,
    `Entreprise: ${company}`,
    `Fichiers: ${record.files.length}`,
  ].join("\n");

  await sendResendEmail(config, subject, text);
}

async function sendSubmissionFailureEmail(config, details = {}) {
  if (!canSendSubmissionEmails(config)) {
    return;
  }

  const subject = `[Digital InPulse] Echec candidature ${details.stage || "submission"}`;
  const text = [
    `Etape: ${details.stage || "submission"}`,
    `Date: ${new Date().toISOString()}`,
    `Erreur: ${details.error || "Erreur inconnue"}`,
    `Programme: ${details.program || "N/A"}`,
    `Email candidat: ${details.email || "N/A"}`,
    `Entreprise: ${details.company || "N/A"}`,
    `Reference: ${details.reference || "N/A"}`,
    `Origin: ${details.origin || "N/A"}`,
    `Referer: ${details.referer || "N/A"}`,
    `IP: ${details.ip || "N/A"}`,
    `User-Agent: ${details.userAgent || "N/A"}`,
    "",
    "Fichiers:",
    ...(Array.isArray(details.files) && details.files.length
      ? details.files.map((file) => `- ${file.fieldName || "file"} | ${file.filename || "unknown"} | ${file.size || 0} octets`)
      : ["- Aucun detail fichier"]),
  ].join("\n");

  await sendResendEmail(config, subject, text);
}

async function sendResendEmail(config, subject, text) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: config.notifyEmails,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Email notification failed: ${response.status} ${payload}`);
  }
}

function canSendSubmissionEmails(config) {
  return Boolean(config?.resendApiKey) && Array.isArray(config?.notifyEmails) && config.notifyEmails.length > 0;
}

function toSingleValue(value) {
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.trim()) || "";
  }
  return String(value || "").trim();
}

module.exports = {
  sendSubmissionSuccessEmail,
  sendSubmissionFailureEmail,
};
