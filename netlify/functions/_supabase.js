const DEFAULT_BUCKET = "dip-submissions";

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const bucket = process.env.SUBMISSIONS_BUCKET || DEFAULT_BUCKET;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceKey, bucket };
}

async function supabaseFetch(config, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.serviceKey}`,
      apikey: config.serviceKey,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase API ${response.status}: ${text}`);
  }
  return response;
}

async function uploadObject(config, objectPath, buffer, contentType) {
  return supabaseFetch(config, `/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buffer,
  });
}

async function putJson(config, objectPath, payload) {
  const body = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return uploadObject(config, objectPath, body, "application/json");
}

async function listObjects(config, prefix, limit = 100, offset = 0) {
  const response = await supabaseFetch(config, `/storage/v1/object/list/${config.bucket}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: prefix || "",
      limit,
      offset,
      sortBy: { column: "name", order: "desc" },
    }),
  });
  return response.json();
}

async function removeObjects(config, prefixes) {
  return supabaseFetch(config, `/storage/v1/object/${config.bucket}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes }),
  });
}

async function getObject(config, objectPath) {
  const response = await supabaseFetch(config, `/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "GET",
  });
  return response.text();
}

async function getObjectBuffer(config, objectPath) {
  const response = await supabaseFetch(config, `/storage/v1/object/${config.bucket}/${objectPath}`, {
    method: "GET",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function createSignedUrl(config, objectPath, expiresIn = 900) {
  const response = await supabaseFetch(
    config,
    `/storage/v1/object/sign/${config.bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
    },
  );
  const payload = await response.json();
  const signedPath = String(payload.signedURL || "");
  return `${config.url}/storage/v1${signedPath}`;
}

module.exports = {
  getSupabaseConfig,
  uploadObject,
  putJson,
  listObjects,
  removeObjects,
  getObject,
  getObjectBuffer,
  createSignedUrl,
};
