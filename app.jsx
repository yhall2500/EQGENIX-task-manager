/* ============================================================
   TaskFlow — App: boot, auth gating, store (state + actions
   backed by window.Backend), top bar, routing, tweaks.
   ============================================================ */
const D = window.TASKFLOW_DATA;
let _nid = 1;
const nid = () => 'n_' + _nid++;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#D9824F", "#fbf1e9", "#8a4a26"],
  "density": "regular",
  "appName": "EQGenix",
  "claimVerb": "Claim",
  "boardTitle": "Team board"
} /*EDITMODE-END*/;

function buildNotifs(tasks, me) {
  const out = [];
  const overdue = tasks.filter((t) => t.status === 'open' && t.due && new Date(t.due) < new Date(D.NOW));
  overdue.slice(0, 2).forEach((t) => out.push({ id: nid(), kind: 'overdue', text: `“${t.title}” is overdue and still unclaimed`, at: Date.now() - 3600000, read: false, taskId: t.id }));
  if (me.role === 'manager') {
    tasks.filter((t) => t.status === 'pending_approval').slice(0, 3).forEach((t) =>
    out.push({ id: nid(), kind: 'review', text: `“${t.title}” is waiting for your review`, at: Date.now() - 1800000, read: false, taskId: t.id }));
  }
  return out;
}

