// Netlify Function: email a TaskFlow invite link.
// POST { to, link, inviter, workspace, role }
// Requires env vars (Netlify → Site settings → Environment variables):
//   RESEND_API_KEY   – from resend.com (free tier)
//   FROM_EMAIL       – a verified sender, e.g. "EQGenix <team@yourdomain.com>"
// If these aren't set, the app silently falls back to share-the-link.

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.FROM_EMAIL;
  if (!KEY || !FROM) return new Response(JSON.stringify({ error: 'email_not_configured' }), { status: 503 });

  let body;
  try { body = await req.json(); } catch (e) { return new Response('Bad JSON', { status: 400 }); }
  const { to, link, inviter, workspace, role } = body || {};
  if (!to || !link) return new Response(JSON.stringify({ error: 'missing to/link' }), { status: 400 });

  const ws = workspace || 'the team board';
  const who = inviter || 'A teammate';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#2b2018">
      <h2 style="font-size:20px;margin:0 0 8px">You're invited to ${ws}</h2>
      <p style="font-size:14px;line-height:1.55;color:#5c5147">
        ${who} invited you to join <b>${ws}</b> as a <b>${role === 'manager' ? 'Manager' : 'Member'}</b> on TaskFlow —
        one shared place to see open work, claim tasks, and track who did what.</p>
      <p style="margin:22px 0">
        <a href="${link}" style="background:#D9824F;color:#fff;text-decoration:none;font-weight:600;
          padding:12px 22px;border-radius:10px;display:inline-block;font-size:14px">Set up your account</a></p>
      <p style="font-size:12px;color:#8a7d70">Or paste this link into your browser:<br>${link}</p>
    </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: `Join ${ws} on TaskFlow`, html }),
  });
  if (!r.ok) { const t = await r.text(); return new Response(JSON.stringify({ error: 'send_failed', detail: t }), { status: 502 }); }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
