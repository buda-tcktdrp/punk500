// api/session/[id].js
export default async function handler(req, res) {
  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: "missing id" });

  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) return res.status(500).json({ error: "KV env missing" });

  // Upstash REST – GET /get/<key>
  const r = await fetch(`${base}/get/${encodeURIComponent(`session:${id}`)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!r.ok) {
    const txt = await r.text();
    return res.status(502).json({ error: "kv get failed", detail: txt });
  }

  const { result } = await r.json(); // string | null
  if (!result) return res.status(404).json({ error: "not found" });

  let data;
  try {
    data = typeof result === "string" ? JSON.parse(result) : result;
  } catch {
    return res.status(500).json({ error: "parse error" });
  }

  const { email, ...publicData } = data; // email ne menjen ki
  return res.status(200).json(publicData);
}
