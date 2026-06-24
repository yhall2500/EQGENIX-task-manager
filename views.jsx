/* ============================================================
   TaskFlow — views: TaskCard, Board, List, My Tasks, Manager
   Requires React + ui.jsx globals.
   Props pattern: components receive { store } with state + actions.
   ============================================================ */

// ---------- contextual action for a task ----------
function taskAction(task, me) {
  const claimVerb = (window.__TF && window.__TF.claimVerb) || 'Claim';
  if (task.status === 'open') return { key: 'claim', label: claimVerb + ' task', icon: 'hand', variant: 'primary' };
  if (task.status === 'in_progress') {
    if (task.claimedBy === me.id) return { key: 'complete', label: 'Mark complete', icon: 'check', variant: 'primary' };
    return { key: 'view', label: 'Open', icon: null, variant: 'ghost' };
  }
  if (task.status === 'pending_approval') {
    if (me.role === 'manager') return { key: 'review', label: 'Review', icon: 'checkCircle', variant: 'primary' };
    return { key: 'view', label: 'Awaiting review', icon: 'clock', variant: 'ghost' };
  }
  return { key: 'view', label: 'View', icon: null, variant: 'ghost' };
}

// ---------- task card ----------
function TaskCard({ task, store }) {
  const me = store.me;
  const action = taskAction(task, me);
  const due = dueLabel(task.due);
  const claimer = userById(task.claimedBy);
  const doer = userById(task.completedBy);
  const assignee = task.assignedTo ? userById(task.assignedTo) : null;
  const overdue = due.state === 'overdue' && task.status !== 'completed';

  const onAction = (e) => {
    e.stopPropagation();
    if (action.key === 'claim') store.claim(task.id);
    else if (action.key === 'complete') store.openComplete(task.id);
    else if (action.key === 'review') store.openDetail(task.id);
    else store.openDetail(task.id);
  };

  return (
    <article className={'tf-card' + (overdue ? ' is-overdue' : '')} onClick={() => store.openDetail(task.id)}>
      <div className="tf-card-top">
        <PriorityTag priority={task.priority} />
        <DeptTag dept={task.dept} />
      </div>
      <h3 className="tf-card-title">{task.title}</h3>
      <p className="tf-card-desc">{task.desc}</p>

      <div className="tf-card-meta">
        <span className={'tf-due ' + due.state}><Icon name="clock" size={13} stroke={2} />{due.text}</span>
        <span className="tf-est"><Icon name="sparkle" size={12} stroke={2} />{task.estimate}</span>
        {task.requiresApproval && <ProofTag proof={task.proof} />}
      </div>

      <div className="tf-card-foot">
        <div className="tf-card-who">
          {task.status === 'completed' || task.status === 'pending_approval' ? (
            doer ? <><Avatar user={doer} size={24} /><span className="tf-who-label">{task.status === 'completed' ? 'Done by' : 'Submitted by'} <b>{doer.name.split(' ')[0]}</b></span></> : null
          ) : claimer ? (
            <><Avatar user={claimer} size={24} /><span className="tf-who-label">Claimed by <b>{claimer.id === me.id ? 'you' : claimer.name.split(' ')[0]}</b></span></>
          ) : assignee ? (
            <><Avatar user={assignee} size={24} /><span className="tf-who-label">For <b>{assignee.id === me.id ? 'you' : assignee.name.split(' ')[0]}</b></span></>
          ) : (
            <span className="tf-who-label muted"><Icon name="users" size={14} stroke={2} />Open to the team</span>
          )}
        </div>
        <Button size="sm" variant={action.variant} icon={action.icon} onClick={onAction}
          disabled={action.key === 'view' && action.label === 'Awaiting review'}>
          {action.label}
        </Button>
      </div>
    </article>
  );
}

// ---------- board ----------
const COLUMNS = [
  { status: 'open',             title: 'Open',        hint: 'Up for grabs' },
  { status: 'in_progress',      title: 'In progress', hint: 'Being worked on' },
  { status: 'pending_approval', title: 'Needs review',hint: 'Awaiting a manager' },
  { status: 'completed',        title: 'Completed',   hint: 'Done & logged' },
];

