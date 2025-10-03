// api/session/[id].js
export default async function handler(req, res) {
  const { id } = req.query || {};
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing id' });

  try {
    const KV_URL   = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;
    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing)' });
    }

    const key = `session:${id}`;
    const resp = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    if (!resp.ok) return res.status(500).json({ error: `KV error ${resp.status}` });

    const json = await resp.json();
    const doc = json?.result || null;
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // e-mailt nem adjuk vissza a kliensnek
    const { email, ...safe } = doc;
    return res.status(200).json({ ok: true, session: safe });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
