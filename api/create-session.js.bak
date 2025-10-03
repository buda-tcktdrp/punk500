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

    const SITE_BASE_URL = process.env.SITE_BASE_URL || `https://${req.headers.host}`;
    const KV_URL        = process.env.UPSTASH_REDIS_REST_URL;
    const KV_TOKEN      = process.env.UPSTASH_REDIS_REST_TOKEN;
    const RESEND_API_KEY= process.env.RESEND_API_KEY;
    const EMAIL_FROM    = process.env.EMAIL_FROM; // pl. noreply@send.ticketdrop.hu

    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ error: 'KV not configured' });
    }
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      // Nem blokkoljuk a flow-t, de jelezzük, hogy e-mailhez hiány van
      console.warn('Email not fully configured (RESEND_API_KEY / EMAIL_FROM).');
    }

    // --- 1) slug + unique id ---
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 32);

    let id, exists = true, attempts = 0;
    while (exists && attempts < 5) {
      const token = Math.random().toString(36).slice(2, 8); // 6 chars
      id = `${slug}-${token}`;
      const key = `session:${id}`;
      const resp = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const body = await resp.json().catch(()=>null);
      exists = body && body.result != null;
      attempts++;
    }
    if (exists) return res.status(500).json({ error: 'Could not create unique ID, try again' });

    // --- 2) KV save ---
    const sessionKey = `session:${id}`;
    const now = new Date().toISOString();
    const doc = {
      id,
      name: slug,
      email,          // tároljuk, de kliensnek nem adjuk vissza
      createdAt: now,
      consentAt: now,
      progress: 0,
      listened: [],
      skipped: [],
      notes: {},
      ratings: {}
    };

    const setResp = await fetch(`${KV_URL}/set/${encodeURIComponent(sessionKey)}`, {
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

    // --- 3) URL ---
    const sessionUrl = `${SITE_BASE_URL}/session/${id}`;

    // --- 4) Email (best-effort; hiba esetén nem állítjuk meg a redirectet) ---
    if (RESEND_API_KEY && EMAIL_FROM) {
      const emailHtml = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 8px 0">Your TicketDrop session link</h2>
          <p style="margin:0 0 12px 0">Hi ${name},</p>
          <p style="margin:0 0 12px 0">
            Your personal link for the 500 punk/hardcore journey:
            <br>
            <a href="${sessionUrl}" style="color:#111;font-weight:600">${sessionUrl}</a>
          </p>
          <p style="margin:0 0 16px 0;font-size:14px;color:#444">
            Keep this email. Anyone with the link can access your session.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="margin:0;font-size:12px;color:#666">
            You received this because you created a session at ticketdrop.hu.
            To request deletion, visit the Privacy page or reply to this email.
          </p>
        </div>
      `;

      try {
        const send = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: email,
            subject: 'Your TicketDrop session link',
            html: emailHtml
          })
        });

        if (!send.ok) {
          const txt = await send.text();
          console.warn('Resend error:', send.status, txt);
          // nem dobunk hibát — a redirect akkor is megy tovább
        }
      } catch (err) {
        console.warn('Resend exception:', err);
      }
    }

    // --- 5) Válasz a kliensnek (redirecthez) ---
    return res.status(200).json({ ok: true, id, url: sessionUrl });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}