function BoardColumn({ col, tasks, store }) {
  return (
    <section className={'tf-col ' + col.status}>
      <header className="tf-col-head">
        <div>
          <h2>{col.title}<span className="tf-col-count">{tasks.length}</span></h2>
          <p>{col.hint}</p>
        </div>
        {col.status === 'open' && (
          <button className="tf-col-add" title="New task" onClick={store.openCreate}><Icon name="plus" size={16} stroke={2.4} /></button>
        )}
      </header>
      <div className="tf-col-body">
        {tasks.length === 0 ? (
          <div className="tf-col-empty">Nothing here</div>
        ) : tasks.map(t => <TaskCard key={t.id} task={t} store={store} />)}
      </div>
    </section>
  );
}

function BoardView({ store }) {
  const tasks = store.filtered;
  const byStatus = (s) => tasks.filter(t => t.status === s)
    .sort((a, b) => (new Date(a.due) - new Date(b.due)));
  return (
    <div className="tf-board">
      {COLUMNS.map(col => <BoardColumn key={col.status} col={col} tasks={byStatus(col.status)} store={store} />)}
    </div>
  );
}

// ---------- list view ----------
function ListRow({ task, store }) {
  const me = store.me;
  const action = taskAction(task, me);
  const due = dueLabel(task.due);
  const who = userById(task.completedBy) || userById(task.claimedBy);
  const overdue = due.state === 'overdue' && task.status !== 'completed';
  const onAction = (e) => {
    e.stopPropagation();
    if (action.key === 'claim') store.claim(task.id);
    else if (action.key === 'complete') store.openComplete(task.id);
    else store.openDetail(task.id);
  };
  return (
    <tr className={'tf-row' + (overdue ? ' is-overdue' : '')} onClick={() => store.openDetail(task.id)}>
      <td className="c-title">
        <div className="tf-row-title">{task.title}</div>
        <div className="tf-row-sub"><DeptTag dept={task.dept} /><PriorityTag priority={task.priority} /></div>
      </td>
      <td><StatusBadge status={task.status} /></td>
      <td className={'c-due ' + due.state}>{due.text}</td>
      <td className="c-who">{who ? <Avatar user={who} size={26} /> : <span className="muted">—</span>}</td>
      <td className="c-act">
        <Button size="sm" variant={action.variant} icon={action.icon} onClick={onAction}
          disabled={action.label === 'Awaiting review'}>{action.label}</Button>
      </td>
    </tr>
  );
}

