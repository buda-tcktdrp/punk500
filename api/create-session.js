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

    const SITE_BASE_URL  = process.env.SITE_BASE_URL || `https://${req.headers.host}`;
    // ⬇⬇⬇  **EZEKET** adta hozzá a Vercel, ezeket kell használni
    const KV_URL         = process.env.KV_REST_API_URL;
    const KV_TOKEN       = process.env.KV_REST_API_TOKEN;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const EMAIL_FROM     = process.env.EMAIL_FROM;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing)' });
    }

    // 1) slug + unique id
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 32);

    // ütközés-ellenőrzés
    let id, exists = true, tries = 0;
    while (exists && tries < 5) {
      const token = Math.random().toString(36).slice(2, 8);
      id = `${slug}-${token}`;
      const key = `session:${id}`;

      const resp = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      }).then(r => r.json()).catch(() => null);

      exists = resp && resp.result != null;
      tries++;
    }
    if (exists) return res.status(500).json({ error: 'Could not create unique ID, try again' });

    const now = new Date().toISOString();
    const doc = {
      id,
      name: slug,
      email,               // szerver oldalon tároljuk
      createdAt: now,
      consentAt: now,
      progress: 0,
      listened: [],
      skipped: [],
      notes: {},
      ratings: {}
    };

    // 2) mentés KV-be
    const setKey = `session:${id}`;
    const setResp = await fetch(`${KV_URL}/set/${encodeURIComponent(setKey)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(doc)
    });
    if (!setResp.ok) {
      const t = await setResp.text();
      return res.status(500).json({ error: `KV error ${setResp.status}: ${t}` });
    }

    // 3) URL összerakása
    const sessionUrl = `${SITE_BASE_URL}/session/${id}`;

    // 4) Email küldés (best-effort)
    if (RESEND_API_KEY && EMAIL_FROM) {
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 8px">Your TicketDrop session link</h2>
          <p style="margin:0 0 12px">Hi ${name},</p>
          <p style="margin:0 0 12px">
            Your personal link:<br>
            <a href="${sessionUrl}" style="color:#111;font-weight:600">${sessionUrl}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;color:#555">
            Keep this email. Anyone with the link can access your session.
          </p>
        </div>
      `;
      try {
        const sent = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ from: EMAIL_FROM, to: email, subject: 'Your TicketDrop link', html })
        });
        if (!sent.ok) console.warn('Resend error:', sent.status, await sent.text());
      } catch (e) {
        console.warn('Resend exception:', e);
      }
    } else {
      console.warn('Email not fully configured (RESEND_API_KEY / EMAIL_FROM missing).');
    }

    // 5) válasz a kliensnek
    return res.status(200).json({ ok: true, id, url: sessionUrl });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
