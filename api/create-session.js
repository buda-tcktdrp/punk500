// api/create-session.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const { name, email, consent } = await readJson(req);
  if (!name || !email || consent !== true) {
    return res.status(400).json({ error: "missing fields" });
  }

  const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
  const created = new Date().toISOString();
  const session = {
    id, name, email, created,
    progress: 0, listened: 0, skipped: 0, notes: 0, ratings: 0,
  };

  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) return res.status(500).json({ error: "KV env missing" });

  // Upstash REST – POST /set/<key>/<value>
  const kvRes = await fetch(
    `${base}/set/${encodeURIComponent(`session:${id}`)}/${encodeURIComponent(JSON.stringify(session))}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!kvRes.ok) {
    const txt = await kvRes.text();
    return res.status(502).json({ error: "kv set failed", detail: txt });
  }

  // Opcionális email – nem bukjon miatta a request
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const site = process.env.SITE_BASE_URL || `https://${req.headers.host}`;
    if (apiKey && from) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: email,
          subject: "Your Ticketdrop session",
          html: `<p>Hi ${escapeHtml(name)},</p>
                 <p>Your session is ready: <a href="${site}/session?id=${id}">Open session</a></p>`,
        }),
      });
    }
  } catch (e) {
    console.error("[Resend] send failed:", e);
  }

  return res.status(200).json({ ok: true, id, url: `/session?id=${id}` });
}

// --- helpers ---
async function readJson(req) {
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32); }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]))}
