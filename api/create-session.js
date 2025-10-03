// api/create-session.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, consent } = req.body || {};
    if (!name || !/^[a-z0-9-_.]{2,32}$/i.test(name)) {
      return res.status(400).json({ error: 'Invalid name' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!consent) {
      return res.status(400).json({ error: 'Consent required' });
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 32);

    const rand = Math.random().toString(36).slice(2, 8); // 6 karakter
    const id = `${slug}-${rand}`;

    const base = process.env.SITE_BASE_URL || `https://${req.headers.host}`;
    const url = `${base}/session/${id}`;

    // itt később: KV mentés + Resend email küldés

    return res.status(200).json({ ok: true, id, url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
