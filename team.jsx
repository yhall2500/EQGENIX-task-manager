/* ============================================================
   TaskFlow — Team (members) view + Team Chat view
   Talk to window.Backend; resolve names via TASKFLOW_DATA.USERS.
   ============================================================ */

/* ---------------- Team members ---------------- */
function TeamView({ store }) {
  const me = store.me;
  const isManager = me.role === 'manager';
  const members = store.members.slice().sort((a, b) => {
    if ((a.role === 'manager') !== (b.role === 'manager')) return a.role === 'manager' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const tasks = store.tasks;
  const managers = members.filter(m => m.role === 'manager').length;

  return (
    <div className="tf-team">
      <div className="tf-mgr-stats">
        <Stat n={members.length} label="Team members" tone="open" />
        <Stat n={managers} label="Managers" tone="review" />
        <Stat n={members.length - managers} label="Members" tone="progress" />
      </div>

      <div className="tf-team-grid">
        {members.map(u => {
          const active = tasks.filter(t => t.claimedBy === u.id && t.status === 'in_progress').length;
          const done = tasks.filter(t => t.completedBy === u.id && t.status === 'completed').length;
          const isMe = u.id === me.id;
          return (
            <div key={u.id} className="tf-member-card">
              <button className="tf-member-open" onClick={() => store.openMember(u.id)} title={`See what ${u.name.split(' ')[0]} is working on`}>
                <Icon name="chevron" size={16} />
              </button>
              <div className="tf-member-top">
                <Avatar user={u} size={48} />
                <div className="tf-member-id">
                  <div className="tf-member-name">{u.name}{isMe && <span className="tf-you-tag">You</span>}</div>
                  <div className="tf-member-title">{u.title}</div>
                </div>
                {u.role === 'manager'
                  ? <span className="tf-role-badge"><Icon name="shield" size={13} stroke={2} />Manager</span>
                  : <span className="tf-role-badge member">Member</span>}
              </div>
              <div className="tf-member-email"><Icon name="mail" size={14} stroke={2} />{u.email || emailFor(u)}</div>
              <div className="tf-member-stats">
                <div><b>{active}</b><span>In progress</span></div>
                <div><b>{done}</b><span>Completed</span></div>
              </div>
              {isManager && !isMe && (
                <div className="tf-member-acts">
                  {u.role === 'manager'
                    ? <Button size="sm" variant="ghost" icon="user" onClick={() => store.setRole(u.id, 'member')}>Make member</Button>
                    : <Button size="sm" variant="default" icon="shield" onClick={() => store.setRole(u.id, 'manager')}>Make manager</Button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isManager && (
        <div className="tf-team-invite-cta">
          <div>
            <b>Bring more of the team in</b>
            <span>Invite teammates by email — they set their own password and join EQGenix.</span>
          </div>
          <Button variant="primary" icon="users" onClick={store.openInvite}>Invite teammate</Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Team chat ---------------- */
function ChatView({ store }) {
  const me = store.me;
  const [messages, setMessages] = useState(null); // null = loading
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef();
  const bottomRef = useRef(true); // is user pinned to bottom?

  const load = async (initial) => {
    try {
      const msgs = await Backend.listMessages();
      setMessages(prev => {
        // only update if changed (avoid scroll jumps)
        if (prev && prev.length === msgs.length && prev.length && prev[prev.length - 1].id === msgs[msgs.length - 1].id) return prev;
        return msgs;
      });
    } catch (e) { setMessages([]); }
  };

  useEffect(() => {
    load(true);
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, []);

  // autoscroll to bottom when new messages arrive and user is near bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && bottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    bottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setText('');
    bottomRef.current = true;
    const optimistic = { id: 'tmp_' + Date.now(), userId: me.id, body, at: new Date(), pending: true };
    setMessages(list => [...(list || []), optimistic]);
    try { await Backend.sendMessage(body); await load(); }
    catch (e) { store.flash(e.message || 'Message failed to send', 'clock', 'review'); }
    finally { setSending(false); }
  };

  const dayKey = (d) => d.toDateString();
  const fmtDay = (d) => {
    const today = new Date(window.TASKFLOW_DATA.NOW).toDateString();
    if (d.toDateString() === today) return 'Today';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // group consecutive messages by same author within 5 min, and insert day dividers
  const rows = [];
  if (messages) {
    let lastDay = null, lastUser = null, lastAt = 0;
    messages.forEach(m => {
      const at = m.at instanceof Date ? m.at : new Date(m.at);
      const dk = dayKey(at);
      if (dk !== lastDay) { rows.push({ type: 'day', key: 'd' + dk, label: fmtDay(at) }); lastDay = dk; lastUser = null; }
      const grouped = m.userId === lastUser && (at.getTime() - lastAt) < 5 * 60000;
      rows.push({ type: 'msg', m, at, grouped });
      lastUser = m.userId; lastAt = at.getTime();
    });
  }

  return (
    <div className="tf-chat">
      <div className="tf-chat-head">
        <div className="tf-chat-head-ic"><Icon name="chat" size={18} stroke={2} /></div>
        <div>
          <h2>Team chat</h2>
          <p>{store.members.length} members · everyone in {store.appName} sees this channel</p>
        </div>
      </div>

      <div className="tf-chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {messages === null ? (
          <div className="tf-chat-loading"><span className="tf-spinner dark"></span></div>
        ) : messages.length === 0 ? (
          <div className="tf-chat-empty">
            <div className="tf-chat-empty-ic"><Icon name="chat" size={28} stroke={1.7} /></div>
            <b>No messages yet</b>
            <span>Say hello — this channel is shared with the whole team.</span>
          </div>
        ) : rows.map(r => r.type === 'day' ? (
          <div key={r.key} className="tf-chat-day"><span>{r.label}</span></div>
        ) : (() => {
          const u = userById(r.m.userId) || { name: 'Someone', color: '#999', id: r.m.userId };
          const mine = r.m.userId === me.id;
          return (
            <div key={r.m.id} className={'tf-msg' + (mine ? ' mine' : '') + (r.grouped ? ' grouped' : '')}>
              {!mine && <div className="tf-msg-av">{!r.grouped && <Avatar user={u} size={32} />}</div>}
              <div className="tf-msg-main">
                {!r.grouped && <div className="tf-msg-meta">{!mine && <b>{u.name.split(' ')[0]}</b>}<span>{fmtTime(r.at)}</span></div>}
                <div className={'tf-msg-bubble' + (r.m.pending ? ' pending' : '')}>{r.m.body}</div>
              </div>
            </div>
          );
        })())}
      </div>

      <div className="tf-chat-compose">
        <input value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${store.appName}…`}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="tf-chat-send" disabled={!text.trim() || sending} onClick={send}>
          <Icon name="send" size={18} stroke={2} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Member profile (viewable by teammates) ---------------- */
function MemberModal({ store, uid, onClose }) {
  const u = userById(uid);
  const me = store.me;
  if (!u) return null;
  const tasks = store.tasks;
  const working = tasks.filter(t => t.claimedBy === uid && t.status === 'in_progress');
  const submitted = tasks.filter(t => t.completedBy === uid && t.status === 'pending_approval');
  const assigned = tasks.filter(t => t.assignedTo === uid && t.status === 'open');
  const completed = tasks.filter(t => t.completedBy === uid && t.status === 'completed');
  const created = tasks.filter(t => t.createdBy === uid);
  const isMe = uid === me.id;

  const Row = ({ t, tag }) => (
    <button className="tf-member-task" onClick={() => { onClose(); store.openDetail(t.id); }}>
      <span className="tf-member-task-main"><b>{t.title}</b><span><DeptTag dept={t.dept} /> · {dueLabel(t.due).text}</span></span>
      <Icon name="chevron" size={15} />
    </button>
  );
  const Group = ({ title, items }) => items.length ? (
    <div className="tf-member-group">
      <h3>{title}<span className="tf-col-count">{items.length}</span></h3>
      <div className="tf-member-tasks">{items.map(t => <Row key={t.id} t={t} />)}</div>
    </div>
  ) : null;

  const nothing = !working.length && !submitted.length && !assigned.length && !completed.length;

  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className="tf-modal tf-profile" onClick={e => e.stopPropagation()}>
        <div className="tf-profile-cover">
          <button className="tf-icon-btn tf-profile-close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="tf-profile-head">
          <div className="tf-profile-av"><Avatar user={u} size={76} /></div>
          <div className="tf-profile-name">
            <h2>{u.name}{isMe && <span className="tf-you-tag">You</span>}</h2>
            {u.role === 'manager' && <span className="tf-role-badge"><Icon name="shield" size={13} stroke={2} />Manager</span>}
          </div>
          <p className="tf-profile-title">{u.title}</p>
          <p className="tf-profile-email"><Icon name="mail" size={14} stroke={2} />{u.email || emailFor(u)}</p>
        </div>

        <div className="tf-profile-stats">
          <div className="tf-profile-stat"><b>{working.length}</b><span>In progress</span></div>
          <div className="tf-profile-stat"><b>{submitted.length}</b><span>Awaiting review</span></div>
          <div className="tf-profile-stat"><b>{completed.length}</b><span>Completed</span></div>
        </div>

        <div className="tf-profile-body">
          {nothing ? (
            <p className="tf-profile-empty">{u.name.split(' ')[0]} hasn’t claimed or finished anything yet.</p>
          ) : (
            <>
              <Group title="Working on now" items={working} />
              <Group title="Submitted for review" items={submitted} />
              <Group title="Assigned, not started" items={assigned} />
              <Group title="Completed" items={completed.slice(0, 6)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TeamView, ChatView, MemberModal });