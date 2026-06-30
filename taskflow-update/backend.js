/* ============================================================
   TaskFlow — Backend abstraction (plain JS, window.Backend)
   Two implementations behind one async API:
     • supabase : real shared backend (auth + Postgres) when
                  window.TASKFLOW_CONFIG has URL + anon key
     • local    : localStorage demo so the app runs with no setup
   App code only ever calls Backend.* — never Supabase directly.
   ============================================================ */
(function () {
  const CFG = window.TASKFLOW_CONFIG || {};
  const SB_READY = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const MODE = SB_READY ? 'supabase' : 'local';
  const COLORS = ['#D9824F', '#5B8DEF', '#3FA779', '#B06AB3', '#E0A33E', '#D96A6A', '#5FB0A6', '#C9655A'];
  const rid = (p) => p + Math.random().toString(36).slice(2, 9);
  const colorFor = (key) => { let h = 0; for (const c of (key || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };

  // revive date strings → Date objects on a task coming out of storage / db
  const DATE_FIELDS = ['due', 'createdAt', 'claimedAt', 'completedAt', 'approvedAt'];
  function reviveTask(t) {
    const x = { ...t };
    DATE_FIELDS.forEach(f => { x[f] = x[f] ? new Date(x[f]) : null; });
    x.comments = (x.comments || []).map(c => ({ ...c, at: new Date(c.at) }));
    x.activity = (x.activity || []).map(a => ({ ...a, at: new Date(a.at) }));
    return x;
  }

  /* =========================================================
     LOCAL implementation (localStorage)
     ========================================================= */
  const LKEY = 'tf_db_v2';
  const Local = (() => {
    function fresh() {
      const D = window.TASKFLOW_DATA;
      // seed members + tasks so the demo isn't empty; password for all = "taskflow"
      const members = (D.USERS || []).map((u, i) => ({
        id: u.id, email: window.emailFor ? window.emailFor(u) : (u.name.split(' ')[0].toLowerCase() + '@brightside.studio'),
        pass: btoa('taskflow'), name: u.name, title: u.title, role: u.role, color: u.color || COLORS[i % COLORS.length],
      }));
      const tasks = (D.TASKS || []).map(t => {
        const c = { ...t };
        DATE_FIELDS.forEach(f => { if (c[f] instanceof Date) c[f] = c[f].toISOString(); });
        c.comments = (c.comments || []).map(x => ({ ...x, at: x.at instanceof Date ? x.at.toISOString() : x.at }));
        c.activity = (c.activity || []).map(x => ({ ...x, at: x.at instanceof Date ? x.at.toISOString() : x.at }));
        return c;
      });
      return { workspace: { name: (D.business || 'TaskFlow') + ' workspace' }, members, tasks, invites: [], messages: [], personal: [], notifications: [], sessionUserId: null, seeded: true };
    }
    function read() {
      try { const r = localStorage.getItem(LKEY); if (r) { const d = JSON.parse(r); if (!d.messages) d.messages = []; if (!d.personal) d.personal = []; if (!d.notifications) d.notifications = []; return d; } } catch (e) {}
      const db = fresh(); write(db); return db;
    }
    function write(db) { try { localStorage.setItem(LKEY, JSON.stringify(db)); } catch (e) {} }
    const cbs = [];
    const emit = () => { const u = api.session(); cbs.forEach(cb => cb(u)); };
    const pub = (m) => m ? ({ id: m.id, email: m.email, name: m.name, title: m.title, role: m.role, color: m.color }) : null;

    const api = {
      session() { const db = read(); return pub(db.members.find(m => m.id === db.sessionUserId)); },
      onAuth(cb) { cbs.push(cb); },
      signUp({ email, password, name, title, inviteToken }) {
        const db = read(); email = (email || '').trim().toLowerCase();
        if (!email || !password) return Promise.reject(new Error('Email and password are required.'));
        if (db.members.some(m => m.email === email)) return Promise.reject(new Error('An account with that email already exists. Try logging in.'));
        let role = db.members.length === 0 ? 'manager' : 'member';
        let inv = null;
        if (inviteToken) { inv = db.invites.find(i => i.token === inviteToken && !i.accepted); if (inv) { role = inv.role; inv.accepted = true; } }
        const m = { id: rid('u_'), email, pass: btoa(password), name: name || email.split('@')[0], title: title || (role === 'manager' ? 'Manager' : 'Team member'), role, color: colorFor(email) };
        db.members.push(m); db.sessionUserId = m.id; write(db); emit();
        return Promise.resolve(pub(m));
      },
      signIn({ email, password }) {
        const db = read(); email = (email || '').trim().toLowerCase();
        const m = db.members.find(x => x.email === email);
        if (!m || m.pass !== btoa(password || '')) return Promise.reject(new Error('Wrong email or password.'));
        db.sessionUserId = m.id; write(db); emit();
        return Promise.resolve(pub(m));
      },
      signOut() { const db = read(); db.sessionUserId = null; write(db); emit(); return Promise.resolve(); },
      updateProfile(patch) {
        const db = read(); const m = db.members.find(x => x.id === db.sessionUserId);
        if (m) { Object.assign(m, patch); write(db); } return Promise.resolve(pub(m));
      },
      listMembers() { return Promise.resolve(read().members.map(pub)); },
      listTasks() { return Promise.resolve(read().tasks.map(reviveTask)); },
      createTask(data) {
        const db = read(); const now = new Date().toISOString();
        const t = { id: rid('task_'), ...serializeTask(data), createdBy: db.sessionUserId, createdAt: now,
          status: 'open', claimedBy: null, claimedAt: null, completedBy: null, completedAt: null, approvedBy: null, approvedAt: null,
          completionNote: null, comments: [], activity: [{ type: 'created', by: db.sessionUserId, at: now }] };
        db.tasks.unshift(t); write(db); return Promise.resolve(reviveTask(t));
      },
      updateTask(id, patch) {
        const db = read(); const t = db.tasks.find(x => x.id === id);
        if (t) { Object.assign(t, serializeTask(patch)); write(db); } return Promise.resolve(t ? reviveTask(t) : null);
      },
      createInvite({ email, role }) {
        const db = read(); email = (email || '').trim().toLowerCase();
        let inv = db.invites.find(i => i.email === email && !i.accepted);
        if (!inv) { inv = { token: rid('inv_'), email, role: role || 'member', accepted: false, at: new Date().toISOString() }; db.invites.push(inv); write(db); }
        return Promise.resolve(inv);
      },
      listInvites() { return Promise.resolve(read().invites.filter(i => !i.accepted)); },
      getInvite(token) { return Promise.resolve(read().invites.find(i => i.token === token) || null); },
      setRole(uid, role) {
        const db = read(); const m = db.members.find(x => x.id === uid);
        if (m) { m.role = role; write(db); } return Promise.resolve(pub(m));
      },
      deleteTask(id) { const db = read(); db.tasks = db.tasks.filter(x => x.id !== id); write(db); return Promise.resolve(true); },
      listMessages() { const db = read(); return Promise.resolve((db.messages || []).map(m => ({ ...m, at: new Date(m.at) }))); },
      sendMessage(text) {
        const db = read(); const m = { id: rid('m_'), userId: db.sessionUserId, body: text, at: new Date().toISOString() };
        db.messages.push(m); write(db); return Promise.resolve({ ...m, at: new Date(m.at) });
      },
      listPersonal() {
        const db = read();
        return Promise.resolve((db.personal || []).filter(p => p.owner === db.sessionUserId)
          .map(p => ({ ...p, due: p.due ? new Date(p.due) : null })));
      },
      addPersonal({ title, due }) {
        const db = read();
        const p = { id: rid('p_'), owner: db.sessionUserId, title, done: false, due: due ? new Date(due).toISOString() : null, at: new Date().toISOString() };
        db.personal.push(p); write(db);
        return Promise.resolve({ ...p, due: p.due ? new Date(p.due) : null });
      },
      setPersonalDone(id, done) {
        const db = read(); const p = db.personal.find(x => x.id === id);
        if (p) { p.done = done; write(db); } return Promise.resolve(true);
      },
      deletePersonal(id) {
        const db = read(); db.personal = db.personal.filter(x => x.id !== id); write(db);
        return Promise.resolve(true);
      },
      listNotifications() {
        const db = read();
        return Promise.resolve((db.notifications || []).filter(n => n.recipient === db.sessionUserId)
          .sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40)
          .map(n => ({ ...n, at: new Date(n.at) })));
      },
      notify({ recipient, kind, text, taskId }) {
        const db = read();
        db.notifications.push({ id: rid('n_'), recipient, kind, text, taskId: taskId || null, read: false, at: new Date().toISOString() });
        write(db); return Promise.resolve(true);
      },
      markNotificationsRead() {
        const db = read();
        db.notifications.forEach(n => { if (n.recipient === db.sessionUserId) n.read = true; });
        write(db); return Promise.resolve(true);
      },
      uploadProof(file) {
        return new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result); // data URL works offline
          fr.onerror = () => rej(new Error('Could not read the file'));
          fr.readAsDataURL(file);
        });
      },
    };
    return api;
  })();

  // turn app-shape (camelCase, Date) into storable strings; used by local + as map source
  function serializeTask(d) {
    const o = { ...d };
    DATE_FIELDS.forEach(f => { if (o[f] instanceof Date) o[f] = o[f].toISOString(); });
    if (o.comments) o.comments = o.comments.map(c => ({ ...c, at: c.at instanceof Date ? c.at.toISOString() : c.at }));
    if (o.activity) o.activity = o.activity.map(a => ({ ...a, at: a.at instanceof Date ? a.at.toISOString() : a.at }));
    return o;
  }

  /* =========================================================
     SUPABASE implementation
     ========================================================= */
  const Supa = (() => {
    if (!SB_READY) return null;
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const pubFromProfile = (p) => p ? ({ id: p.id, email: p.email, name: p.full_name, title: p.title, role: p.role, color: p.color }) : null;
    // map db row (snake_case) → app task shape (camelCase)
    const fromRow = (r) => reviveTask({
      id: r.id, title: r.title, desc: r.description, dept: r.dept, priority: r.priority, estimate: r.estimate,
      due: r.due, status: r.status, requiresApproval: r.requires_approval, proof: r.proof, assignedTo: r.assigned_to, recurrence: r.recurrence,
      createdBy: r.created_by, createdAt: r.created_at, claimedBy: r.claimed_by, claimedAt: r.claimed_at,
      completedBy: r.completed_by, completedAt: r.completed_at, approvedBy: r.approved_by, approvedAt: r.approved_at,
      completionNote: r.completion_note, proofUrl: r.proof_url, comments: r.comments || [], activity: r.activity || [],
    });
    // map app patch → db columns
    const toRow = (d) => {
      const m = { title: 'title', desc: 'description', dept: 'dept', priority: 'priority', estimate: 'estimate',
        due: 'due', status: 'status', requiresApproval: 'requires_approval', proof: 'proof', assignedTo: 'assigned_to', recurrence: 'recurrence',
        claimedBy: 'claimed_by', claimedAt: 'claimed_at', completedBy: 'completed_by', completedAt: 'completed_at',
        approvedBy: 'approved_by', approvedAt: 'approved_at', completionNote: 'completion_note', proofUrl: 'proof_url', comments: 'comments', activity: 'activity' };
      const out = {};
      Object.keys(d).forEach(k => { if (m[k]) { let v = d[k]; if (v instanceof Date) v = v.toISOString();
        if (Array.isArray(v)) v = v.map(x => x.at instanceof Date ? { ...x, at: x.at.toISOString() } : x); out[m[k]] = v; } });
      return out;
    };
    let profileCache = null;
    async function myProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { profileCache = null; return null; }
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
      profileCache = data ? { ...data, email: data.email || user.email } : null;
      return profileCache;
    }
    return {
      async session() { return pubFromProfile(await myProfile()); },
      onAuth(cb) { sb.auth.onAuthStateChange(async () => { cb(pubFromProfile(await myProfile())); }); },
      async signUp({ email, password, name, title, inviteToken }) {
        const { data, error } = await sb.auth.signUp({ email: email.trim().toLowerCase(), password,
          options: { data: { full_name: name || '', title: title || '', invite_token: inviteToken || '' } } });
        if (error) throw new Error(error.message);
        if (!data.session) { const e = new Error('confirm-email'); e.code = 'confirm'; throw e; }
        return pubFromProfile(await myProfile());
      },
      async signIn({ email, password }) {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw new Error(error.message);
        return pubFromProfile(await myProfile());
      },
      async signOut() { await sb.auth.signOut(); },
      async updateProfile(patch) {
        const { data: { user } } = await sb.auth.getUser();
        const row = {}; if (patch.name != null) row.full_name = patch.name; if (patch.title != null) row.title = patch.title;
        const { data } = await sb.from('profiles').update(row).eq('id', user.id).select().single();
        return pubFromProfile(data);
      },
      async listMembers() { const { data } = await sb.from('profiles').select('*').order('created_at'); return (data || []).map(pubFromProfile); },
      async listTasks() { const { data, error } = await sb.from('tasks').select('*').order('created_at', { ascending: false }); if (error) throw new Error(error.message); return (data || []).map(fromRow); },
      async createTask(data) {
        const { data: { user } } = await sb.auth.getUser();
        const now = new Date().toISOString();
        const row = { ...toRow(data), created_by: user.id, status: 'open', activity: [{ type: 'created', by: user.id, at: now }], comments: [] };
        const { data: ins, error } = await sb.from('tasks').insert(row).select().single();
        if (error) throw new Error(error.message); return fromRow(ins);
      },
      async updateTask(id, patch) {
        const { data, error } = await sb.from('tasks').update(toRow(patch)).eq('id', id).select().single();
        if (error) throw new Error(error.message); return fromRow(data);
      },
      async createInvite({ email, role }) {
        const { data, error } = await sb.from('invites').upsert({ email: email.trim().toLowerCase(), role: role || 'member', accepted: false }, { onConflict: 'email' }).select().single();
        if (error) throw new Error(error.message); return data;
      },
      async listInvites() { const { data } = await sb.from('invites').select('*').eq('accepted', false).order('created_at', { ascending: false }); return data || []; },
      async getInvite(token) { const { data } = await sb.rpc('get_invite', { t: token }); return (data && data[0]) || null; },
      async setRole(uid, role) {
        const { data, error } = await sb.from('profiles').update({ role }).eq('id', uid).select().single();
        if (error) throw new Error(error.message); return pubFromProfile(data);
      },
      async deleteTask(id) { const { error } = await sb.from('tasks').delete().eq('id', id); if (error) throw new Error(error.message); return true; },
      async listMessages() {
        const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: true }).limit(300);
        if (error) throw new Error(error.message);
        return (data || []).map(m => ({ id: m.id, userId: m.user_id, body: m.body, at: new Date(m.created_at) }));
      },
      async sendMessage(text) {
        const { data: { user } } = await sb.auth.getUser();
        const { data, error } = await sb.from('messages').insert({ user_id: user.id, body: text }).select().single();
        if (error) throw new Error(error.message);
        return { id: data.id, userId: data.user_id, body: data.body, at: new Date(data.created_at) };
      },
      async listPersonal() {
        const { data: { user } } = await sb.auth.getUser();
        const { data, error } = await sb.from('personal_tasks').select('*').eq('owner', user.id).order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        return (data || []).map(p => ({ id: p.id, title: p.title, done: p.done, due: p.due ? new Date(p.due) : null }));
      },
      async addPersonal({ title, due }) {
        const { data: { user } } = await sb.auth.getUser();
        const { data, error } = await sb.from('personal_tasks').insert({ owner: user.id, title, due: due ? new Date(due).toISOString() : null }).select().single();
        if (error) throw new Error(error.message);
        return { id: data.id, title: data.title, done: data.done, due: data.due ? new Date(data.due) : null };
      },
      async setPersonalDone(id, done) { const { error } = await sb.from('personal_tasks').update({ done }).eq('id', id); if (error) throw new Error(error.message); return true; },
      async deletePersonal(id) { const { error } = await sb.from('personal_tasks').delete().eq('id', id); if (error) throw new Error(error.message); return true; },
      async listNotifications() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return [];
        const { data, error } = await sb.from('notifications').select('*').eq('recipient', user.id).order('created_at', { ascending: false }).limit(40);
        if (error) throw new Error(error.message);
        return (data || []).map(n => ({ id: n.id, kind: n.kind, text: n.text, taskId: n.task_id, read: n.read, at: new Date(n.created_at) }));
      },
      async notify({ recipient, kind, text, taskId }) {
        const { error } = await sb.from('notifications').insert({ recipient, kind, text, task_id: taskId || null });
        if (error) throw new Error(error.message); return true;
      },
      async markNotificationsRead() {
        const { data: { user } } = await sb.auth.getUser();
        const { error } = await sb.from('notifications').update({ read: true }).eq('recipient', user.id).eq('read', false);
        if (error) throw new Error(error.message); return true;
      },
      async uploadProof(file) {
        const { data: { user } } = await sb.auth.getUser();
        const ext = ((file.name || 'file').split('.').pop() || 'dat').toLowerCase();
        const path = user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
        const { error } = await sb.storage.from('proofs').upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(error.message);
        const { data } = sb.storage.from('proofs').getPublicUrl(path);
        return data.publicUrl;
      },
    };
  })();

  const impl = MODE === 'supabase' ? Supa : Local;

  /* =========================================================
     Public API
     ========================================================= */
  window.Backend = {
    mode: MODE,
    async init() {
      // real clock for the live backend; keep the demo's anchored clock for local seed dates
      if (MODE === 'supabase') window.TASKFLOW_DATA.NOW = new Date();
      return MODE;
    },
    currentUser() { return impl.session(); },
    onAuthChange(cb) { impl.onAuth(cb); },
    signUp(args) { return impl.signUp(args); },
    signIn(args) { return impl.signIn(args); },
    signOut() { return impl.signOut(); },
    updateProfile(patch) { return impl.updateProfile(patch); },
    listMembers() { return impl.listMembers(); },
    listTasks() { return impl.listTasks(); },
    createTask(data) { return impl.createTask(data); },
    updateTask(id, patch) { return impl.updateTask(id, patch); },
    createInvite(args) { return impl.createInvite(args); },
    listInvites() { return impl.listInvites(); },
    getInvite(token) { return impl.getInvite(token); },
    setRole(uid, role) { return impl.setRole(uid, role); },
    deleteTask(id) { return impl.deleteTask(id); },
    listMessages() { return impl.listMessages(); },
    sendMessage(text) { return impl.sendMessage(text); },
    listPersonal() { return impl.listPersonal(); },
    addPersonal(args) { return impl.addPersonal(args); },
    setPersonalDone(id, done) { return impl.setPersonalDone(id, done); },
    deletePersonal(id) { return impl.deletePersonal(id); },
    listNotifications() { return impl.listNotifications(); },
    notify(args) { return impl.notify(args); },
    markNotificationsRead() { return impl.markNotificationsRead(); },
    uploadProof(file) { return impl.uploadProof(file); },
    inviteLink(token) {
      const base = location.origin + location.pathname;
      return base + '?invite=' + encodeURIComponent(token);
    },
  };
})();
