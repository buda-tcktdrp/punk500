// api/session/[id].js
export default async function handler(req, res) {
  const { id } = req.query || {};
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing id' });
  }

  try {
    const KV_URL   = process.env.UPSTASH_REDIS_REST_URL;
    const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV not configured' });
    }

    const key = `session:${id}`;
    const kvResp = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });

    if (!kvResp.ok) {
      const t = await kvResp.text();
      return res.status(500).json({ error: `KV error ${kvResp.status}: ${t}` });
    }

    const body = await kvResp.json();
    const doc = body?.result || null;
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // E-mail elrejtése a kliens válaszból (opcionális biztonság)
    const { email, ...safe } = doc;
    return res.status(200).json({ ok: true, session: safe });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
