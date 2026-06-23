/* ============================================================
   TaskFlow — panels: Create modal, Complete modal, Task detail
   slide-over, Notifications, Toast.
   ============================================================ */

// ---------- generic modal shell ----------
function Modal({ onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="tf-overlay" onClick={onClose}>
      <div className={'tf-modal' + (wide ? ' wide' : '')} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------- create task ----------
function CreateModal({ store }) {
  const me = store.me;
  const D = window.TASKFLOW_DATA;
  const [f, setF] = useState({
    title: '', desc: '', dept: D.DEPARTMENTS[0], priority: 'medium',
    estimate: '1 hr', due: '2026-06-24', dueTime: '17:00',
    proof: 'note', requiresApproval: false,
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const valid = f.title.trim().length > 2;

  const submit = () => {
    if (!valid) return;
    store.createTask({
      title: f.title.trim(),
      desc: f.desc.trim() || 'No description provided.',
      dept: f.dept, priority: f.priority, estimate: f.estimate,
      due: new Date(`${f.due}T${f.dueTime}`),
      proof: f.proof, requiresApproval: f.requiresApproval,
    });
  };

  return (
    <Modal onClose={store.closeModals} wide>
      <div className="tf-modal-head">
        <div>
          <div className="tf-modal-kicker">New task</div>
          <h2>Add work to the board</h2>
        </div>
        <button className="tf-icon-btn" onClick={store.closeModals}><Icon name="x" size={18} /></button>
      </div>

      <div className="tf-form">
        <label className="tf-field full">
          <span>Task title</span>
          <input autoFocus value={f.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Restock the supply closet" />
        </label>
        <label className="tf-field full">
          <span>Description &amp; instructions</span>
          <textarea rows="3" value={f.desc} onChange={e => set('desc', e.target.value)}
            placeholder="What needs doing, where things are, what ‘done’ looks like…" />
        </label>

        <label className="tf-field">
          <span>Department</span>
          <div className="tf-select">
            <select value={f.dept} onChange={e => set('dept', e.target.value)}>
              {D.DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <Icon name="chevronDown" size={15} />
          </div>
        </label>
        <label className="tf-field">
          <span>Priority</span>
          <div className="tf-prio-pick">
            {['low', 'medium', 'high', 'urgent'].map(p => (
              <button key={p} type="button" className={'tf-prio-opt ' + p + (f.priority === p ? ' on' : '')}
                onClick={() => set('priority', p)}>{D.PRIORITY[p].label}</button>
            ))}
          </div>
        </label>

        <label className="tf-field">
          <span>Due date</span>
          <input type="date" value={f.due} onChange={e => set('due', e.target.value)} />
        </label>
        <label className="tf-field">
          <span>Due time</span>
          <input type="time" value={f.dueTime} onChange={e => set('dueTime', e.target.value)} />
        </label>

        <label className="tf-field">
          <span>Estimated time</span>
          <input value={f.estimate} onChange={e => set('estimate', e.target.value)} placeholder="e.g. 45 min" />
        </label>
        <label className="tf-field">
          <span>Proof on completion</span>
          <div className="tf-select">
            <select value={f.proof} onChange={e => set('proof', e.target.value)}>
              <option value="note">Completion note</option>
              <option value="photo">Photo</option>
              <option value="file">File upload</option>
              <option value="checklist">Checklist confirm</option>
            </select>
            <Icon name="chevronDown" size={15} />
          </div>
        </label>

        <label className="tf-check full" onClick={() => set('requiresApproval', !f.requiresApproval)}>
          <span className={'tf-checkbox' + (f.requiresApproval ? ' on' : '')}>{f.requiresApproval && <Icon name="check" size={13} stroke={3} />}</span>
          <span className="tf-check-text"><b>Require manager approval</b> before it counts as done</span>
        </label>
      </div>

      <div className="tf-modal-foot">
        <span className="tf-foot-note">Posted to the whole team — anyone can claim it.</span>
        <div className="tf-foot-acts">
          <Button variant="ghost" onClick={store.closeModals}>Cancel</Button>
          <Button variant="primary" icon="plus" disabled={!valid} onClick={submit}>Post task</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- complete task ----------
function CompleteModal({ store }) {
  const task = store.tasks.find(t => t.id === store.completeId);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  if (!task) return null;
  const needsProof = task.proof;
  const proofReady = needsProof === 'note' ? note.trim().length > 0
    : needsProof === 'checklist' ? checked
    : checked; // photo/file simulated by an "attached" toggle

  const proofCopy = {
    note: 'Add a short completion note',
    photo: 'Attach a photo as proof',
    file: 'Attach the finished file',
    checklist: 'Confirm every step is done',
  };

  return (
    <Modal onClose={store.closeModals}>
      <div className="tf-modal-head">
        <div>
          <div className="tf-modal-kicker">Mark complete</div>
          <h2>{task.title}</h2>
        </div>
        <button className="tf-icon-btn" onClick={store.closeModals}><Icon name="x" size={18} /></button>
      </div>

      <div className="tf-complete-body">
        <div className="tf-complete-proof">
          <div className="tf-proof-head"><ProofTag proof={task.proof} /><span>{proofCopy[task.proof]}</span></div>

          {task.proof === 'note' && (
            <textarea autoFocus rows="3" value={note} onChange={e => setNote(e.target.value)}
              placeholder="What did you do? Anything the next person should know?" />
          )}
          {(task.proof === 'photo' || task.proof === 'file') && (
            <button type="button" className={'tf-drop' + (checked ? ' on' : '')} onClick={() => setChecked(c => !c)}>
              <Icon name={task.proof === 'photo' ? 'camera' : 'paperclip'} size={22} />
              {checked ? <span><b>{task.proof === 'photo' ? 'photo.jpg' : 'final-file.pdf'}</b> attached · click to remove</span>
                       : <span>Click to attach {task.proof === 'photo' ? 'a photo' : 'a file'}</span>}
            </button>
          )}
          {task.proof === 'checklist' && (
            <button type="button" className={'tf-checkrow' + (checked ? ' on' : '')} onClick={() => setChecked(c => !c)}>
              <span className={'tf-checkbox' + (checked ? ' on' : '')}>{checked && <Icon name="check" size={13} stroke={3} />}</span>
              I confirm every step of this task is finished
            </button>
          )}
          {task.proof !== 'note' && (
            <textarea rows="2" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Optional note…" style={{ marginTop: 10 }} />
          )}
        </div>

        {task.requiresApproval && (
          <div className="tf-approve-hint"><Icon name="checkCircle" size={15} />This task needs <b>{userById(task.createdBy).name.split(' ')[0]}</b>’s approval — it’ll move to <b>Needs review</b> first.</div>
        )}
      </div>

      <div className="tf-modal-foot">
        <span className="tf-foot-note">Logged as <b>you</b>, {new Date(window.TASKFLOW_DATA.NOW).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
        <div className="tf-foot-acts">
          <Button variant="ghost" onClick={store.closeModals}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!proofReady}
            onClick={() => store.complete(task.id, note.trim())}>
            {task.requiresApproval ? 'Submit for review' : 'Complete task'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- task detail slide-over ----------
function TaskDetail({ store }) {
  const task = store.tasks.find(t => t.id === store.detailId);
  const [comment, setComment] = useState('');
  if (!task) return null;
  const me = store.me;
  const due = dueLabel(task.due);
  const action = taskAction(task, me);
  const creator = userById(task.createdBy);

  const primary = () => {
    if (action.key === 'claim') store.claim(task.id);
    else if (action.key === 'complete') { store.closeDetail(); store.openComplete(task.id); }
    else if (action.key === 'review') {/* handled by approve/reject buttons below */}
  };

  return (
    <div className="tf-sheet-overlay" onClick={store.closeDetail}>
      <aside className="tf-sheet" onClick={e => e.stopPropagation()}>
        <header className="tf-sheet-head">
          <button className="tf-icon-btn" onClick={store.closeDetail}><Icon name="arrowLeft" size={18} /></button>
          <StatusBadge status={task.status} />
          <div className="tf-sheet-head-tags">
            <PriorityTag priority={task.priority} /><DeptTag dept={task.dept} />
          </div>
        </header>

        <div className="tf-sheet-body">
          <h1 className="tf-sheet-title">{task.title}</h1>

          <div className="tf-sheet-facts">
            <div className="tf-fact"><span>Due</span><b className={'fact-due ' + due.state}>{due.full || 'No date'}</b></div>
            <div className="tf-fact"><span>Estimate</span><b>{task.estimate}</b></div>
            <div className="tf-fact"><span>Proof</span><b><ProofTag proof={task.proof} /></b></div>
            <div className="tf-fact"><span>Approval</span><b>{task.requiresApproval ? 'Required' : 'Not needed'}</b></div>
          </div>

          <section className="tf-sheet-sec">
            <h3>Instructions</h3>
            <p className="tf-sheet-desc">{task.desc}</p>
          </section>

          {(task.completionNote) && (
            <section className="tf-sheet-sec">
              <h3>Completion proof</h3>
              <div className="tf-proof-card">
                <div className="tf-proof-card-head"><ProofTag proof={task.proof} /><span>Submitted by {userById(task.completedBy)?.name.split(' ')[0]} · {relTime(task.completedAt)}</span></div>
                <p>{task.completionNote}</p>
                {(task.proof === 'photo' || task.proof === 'file') && (
                  <div className="tf-proof-file"><Icon name={task.proof === 'photo' ? 'camera' : 'paperclip'} size={15} />{task.proof === 'photo' ? 'completion-photo.jpg' : 'completed-file.pdf'}</div>
                )}
              </div>
            </section>
          )}

          <section className="tf-sheet-sec">
            <h3>Activity</h3>
            <div className="tf-timeline">
              {task.activity.map((a, i) => (
                <div key={i} className="tf-tl-row">
                  <Avatar user={userById(a.by)} size={26} />
                  <div className="tf-tl-text">
                    <span><b>{userById(a.by).name.split(' ')[0]}</b> {activityVerb(a.type)} this task</span>
                    <span className="tf-tl-time">{relTime(a.at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="tf-sheet-sec">
            <h3>Comments</h3>
            {task.comments.length === 0 && <p className="tf-empty-comment">No comments yet.</p>}
            <div className="tf-comments">
              {task.comments.map((c, i) => (
                <div key={i} className="tf-comment">
                  <Avatar user={userById(c.by)} size={26} />
                  <div className="tf-comment-bubble">
                    <div className="tf-comment-head"><b>{userById(c.by).name.split(' ')[0]}</b><span>{relTime(c.at)}</span></div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="tf-comment-input">
              <Avatar user={me} size={26} />
              <input value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Add a comment…" onKeyDown={e => { if (e.key === 'Enter' && comment.trim()) { store.comment(task.id, comment.trim()); setComment(''); } }} />
              <button className="tf-send" disabled={!comment.trim()}
                onClick={() => { if (comment.trim()) { store.comment(task.id, comment.trim()); setComment(''); } }}><Icon name="chevron" size={16} stroke={2.4} /></button>
            </div>
          </section>
        </div>

        <footer className="tf-sheet-foot">
          {task.status === 'open' && (
            <>
              <div className="tf-sheet-foot-note"><Icon name="users" size={15} stroke={2} />Open to the team · created by {creator.name.split(' ')[0]}</div>
              <Button variant="primary" icon="hand" onClick={primary}>Claim this task</Button>
            </>
          )}
          {task.status === 'in_progress' && task.claimedBy === me.id && (
            <>
              <div className="tf-sheet-foot-note">You claimed this {relTime(task.claimedAt)}</div>
              <Button variant="primary" icon="check" onClick={primary}>Mark complete</Button>
            </>
          )}
          {task.status === 'in_progress' && task.claimedBy !== me.id && (
            <div className="tf-sheet-foot-note solo"><Avatar user={userById(task.claimedBy)} size={24} />{userById(task.claimedBy).name.split(' ')[0]} is on it · claimed {relTime(task.claimedAt)}</div>
          )}
          {task.status === 'pending_approval' && me.role === 'manager' && (
            <>
              <div className="tf-sheet-foot-note">Submitted by {userById(task.completedBy).name.split(' ')[0]} · review it</div>
              <div className="tf-foot-acts">
                <Button variant="ghost" icon="undo" onClick={() => store.reject(task.id)}>Send back</Button>
                <Button variant="primary" icon="check" onClick={() => store.approve(task.id)}>Approve</Button>
              </div>
            </>
          )}
          {task.status === 'pending_approval' && me.role !== 'manager' && (
            <div className="tf-sheet-foot-note solo"><Icon name="clock" size={15} />Waiting on {userById(task.createdBy).name.split(' ')[0]} to review</div>
          )}
          {task.status === 'completed' && (
            <div className="tf-sheet-foot-note done"><Icon name="checkCircle" size={16} />Completed by {userById(task.completedBy).name.split(' ')[0]} · {relTime(task.completedAt)}{task.approvedBy ? ` · approved by ${userById(task.approvedBy).name.split(' ')[0]}` : ''}</div>
          )}
        </footer>
      </aside>
    </div>
  );
}

// ---------- notifications ----------
function NotifPanel({ store, onClose }) {
  const me = store.me;
  const items = store.notifications;
  return (
    <>
      <div className="tf-pop-scrim" onClick={onClose}></div>
      <div className="tf-notif">
        <div className="tf-notif-head"><h3>Notifications</h3><button className="tf-link" onClick={store.clearNotifs}>Mark all read</button></div>
        <div className="tf-notif-list">
          {items.length === 0 && <div className="tf-notif-empty">You’re all caught up.</div>}
          {items.map((n) => (
            <div key={n.id} className={'tf-notif-row' + (n.read ? '' : ' unread')}
              onClick={() => { if (n.taskId) store.openDetail(n.taskId); onClose(); }}>
              <div className={'tf-notif-ic ' + n.kind}><Icon name={n.icon} size={15} stroke={2} /></div>
              <div className="tf-notif-text"><p>{n.text}</p><span>{relTime(n.at)}</span></div>
              {!n.read && <span className="tf-notif-dot"></span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------- toast ----------
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="tf-toast" key={toast.id}>
      <div className={'tf-toast-ic ' + (toast.tone || 'done')}><Icon name={toast.icon || 'check'} size={16} stroke={2.4} /></div>
      <span>{toast.text}</span>
    </div>
  );
}

Object.assign(window, { Modal, CreateModal, CompleteModal, TaskDetail, NotifPanel, Toast });