function Splash() {
  return (
    <div className="tf-splash">
      <div className="tf-logo lg"><Icon name="checkCircle" size={28} stroke={2.2} /></div>
      <span className="tf-spinner dark"></span>
    </div>);

}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ---- boot / auth ----
  const [phase, setPhase] = useState('booting'); // booting | auth | invite | ready
  const inviteToken = useMemo(() => new URLSearchParams(location.search).get('invite'), []);
  const [meId, setMeId] = useState(null);
  const [members, setMembers] = useState([]);
  const [rev, setRev] = useState(0);

  // ---- app state ----
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('board');
  const [layout, setLayout] = useState('board');
  const [filters, setFilters] = useState({ q: '', dept: 'All', mine: false });
  const [detailId, setDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [completeId, setCompleteId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [memberId, setMemberId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  // density + accent
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-density', t.density);
    const pal = t.palette || TWEAK_DEFAULTS.palette;
    r.style.setProperty('--primary', pal[0]);
    r.style.setProperty('--primary-soft', pal[1]);
    r.style.setProperty('--primary-deep', pal[2]);
  }, [t.density, t.palette]);

  // boot
  useEffect(() => {(async () => {
      await Backend.init();
      try {
        const u = await Backend.currentUser();
        if (u) {await loadWorkspace(u);setPhase('ready');} else
        setPhase(inviteToken ? 'invite' : 'auth');
      } catch (e) {setPhase(inviteToken ? 'invite' : 'auth');}
    })();}, []);

  async function loadWorkspace(u) {
    const [mem, tks] = await Promise.all([Backend.listMembers(), Backend.listTasks()]);
    window.TASKFLOW_DATA.USERS = mem;
    setMembers(mem);setMeId(u.id);setTasks(tks);setNotifs(buildNotifs(tks, u));
  }

  const onAuthed = async (u) => {
    if (inviteToken) history.replaceState({}, '', location.pathname);
    await loadWorkspace(u);setPhase('ready');
  };
  const logout = async () => {
    try {await Backend.signOut();} catch (e) {}
    setMeId(null);setMembers([]);setTasks([]);setProfileOpen(false);setUserMenu(false);setView('board');
    setPhase('auth');
  };

  // ---- helpers ----
  const flash = (text, icon = 'check', tone = 'done') => {
    setToast({ id: Date.now(), text, icon, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const onErr = (e) => flash(e && e.message || 'Couldn’t save — check your connection', 'clock', 'review');
  const pushNotif = (n) => setNotifs((list) => [{ id: nid(), at: Date.now(), read: false, ...n }, ...list]);
  const truncate = (s) => s.length > 26 ? s.slice(0, 24) + '…' : s;

  // ---- early returns (after all hooks) ----
  if (phase === 'booting') return <Splash />;
  if (phase === 'auth') return <AuthScreen appName={t.appName} onAuthed={onAuthed} />;
  if (phase === 'invite') return <AcceptInvite appName={t.appName} token={inviteToken} onAuthed={onAuthed} onCancel={() => setPhase('auth')} />;

  const me = userById(meId) || members[0];
  if (!me) return <Splash />;
  window.__TF = { claimVerb: t.claimVerb, rev };

  // ---- task mutations (optimistic local + persist via Backend) ----
  const patchTask = (id, nx, persist) => {
    setTasks((list) => list.map((x) => x.id === id ? nx : x));
    Backend.updateTask(id, persist).catch(onErr);
  };

  const store = {
    me, tasks, members, appName: t.appName, copy: { claimVerb: t.claimVerb },
    notifications: notifs, flash,

    claim(id) {
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const at = new Date();
      const activity = [...cur.activity, { type: 'claimed', by: meId, at }];
      patchTask(id, { ...cur, status: 'in_progress', claimedBy: meId, claimedAt: at, activity },
      { status: 'in_progress', claimedBy: meId, claimedAt: at, activity });
      flash(`Claimed “${truncate(cur.title)}” — it’s yours`, 'hand');
      pushNotif({ kind: 'claim', text: `You claimed “${cur.title}”`, taskId: id });
    },
    openComplete(id) {setCompleteId(id);},
    complete(id, note) {
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const review = cur.requiresApproval;const at = new Date();
      const activity = [...cur.activity, { type: 'completed', by: meId, at }];
      const nx = { ...cur, completedBy: meId, completedAt: at, completionNote: note || 'Marked complete.',
        status: review ? 'pending_approval' : 'completed', activity };
      patchTask(id, nx, { completedBy: meId, completedAt: at, completionNote: nx.completionNote, status: nx.status, activity });
      setCompleteId(null);
      if (review) {flash('Submitted for review ✦', 'checkCircle', 'review');pushNotif({ kind: 'review', text: `You submitted “${cur.title}” for review`, taskId: id });} else
      {flash(`Completed “${truncate(cur.title)}” 🎉`, 'check');pushNotif({ kind: 'done', text: `You completed “${cur.title}”`, taskId: id });}
    },
    approve(id) {
      if (me.role !== 'manager') {flash('Only managers can approve work', 'clock', 'review');return;}
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const at = new Date();
      const activity = [...cur.activity, { type: 'approved', by: meId, at }];
      patchTask(id, { ...cur, status: 'completed', approvedBy: meId, approvedAt: at, activity },
      { status: 'completed', approvedBy: meId, approvedAt: at, activity });
      flash(`Approved — logged to ${(userById(cur.completedBy) || me).name.split(' ')[0]}`, 'checkCircle');
    },
    reject(id) {
      if (me.role !== 'manager') {flash('Only managers can review work', 'clock', 'review');return;}
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const at = new Date();
      const activity = [...cur.activity, { type: 'reopened', by: meId, at }];
      patchTask(id, { ...cur, status: 'in_progress', completedBy: null, completedAt: null, completionNote: null, activity },
      { status: 'in_progress', completedBy: null, completedAt: null, completionNote: null, activity });
      flash('Sent back for changes', 'undo', 'review');
    },
    comment(id, text) {
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const comments = [...cur.comments, { by: meId, at: new Date(), text }];
      patchTask(id, { ...cur, comments }, { comments });
    },
    async createTask(data) {
      try {
        const task = await Backend.createTask(data);
        setTasks((list) => [task, ...list]);
        setCreateOpen(false);
        flash(`Posted “${truncate(task.title)}” to the board`, 'plus');
        pushNotif({ kind: 'new', text: `You posted “${task.title}”`, taskId: task.id });
      } catch (e) {onErr(e);}
    },
    editTask(id, data) {
      const cur = tasks.find((x) => x.id === id);if (!cur) return;
      const activity = [...cur.activity, { type: 'edited', by: meId, at: new Date() }];
      patchTask(id, { ...cur, ...data, activity }, { ...data, activity });
      setEditId(null);
      flash(`Updated “${truncate(data.title || cur.title)}”`, 'edit');
    },
    async deleteTask(id) {
      const cur = tasks.find((x) => x.id === id);
      setTasks((list) => list.filter((x) => x.id !== id));
      setDetailId(null);setEditId(null);
      try {await Backend.deleteTask(id);flash(`Deleted “${truncate(cur && cur.title || 'task')}”`, 'trash', 'review');}
      catch (e) {onErr(e);}
    },
    async setRole(uid, role) {
      const who = (members.find((x) => x.id === uid) || {}).name || 'Member';
      setMembers((list) => list.map((x) => x.id === uid ? { ...x, role } : x));
      window.TASKFLOW_DATA.USERS = window.TASKFLOW_DATA.USERS.map((x) => x.id === uid ? { ...x, role } : x);
      setRev((r) => r + 1);
      try {await Backend.setRole(uid, role);flash(`${who.split(' ')[0]} is now a ${role === 'manager' ? 'Manager' : 'Member'}`, role === 'manager' ? 'shield' : 'user');}
      catch (e) {onErr(e);}
    },
    async updateProfile(patch) {
      const m = members.find((x) => x.id === meId);
      const next = { ...m, ...patch };
      setMembers((list) => list.map((x) => x.id === meId ? next : x));
      window.TASKFLOW_DATA.USERS = window.TASKFLOW_DATA.USERS.map((x) => x.id === meId ? next : x);
      setRev((r) => r + 1);
      try {await Backend.updateProfile(patch);flash('Profile updated', 'check');} catch (e) {onErr(e);}
    },

    openDetail(id) {setDetailId(id);setNotifOpen(false);setProfileOpen(false);},
    closeDetail() {setDetailId(null);},
    openCreate() {setCreateOpen(true);},
    openEdit(id) {setDetailId(null);setEditId(id);},
    openInvite() {setInviteOpen(true);},
    openMember(uid) {setMemberId(uid);},
    closeModals() {setCreateOpen(false);setCompleteId(null);setEditId(null);},
    clearNotifs() {setNotifs((list) => list.map((n) => ({ ...n, read: true })));},

    completeId, detailId, editId,
    get filtered() {
      let list = tasks;
      const q = filters.q.trim().toLowerCase();
      if (q) list = list.filter((x) => (x.title + ' ' + x.desc + ' ' + x.dept).toLowerCase().includes(q));
      if (filters.dept !== 'All') list = list.filter((x) => x.dept === filters.dept);
      if (filters.mine) list = list.filter((x) => x.claimedBy === meId || x.completedBy === meId);
      return list;
    }
  };

  const unread = notifs.filter((n) => !n.read).length;
  const isManager = me.role === 'manager';
  const NAV = [
  { key: 'board', label: t.boardTitle, icon: 'board' },
  { key: 'mine', label: 'My tasks', icon: 'user' },
  { key: 'team', label: 'Team', icon: 'users' },
  { key: 'manager', label: 'Overview', icon: 'board' },
  { key: 'chat', label: 'Chat', icon: 'chat' }];


  return (
    <div className="tf-app">
      <header className="tf-top">
        <div className="tf-brand">
          <div className="tf-logo" style={{ backgroundColor: "rgb(61, 39, 193)" }}><Icon name="checkCircle" size={20} stroke={2.2} /></div>
          <div className="tf-brand-text"><b>{t.appName}</b><span>Task board</span></div>
        </div>

        <nav className="tf-nav">
          {NAV.map((n) =>
          <button key={n.key} className={'tf-nav-btn' + (view === n.key ? ' on' : '')} onClick={() => setView(n.key)}>
              <Icon name={n.icon} size={16} stroke={2} />{n.label}
              {n.key === 'manager' && isManager && tasks.filter((x) => x.status === 'pending_approval').length > 0 &&
            <span className="tf-nav-badge">{tasks.filter((x) => x.status === 'pending_approval').length}</span>}
            </button>
          )}
        </nav>

        <div className="tf-top-right">
          {isManager && <Button variant="default" size="sm" icon="users" onClick={() => setInviteOpen(true)}>Invite</Button>}
          <Button variant="primary" size="sm" icon="plus" onClick={store.openCreate}>New task</Button>
          <div className="tf-bell-wrap">
            <button className="tf-icon-btn lg" onClick={() => setNotifOpen((o) => !o)}>
              <Icon name="bell" size={19} />
              {unread > 0 && <span className="tf-bell-dot">{unread}</span>}
            </button>
            {notifOpen && <NotifPanel store={store} onClose={() => setNotifOpen(false)} />}
          </div>
          <div className="tf-user-wrap">
            <button className="tf-user-btn" onClick={() => setUserMenu((o) => !o)}>
              <Avatar user={me} size={32} />
              <div className="tf-user-meta"><b>{me.name.split(' ')[0]}</b><span>{isManager ? 'Manager' : me.title}</span></div>
              <Icon name="chevronDown" size={14} />
            </button>
            {userMenu &&
            <>
                <div className="tf-pop-scrim" onClick={() => setUserMenu(false)}></div>
                <div className="tf-usermenu">
                  <div className="tf-usermenu-me">
                    <Avatar user={me} size={40} />
                    <div className="tf-usermenu-me-info"><b>{me.name}</b><span>{me.email || emailFor(me)}</span></div>
                  </div>
                  <button className="tf-usermenu-action" onClick={() => {setProfileOpen(true);setUserMenu(false);}}>
                    <Icon name="user" size={16} stroke={2} />View profile
                  </button>
                  {isManager &&
                <button className="tf-usermenu-action" onClick={() => {setInviteOpen(true);setUserMenu(false);}}>
                      <Icon name="users" size={16} stroke={2} />Invite teammates
                    </button>
                }
                  <div className="tf-usermenu-sep"></div>
                  <button className="tf-usermenu-action danger" onClick={logout}>
                    <Icon name="logOut" size={16} stroke={2} />Log out
                  </button>
                </div>
              </>
            }
          </div>
        </div>
      </header>

      {view === 'board' &&
      <div className="tf-subbar">
          <div className="tf-search">
            <Icon name="search" size={16} />
            <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search tasks…" />
          </div>
          <div className="tf-subbar-right">
            <div className="tf-select sm">
              <select value={filters.dept} onChange={(e) => setFilters((f) => ({ ...f, dept: e.target.value }))}>
                <option>All</option>
                {D.DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <Icon name="chevronDown" size={14} />
            </div>
            <button className={'tf-chip' + (filters.mine ? ' on' : '')} onClick={() => setFilters((f) => ({ ...f, mine: !f.mine }))}>
              <Icon name="user" size={14} stroke={2} />Only mine
            </button>
            <div className="tf-layout-toggle">
              <button className={layout === 'board' ? 'on' : ''} onClick={() => setLayout('board')} title="Board"><Icon name="board" size={16} /></button>
              <button className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')} title="List"><Icon name="list" size={16} /></button>
            </div>
          </div>
        </div>
      }

      <main className={'tf-main view-' + view}>
        {view === 'board' &&
        <>
            <ViewHeader title={t.boardTitle} sub="Everything the team is working on, in one place. Claim what you can take." />
            {tasks.length === 0 ?
          <EmptyBoard onCreate={store.openCreate} /> :
          layout === 'board' ? <BoardView store={store} /> : <ListView store={store} />}
          </>
        }
        {view === 'mine' &&
        <>
            <ViewHeader title={`${me.name.split(' ')[0]}’s tasks`} sub="What you’ve claimed, what’s due, and everything you’ve finished." />
            <MyTasksView store={store} />
          </>
        }
        {view === 'manager' &&
        <>
            <ViewHeader title="Overview" sub="Who’s doing what, what’s overdue, and what’s waiting on a manager." />
            <ManagerView store={store} />
          </>
        }
        {view === 'team' &&
        <>
            <ViewHeader title="Team" sub="Everyone in your workspace, what they’re working on, and their role." />
            <TeamView store={store} />
          </>
        }
        {view === 'chat' && <ChatView store={store} />}
      </main>

      {createOpen && <CreateModal store={store} />}
      {editId && <EditModal store={store} />}
      {completeId && <CompleteModal store={store} />}
      {detailId && <TaskDetail store={store} />}
      {profileOpen && <ProfileModal store={store} onClose={() => setProfileOpen(false)} onLogout={logout} />}
      {memberId && <MemberModal store={store} uid={memberId} onClose={() => setMemberId(null)} />}
      {inviteOpen && <InviteModal store={store} onClose={() => setInviteOpen(false)} />}
      <Toast toast={toast} />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.palette}
        options={[
        ['#D9824F', '#fbf1e9', '#8a4a26'],
        ['#3FA779', '#e8f4ee', '#256a4c'],
        ['#B06AB3', '#f4ebf4', '#6e3d72'],
        ['#5B8DEF', '#eaf1fd', '#2f5bb0'],
        ['#C9533F', '#fbeae6', '#7e2f22']]
        }
        onChange={(v) => setTweak('palette', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']}
        onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Copy" />
        <TweakText label="Workspace name" value={t.appName} onChange={(v) => setTweak('appName', v)} />
        <TweakText label="Board tab label" value={t.boardTitle} onChange={(v) => setTweak('boardTitle', v)} />
        <TweakText label="Claim verb" value={t.claimVerb} onChange={(v) => setTweak('claimVerb', v)} />
      </TweaksPanel>
    </div>);

}

function ViewHeader({ title, sub }) {
  return (
    <div className="tf-viewhead">
      <h1 dangerouslySetInnerHTML={{ __html: title }}></h1>
      <p>{sub}</p>
    </div>);

}

function EmptyBoard({ onCreate }) {
  return (
    <div className="tf-empty-board">
      <div className="tf-empty-ic"><Icon name="board" size={30} stroke={1.8} /></div>
      <h2>Your board is empty</h2>
      <p>Post the first task and your team can start claiming work. Anything you add is shared with everyone in the workspace.</p>
      <Button variant="primary" size="md" icon="plus" onClick={onCreate}>Create the first task</Button>
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);