function ListView({ store }) {
  const tasks = store.filtered.slice().sort((a, b) => {
    const order = { open: 0, in_progress: 1, pending_approval: 2, completed: 3 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.due) - new Date(b.due);
  });
  return (
    <div className="tf-listwrap">
      <table className="tf-list">
        <thead><tr><th>Task</th><th>Status</th><th>Due</th><th>Owner</th><th></th></tr></thead>
        <tbody>
          {tasks.map(t => <ListRow key={t.id} task={t} store={store} />)}
          {tasks.length === 0 && <tr><td colSpan="5" className="tf-list-empty">No tasks match your filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------- my tasks ----------
function MyTasksView({ store }) {
  const me = store.me;
  const mine = store.tasks.filter(t => t.claimedBy === me.id || t.completedBy === me.id);
  const active = mine.filter(t => t.status === 'in_progress');
  const review = mine.filter(t => t.status === 'pending_approval');
  const done = mine.filter(t => t.status === 'completed');
  const dueToday = active.filter(t => dueLabel(t.due).state !== 'ok');
  const assigned = store.tasks.filter(t => t.assignedTo === me.id && t.status === 'open');

  const Section = ({ title, items, empty }) => (
    <div className="tf-my-section">
      <h2>{title}<span className="tf-col-count">{items.length}</span></h2>
      {items.length ? (
        <div className="tf-my-grid">{items.map(t => <TaskCard key={t.id} task={t} store={store} />)}</div>
      ) : <p className="tf-my-empty">{empty}</p>}
    </div>
  );

  return (
    <div className="tf-my">
      <div className="tf-my-stats">
        <Stat n={active.length} label="In progress" tone="progress" />
        <Stat n={assigned.length} label="Assigned to you" tone="open" />
        <Stat n={dueToday.length} label="Due soon / overdue" tone="overdue" />
        <Stat n={review.length} label="Awaiting review" tone="review" />
        <Stat n={done.length} label="Completed" tone="done" />
      </div>
      {assigned.length > 0 && <Section title="Assigned to you — not started" items={assigned} empty="" />}
      <Section title="Working on now" items={active} empty="You haven’t claimed anything yet — grab a task from the board." />
      {review.length > 0 && <Section title="Submitted, awaiting review" items={review} empty="" />}
      <Section title="Your completed work" items={done} empty="Completed tasks you finish will be logged here." />
    </div>
  );
}

function Stat({ n, label, tone }) {
  return (
    <div className={'tf-stat ' + (tone || '')}>
      <div className="tf-stat-n">{n}</div>
      <div className="tf-stat-l">{label}</div>
    </div>
  );
}

// ---------- manager overview ----------
function ManagerView({ store }) {
  const tasks = store.tasks;
  const open = tasks.filter(t => t.status === 'open');
  const wip = tasks.filter(t => t.status === 'in_progress');
  const review = tasks.filter(t => t.status === 'pending_approval');
  const overdue = tasks.filter(t => dueLabel(t.due).state === 'overdue' && t.status !== 'completed');
  const doneToday = tasks.filter(t => t.status === 'completed');

  // leaderboard: completions per user
  const board = window.TASKFLOW_DATA.USERS.map(u => ({
    u, claimed: tasks.filter(t => t.claimedBy === u.id).length,
    done: tasks.filter(t => t.completedBy === u.id).length,
  })).filter(x => x.claimed || x.done).sort((a, b) => b.done - a.done || b.claimed - a.claimed);

  // recent activity across all tasks
  const feed = [];
  tasks.forEach(t => t.activity.forEach(a => feed.push({ ...a, task: t })));
  feed.sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="tf-mgr">
      <div className="tf-mgr-stats">
        <Stat n={open.length} label="Open & unclaimed" tone="open" />
        <Stat n={wip.length} label="In progress" tone="progress" />
        <Stat n={overdue.length} label="Overdue" tone="overdue" />
        <Stat n={review.length} label="Waiting on you" tone="review" />
        <Stat n={doneToday.length} label="Completed" tone="done" />
      </div>

      <div className="tf-mgr-grid">
        <div className="tf-panel">
          <h2>Waiting for your approval</h2>
          {review.length ? review.map(t => {
            const doer = userById(t.completedBy);
            return (
              <div key={t.id} className="tf-approve-row" onClick={() => store.openDetail(t.id)}>
                <Avatar user={doer} size={32} />
                <div className="tf-approve-main">
                  <div className="tf-approve-title">{t.title}</div>
                  <div className="tf-approve-sub">{doer.name.split(' ')[0]} submitted {relTime(t.completedAt)}</div>
                </div>
                <div className="tf-approve-acts" onClick={e => e.stopPropagation()}>
                  {store.me.role === 'manager' ? (
                    <>
                      <Button size="sm" variant="ghost" icon="undo" onClick={() => store.reject(t.id)}>Send back</Button>
                      <Button size="sm" variant="primary" icon="check" onClick={() => store.approve(t.id)}>Approve</Button>
                    </>
                  ) : (
                    <span className="tf-await-pill"><Icon name="clock" size={13} stroke={2} />Awaiting manager</span>
                  )}
                </div>
              </div>
            );
          }) : <p className="tf-my-empty">Nothing waiting — you’re all caught up. 🎉</p>}
        </div>

        <div className="tf-panel">
          <h2>Who’s doing what</h2>
          <div className="tf-leaders">
            {board.map(({ u, claimed, done }) => (
              <div key={u.id} className="tf-leader">
                <Avatar user={u} size={32} />
                <div className="tf-leader-main">
                  <div className="tf-leader-name">{u.name}<span className="tf-leader-title">{u.title}</span></div>
                  <div className="tf-leader-bars">
                    <span className="tf-leader-stat"><b>{claimed}</b> active</span>
                    <span className="tf-leader-stat"><b>{done}</b> completed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tf-panel tf-panel-wide">
          <h2>Recent activity</h2>
          <div className="tf-feed">
            {feed.slice(0, 14).map((a, i) => (
              <div key={i} className="tf-feed-row" onClick={() => store.openDetail(a.task.id)}>
                <Avatar user={userById(a.by)} size={26} />
                <div className="tf-feed-text">
                  <b>{userById(a.by).name.split(' ')[0]}</b> {activityVerb(a.type)} <span className="tf-feed-task">{a.task.title}</span>
                </div>
                <span className="tf-feed-time">{relTime(a.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function activityVerb(type) {
  return ({
    created: 'created', claimed: 'claimed', completed: 'submitted', approved: 'approved', reopened: 'reopened', commented: 'commented on', edited: 'edited',
  })[type] || type;
}

Object.assign(window, {
  TaskCard, BoardView, ListView, MyTasksView, ManagerView, Stat, taskAction, activityVerb,
});
