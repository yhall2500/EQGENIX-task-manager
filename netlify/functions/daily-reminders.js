// Netlify Scheduled Function: daily due/overdue reminders.
// Runs on a cron (see netlify.toml). For every task that is due today or
// overdue and still open or in-progress, it emails the person responsible
// (the claimer, or the assignee if unclaimed) a nudge.
//
// Requires env vars:
//   SUPABASE_URL            – your project URL
//   SUPABASE_SERVICE_ROLE   – service_role key (Project Settings → API). SERVER-ONLY.
//   RESEND_API_KEY          – resend.com API key
//   FROM_EMAIL              – verified sender
//   SITE_URL                – your deployed app URL (for the link in the email)
//
// Netlify injects these securely; they are never exposed to the browser.

const H = (k) => process.env[k];

async function sb(path) {
  const r = await fetch(H('SUPABASE_URL') + '/rest/v1/' + path, {
    headers: { apikey: H('SUPABASE_SERVICE_ROLE'), Authorization: 'Bearer ' + H('SUPABASE_SERVICE_ROLE') },
  });
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()));
  return r.json();
}

async function email(to, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + H('RESEND_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: H('FROM_EMAIL'), to: [to], subject, html }),
  });
}

export default async () => {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE', 'RESEND_API_KEY', 'FROM_EMAIL']) {
    if (!H(k)) return new Response('Not configured: missing ' + k, { status: 503 });
  }

  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  // open/in-progress tasks due on or before end of today
  const tasks = await sb('tasks?status=in.(open,in_progress)&due=lte.' + encodeURIComponent(endOfToday.toISOString()) + '&select=id,title,due,status,claimed_by,assigned_to');
  if (!tasks.length) return new Response('Nothing due', { status: 200 });

  const profiles = await sb('profiles?select=id,email,full_name');
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const site = H('SITE_URL') || '';

  // group tasks by responsible person
  const buckets = {};
  for (const t of tasks) {
    const uid = t.claimed_by || t.assigned_to;
    if (!uid || !byId[uid] || !byId[uid].email) continue;
    (buckets[uid] = buckets[uid] || []).push(t);
  }

  let sent = 0;
  for (const uid of Object.keys(buckets)) {
    const p = byId[uid];
    const rows = buckets[uid].map((t) => {
      const overdue = new Date(t.due) < new Date();
      return `<li style="margin:4px 0"><b>${t.title}</b> — <span style="color:${overdue ? '#D9594B' : '#c47a1e'}">${overdue ? 'overdue' : 'due today'}</span></li>`;
    }).join('');
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#2b2018">
        <h2 style="font-size:19px;margin:0 0 6px">Hi ${(p.full_name || '').split(' ')[0] || 'there'} — a few tasks need attention</h2>
        <ul style="font-size:14px;line-height:1.5;color:#5c5147;padding-left:18px">${rows}</ul>
        <p style="margin:20px 0"><a href="${site}" style="background:#D9824F;color:#fff;text-decoration:none;
          font-weight:600;padding:11px 20px;border-radius:10px;display:inline-block;font-size:14px">Open your board</a></p>
      </div>`;
    await email(p.email, 'Your TaskFlow tasks for today', html);
    sent++;
  }
  return new Response('Reminders sent: ' + sent, { status: 200 });
};

// Netlify cron: every weekday at 8am UTC. Adjust in netlify.toml if you prefer.
export const config = { schedule: '0 8 * * 1-5' };
