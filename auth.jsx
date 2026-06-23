/* ============================================================
   TaskFlow — Auth (login / signup / accept-invite), Invite, Profile
   Talks only to window.Backend. Exports to window.
   ============================================================ */

function emailFor(u) { return u.name.split(' ')[0].toLowerCase() + '@brightside.studio'; }
window.emailFor = emailFor;

const IS_LIVE = () => window.Backend && window.Backend.mode === 'supabase';

/* ---------- shared split-screen shell ---------- */
function AuthShell({ appName, children }) {
  return (
    <div className="tf-auth">
      <div className="tf-auth-art" aria-hidden="true">
        <div className="tf-auth-art-inner">
          <div className="tf-auth-art-glow"></div>
          <div className="tf-auth-quote">
            <div className="tf-auth-logo"><Icon name="checkCircle" size={26} stroke={2.2} /></div>
            <h2>One board. The whole team.</h2>
            <p>See every open task, claim what you can take, and keep a clear record of who did what.</p>
            <div className="tf-auth-mini">
              {[['open', 'Open'], ['progress', 'In progress'], ['done', 'Done']].map(([c, l]) => (
                <div key={c} className="tf-auth-mini-col"><span className={'tf-auth-mini-dot ' + c}></span>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="tf-auth-panel">
        <div className="tf-auth-card">{children}</div>
        <p className="tf-auth-foot">
          <span className={'tf-mode-badge ' + (IS_LIVE() ? 'live' : 'demo')}>
            <span className="tf-mode-dot"></span>{IS_LIVE() ? 'Live backend' : 'Demo mode · this browser only'}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ---------- login + signup ---------- */
function AuthScreen({ appName, onAuthed }) {
  const [tab, setTab] = useState('login'); // login | signup
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && (tab === 'login' || name.trim().length > 1);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setErr(''); setInfo('');
    try {
      const user = tab === 'login'
        ? await Backend.signIn({ email, password })
        : await Backend.signUp({ email, password, name: name.trim() });
      onAuthed(user);
    } catch (e) {
      if (e.code === 'confirm') { setInfo('Almost there — check your email to confirm your account, then log in.'); setTab('login'); }
      else setErr(e.message || 'Something went wrong. Try again.');
    } finally { setBusy(false); }
  };

  const fillDemo = () => { setTab('login'); setEmail('maya@brightside.studio'); setPassword('taskflow'); setErr(''); };

  return (
    <AuthShell appName={appName}>
      <div className="tf-auth-brand">
        <div className="tf-logo"><Icon name="checkCircle" size={20} stroke={2.2} /></div>
        <b>{appName}</b>
      </div>

      <div className="tf-auth-tabs">
        <button className={tab === 'login' ? 'on' : ''} onClick={() => { setTab('login'); setErr(''); }}>Log in</button>
        <button className={tab === 'signup' ? 'on' : ''} onClick={() => { setTab('signup'); setErr(''); }}>Create account</button>
      </div>

      <h1>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="tf-auth-sub">{tab === 'login' ? 'Log in to your team’s board.' : 'The first account becomes the workspace manager.'}</p>

      {tab === 'signup' && (
        <>
          <label className="tf-auth-label">Full name</label>
          <div className="tf-auth-input"><Icon name="user" size={17} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Cooper" autoFocus />
          </div>
        </>
      )}
      <label className="tf-auth-label">Work email</label>
      <div className="tf-auth-input"><Icon name="mail" size={17} />
        <input type="email" value={email} autoFocus={tab === 'login'} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>
      <label className="tf-auth-label">Password</label>
      <div className="tf-auth-input"><Icon name="shield" size={17} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
          onKeyDown={e => e.key === 'Enter' && submit()} />
      </div>

      {err && <div className="tf-auth-error"><Icon name="clock" size={15} stroke={2} />{err}</div>}
      {info && <div className="tf-auth-note">{info}</div>}

      <button className="tf-btn primary md full tf-auth-btn" disabled={!canSubmit || busy} onClick={submit}>
        {busy ? <><span className="tf-spinner"></span>{tab === 'login' ? 'Logging in…' : 'Creating…'}</>
          : (tab === 'login' ? 'Log in' : 'Create account')}
      </button>

      <p className="tf-auth-switch">
        {tab === 'login'
          ? <>New here? <button onClick={() => { setTab('signup'); setErr(''); }}>Create an account</button></>
          : <>Already have an account? <button onClick={() => { setTab('login'); setErr(''); }}>Log in</button></>}
      </p>

      {!IS_LIVE() && (
        <div className="tf-demo-hint">
          <b>Demo mode.</b> Try the manager account — <code>maya@brightside.studio</code> / <code>taskflow</code> —
          or create a new one. <button onClick={fillDemo}>Fill demo login</button>
        </div>
      )}
    </AuthShell>
  );
}

/* ---------- accept an invite ---------- */
function AcceptInvite({ appName, token, onAuthed, onCancel }) {
  const [invite, setInvite] = useState(undefined); // undefined=loading, null=not found
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { Backend.getInvite(token).then(setInvite).catch(() => setInvite(null)); }, [token]);

  const canSubmit = invite && name.trim().length > 1 && password.length >= 6;
  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setErr('');
    try {
      const user = await Backend.signUp({ email: invite.email, password, name: name.trim(), inviteToken: token });
      onAuthed(user);
    } catch (e) {
      if (e.code === 'confirm') setErr('Check your email to confirm your account, then log in.');
      else setErr(e.message || 'Could not accept the invite.');
    } finally { setBusy(false); }
  };

  return (
    <AuthShell appName={appName}>
      <div className="tf-auth-brand">
        <div className="tf-logo"><Icon name="checkCircle" size={20} stroke={2.2} /></div>
        <b>{appName}</b>
      </div>

      {invite === undefined ? (
        <p className="tf-auth-sub">Checking your invite…</p>
      ) : invite === null || invite.accepted ? (
        <>
          <h1>Invite not found</h1>
          <p className="tf-auth-sub">This invite link is invalid or has already been used. Ask your manager to resend it, or log in if you already have an account.</p>
          <button className="tf-btn primary md full tf-auth-btn" onClick={onCancel}>Go to login</button>
        </>
      ) : (
        <>
          <div className="tf-invite-tag"><Icon name="mail" size={14} stroke={2} />You’ve been invited as <b>{invite.role === 'manager' ? 'a Manager' : 'a Member'}</b></div>
          <h1>Join {appName}</h1>
          <p className="tf-auth-sub">Set up your account for <b>{invite.email}</b>.</p>

          <label className="tf-auth-label">Full name</label>
          <div className="tf-auth-input"><Icon name="user" size={17} />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus />
          </div>
          <label className="tf-auth-label">Create a password</label>
          <div className="tf-auth-input"><Icon name="shield" size={17} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters" onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {err && <div className="tf-auth-error"><Icon name="clock" size={15} stroke={2} />{err}</div>}
          <button className="tf-btn primary md full tf-auth-btn" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? <><span className="tf-spinner"></span>Joining…</> : 'Join the team'}
          </button>
          <p className="tf-auth-switch"><button onClick={onCancel}>Use a different account</button></p>
        </>
      )}
    </AuthShell>
  );
}

/* ---------- invite teammates (managers) ---------- */
function InviteModal({ store, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [invites, setInvites] = useState([]);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = () => Backend.listInvites().then(setInvites).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const send = async () => {
    if (!emailOk || busy) return;
    setBusy(true);
    try {
      const inv = await Backend.createInvite({ email, role });
      const url = Backend.inviteLink(inv.token);
      setLink({ url, email: inv.email, role: inv.role });
      setEmail(''); setRole('member'); refresh();
    } catch (e) { store.flash && store.flash(e.message || 'Could not create invite', 'clock', 'review'); }
    finally { setBusy(false); }
  };
  const copy = (url) => { try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {} };
  const mailto = (to, url) => `mailto:${to}?subject=${encodeURIComponent('Join our ' + store.appName + ' board')}&body=${encodeURIComponent('You’ve been invited to our team task board. Set up your account here:\n\n' + url)}`;

  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-modal tf-invite-modal" onClick={e => e.stopPropagation()}>
        <div className="tf-modal-head">
          <div><div className="tf-modal-kicker">Team</div><h2>Invite a teammate</h2></div>
          <button className="tf-icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="tf-invite-body">
          <div className="tf-invite-form">
            <div className="tf-field full">
              <span>Their work email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@company.com"
                onKeyDown={e => e.key === 'Enter' && send()} />
            </div>
            <div className="tf-field">
              <span>Role</span>
              <div className="tf-prio-pick">
                <button className={'tf-role-opt' + (role === 'member' ? ' on' : '')} onClick={() => setRole('member')}>Member</button>
                <button className={'tf-role-opt' + (role === 'manager' ? ' on' : '')} onClick={() => setRole('manager')}>Manager</button>
              </div>
            </div>
            <button className="tf-btn primary md tf-invite-send" disabled={!emailOk || busy} onClick={send}>
              {busy ? <><span className="tf-spinner"></span>Creating…</> : <><Icon name="send" size={16} stroke={2} />Create invite</>}
            </button>
          </div>

          {link && (
            <div className="tf-invite-link">
              <div className="tf-invite-link-head"><Icon name="link" size={15} stroke={2} />Invite link for <b>{link.email}</b></div>
              <div className="tf-invite-link-row">
                <input readOnly value={link.url} onFocus={e => e.target.select()} />
                <button className="tf-btn default sm" onClick={() => copy(link.url)}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className="tf-invite-link-acts">
                <a className="tf-btn ghost sm" href={mailto(link.email, link.url)}><Icon name="mail" size={15} stroke={2} />Email it</a>
                <span className="tf-invite-fine">{IS_LIVE() ? 'Send this link to your teammate — they set their own password.' : 'Demo: open this link in a new tab to accept.'}</span>
              </div>
            </div>
          )}

          <div className="tf-invite-pending">
            <h3>Pending invites</h3>
            {invites.length === 0 ? (
              <p className="tf-invite-empty">No pending invites.</p>
            ) : invites.map(i => (
              <div key={i.token} className="tf-invite-row">
                <span className="tf-invite-av"><Icon name="mail" size={14} stroke={2} /></span>
                <div className="tf-invite-row-main"><b>{i.email}</b><span>{i.role === 'manager' ? 'Manager' : 'Member'} · pending</span></div>
                <button className="tf-btn ghost sm" onClick={() => copy(Backend.inviteLink(i.token))}>Copy link</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- profile ---------- */
function ProfileModal({ store, onClose, onLogout }) {
  const u = store.me;
  const [name, setName] = useState(u.name);
  const [title, setTitle] = useState(u.title);
  const [editing, setEditing] = useState(false);

  const mine = store.tasks;
  const inProgress = mine.filter(x => x.claimedBy === u.id && x.status === 'in_progress').length;
  const submitted = mine.filter(x => x.completedBy === u.id && x.status === 'pending_approval').length;
  const completed = mine.filter(x => x.completedBy === u.id && x.status === 'completed').length;
  const recent = mine.filter(x => x.claimedBy === u.id || x.completedBy === u.id || x.createdBy === u.id).slice(0, 5);

  const save = () => { store.updateProfile({ name: name.trim() || u.name, title: title.trim() || u.title }); setEditing(false); };

  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-modal tf-profile" onClick={e => e.stopPropagation()}>
        <div className="tf-profile-cover">
          <button className="tf-icon-btn tf-profile-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="tf-profile-head">
          <div className="tf-profile-av"><Avatar user={u} size={76} /></div>
          {editing ? (
            <div className="tf-profile-edit">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Role / title" />
              <div className="tf-profile-edit-acts">
                <button className="tf-btn ghost sm" onClick={() => { setName(u.name); setTitle(u.title); setEditing(false); }}>Cancel</button>
                <button className="tf-btn primary sm" onClick={save}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div className="tf-profile-name">
                <h2>{u.name}</h2>
                {u.role === 'manager' && <span className="tf-role-badge"><Icon name="shield" size={13} stroke={2} />Manager</span>}
              </div>
              <p className="tf-profile-title">{u.title}</p>
              <p className="tf-profile-email"><Icon name="mail" size={14} stroke={2} />{u.email || emailFor(u)}</p>
              <button className="tf-btn default sm tf-profile-editbtn" onClick={() => setEditing(true)}>
                <Icon name="edit" size={15} stroke={2} />Edit profile
              </button>
            </>
          )}
        </div>

        <div className="tf-profile-stats">
          <div className="tf-profile-stat"><b>{inProgress}</b><span>In progress</span></div>
          <div className="tf-profile-stat"><b>{submitted}</b><span>Awaiting review</span></div>
          <div className="tf-profile-stat"><b>{completed}</b><span>Completed</span></div>
        </div>

        <div className="tf-profile-body">
          <h3>Recent activity</h3>
          {recent.length === 0 ? (
            <p className="tf-profile-empty">No tasks yet — claim one from the board to get started.</p>
          ) : (
            <div className="tf-profile-list">
              {recent.map(x => {
                const role = x.completedBy === u.id ? 'completed' : x.claimedBy === u.id ? 'claimed' : 'created';
                const meta = { completed: ['check', 'Completed'], claimed: ['hand', 'Working on'], created: ['plus', 'Created'] }[role];
                return (
                  <button key={x.id} className="tf-profile-row" onClick={() => { onClose(); store.openDetail(x.id); }}>
                    <span className={'tf-profile-row-ic ' + role}><Icon name={meta[0]} size={14} stroke={2} /></span>
                    <span className="tf-profile-row-main"><b>{x.title}</b><span>{meta[1]} · {x.dept}</span></span>
                    <Icon name="chevron" size={15} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="tf-profile-foot">
          <button className="tf-btn ghost md tf-logout" onClick={onLogout}><Icon name="logOut" size={16} stroke={2} />Log out</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen, AcceptInvite, InviteModal, ProfileModal, emailFor });
