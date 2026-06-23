/* ============================================================
   TaskFlow — mock data + helpers (plain JS, attached to window)
   "Today" is anchored to Mon Jun 22 2026 for stable relative dates.
   ============================================================ */
(function () {
  const NOW = new Date('2026-06-22T09:15:00');
  const H = 3600 * 1000;
  const D = 24 * H;
  const ago = (ms) => new Date(NOW.getTime() - ms);
  const ahead = (ms) => new Date(NOW.getTime() + ms);

  // ---- Team -------------------------------------------------
  const USERS = [
    { id: 'u_maya',  name: 'Maya Okafor',    role: 'manager', title: 'Operations Lead',   color: '#D9824F' },
    { id: 'u_theo',  name: 'Theo Nguyen',    role: 'member',  title: 'Designer',           color: '#5B8DEF' },
    { id: 'u_priya', name: 'Priya Sharma',   role: 'member',  title: 'Marketing',          color: '#3FA779' },
    { id: 'u_sam',   name: 'Sam Reyes',      role: 'member',  title: 'Facilities',         color: '#B06AB3' },
    { id: 'u_jonah', name: 'Jonah Webb',     role: 'member',  title: 'Account Manager',    color: '#E0A33E' },
    { id: 'u_lina',  name: 'Lina Costa',     role: 'member',  title: 'Admin & Support',    color: '#D96A6A' },
  ];

  const DEPARTMENTS = ['Operations', 'Design', 'Marketing', 'Facilities', 'Admin', 'Client Work'];

  const PRIORITY = {
    urgent: { label: 'Urgent', rank: 3 },
    high:   { label: 'High',   rank: 2 },
    medium: { label: 'Medium', rank: 1 },
    low:    { label: 'Low',    rank: 0 },
  };

  // ---- Tasks ------------------------------------------------
  // status: open | in_progress | pending_approval | completed
  let _seq = 100;
  const id = () => 'task_' + (++_seq);

  const TASKS = [
    {
      id: id(), title: 'Restock the supply closet & kitchen',
      desc: 'We are out of printer paper, oat milk, and dish soap. Check the shelf inventory sheet, place the order with Staples + the grocery run, and update the count when it arrives.',
      dept: 'Facilities', priority: 'medium', estimate: '45 min',
      createdBy: 'u_maya', createdAt: ago(20 * H),
      due: ahead(2 * D), status: 'open', requiresApproval: false,
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'note', comments: [],
      activity: [{ type: 'created', by: 'u_maya', at: ago(20 * H) }],
    },
    {
      id: id(), title: 'Polish the Acme pitch deck (v3)',
      desc: 'Apply Maya’s feedback from the v2 review: tighten the problem slide, swap the stock photos for our own shots, and fix the pricing table alignment. Export to PDF when done.',
      dept: 'Design', priority: 'high', estimate: '2 hrs',
      createdBy: 'u_maya', createdAt: ago(28 * H),
      due: ahead(6 * H), status: 'in_progress', requiresApproval: true,
      claimedBy: 'u_theo', claimedAt: ago(3 * H), completedBy: null, completedAt: null,
      proof: 'file', comments: [
        { by: 'u_theo', at: ago(2 * H), text: 'On it — should have a draft by lunch.' },
      ],
      activity: [
        { type: 'created', by: 'u_maya', at: ago(28 * H) },
        { type: 'claimed', by: 'u_theo', at: ago(3 * H) },
      ],
    },
    {
      id: id(), title: 'Fix the broken link in the footer',
      desc: 'The "Careers" link on the homepage footer 404s. Point it to /careers and double-check the other footer links while you’re in there.',
      dept: 'Marketing', priority: 'low', estimate: '20 min',
      createdBy: 'u_priya', createdAt: ago(2 * D),
      due: ahead(3 * D), status: 'open', requiresApproval: false,
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'note', comments: [],
      activity: [{ type: 'created', by: 'u_priya', at: ago(2 * D) }],
    },
    {
      id: id(), title: 'Onboard new hire — set up accounts',
      desc: 'Devon starts Wednesday. Create their email, add to Slack + the shared drive, order a laptop, and book the Mon 1:1s. Use the onboarding checklist in Admin.',
      dept: 'Admin', priority: 'high', estimate: '1 hr',
      createdBy: 'u_maya', createdAt: ago(30 * H),
      due: ahead(1 * D), status: 'open', requiresApproval: false,
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'checklist', comments: [],
      activity: [{ type: 'created', by: 'u_maya', at: ago(30 * H) }],
    },
    {
      id: id(), title: 'Send the June client newsletter',
      desc: 'Draft is in the marketing folder. Proof it, schedule for Tuesday 10am, and segment out the churned accounts.',
      dept: 'Marketing', priority: 'medium', estimate: '90 min',
      createdBy: 'u_maya', createdAt: ago(4 * D),
      due: ahead(4 * H), status: 'in_progress', requiresApproval: false,
      claimedBy: 'u_priya', claimedAt: ago(26 * H), completedBy: null, completedAt: null,
      proof: 'note', comments: [],
      activity: [
        { type: 'created', by: 'u_maya', at: ago(4 * D) },
        { type: 'claimed', by: 'u_priya', at: ago(26 * H) },
      ],
    },
    {
      id: id(), title: 'Deep-clean the conference room',
      desc: 'Big client visit Thursday. Wipe the table + screen, vacuum, empty bins, restock whiteboard markers, and water the plants.',
      dept: 'Facilities', priority: 'urgent', estimate: '40 min',
      createdBy: 'u_maya', createdAt: ago(5 * H),
      due: ago(2 * H), status: 'open', requiresApproval: false, // OVERDUE
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'photo', comments: [],
      activity: [{ type: 'created', by: 'u_maya', at: ago(5 * H) }],
    },
    {
      id: id(), title: 'Reconcile last month’s expenses',
      desc: 'Match receipts to the card statement in the accounting sheet, flag anything missing, and submit to the bookkeeper.',
      dept: 'Operations', priority: 'medium', estimate: '1 hr',
      createdBy: 'u_maya', createdAt: ago(3 * D),
      due: ahead(5 * D), status: 'open', requiresApproval: false,
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'file', comments: [],
      activity: [{ type: 'created', by: 'u_maya', at: ago(3 * D) }],
    },
    {
      id: id(), title: 'Update the Riverside contract terms',
      desc: 'Legal sent revised payment terms. Update the contract doc, get Maya to review, then send to the client for signature.',
      dept: 'Client Work', priority: 'high', estimate: '50 min',
      createdBy: 'u_jonah', createdAt: ago(22 * H),
      due: ago(1 * D), status: 'in_progress', requiresApproval: true, // OVERDUE in progress
      claimedBy: 'u_jonah', claimedAt: ago(20 * H), completedBy: null, completedAt: null,
      proof: 'file', comments: [],
      activity: [
        { type: 'created', by: 'u_jonah', at: ago(22 * H) },
        { type: 'claimed', by: 'u_jonah', at: ago(20 * H) },
      ],
    },
    {
      id: id(), title: 'Photograph the new product samples',
      desc: 'Shoot the 6 new mugs on the white sweep for the shop listings. Edit, export web-sized, and drop in the product folder.',
      dept: 'Design', priority: 'medium', estimate: '90 min',
      createdBy: 'u_priya', createdAt: ago(2 * D),
      due: ago(4 * H), status: 'pending_approval', requiresApproval: true,
      claimedBy: 'u_theo', claimedAt: ago(28 * H),
      completedBy: 'u_theo', completedAt: ago(1 * H),
      proof: 'photo',
      completionNote: 'All 6 shot + edited. Files in /products/2026-06. Used the new softbox.',
      comments: [],
      activity: [
        { type: 'created', by: 'u_priya', at: ago(2 * D) },
        { type: 'claimed', by: 'u_theo', at: ago(28 * H) },
        { type: 'completed', by: 'u_theo', at: ago(1 * H) },
      ],
    },
    {
      id: id(), title: 'Book the team offsite venue',
      desc: 'Get 3 quotes for the August offsite (20 people, half-day). Share options in the team channel for a vote.',
      dept: 'Operations', priority: 'low', estimate: '1 hr',
      createdBy: 'u_maya', createdAt: ago(6 * D),
      due: ahead(7 * D), status: 'open', requiresApproval: false,
      claimedBy: null, claimedAt: null, completedBy: null, completedAt: null,
      proof: 'note', comments: [],
      activity: [{ type: 'created', by: 'u_maya', at: ago(6 * D) }],
    },
    {
      id: id(), title: 'Reset the meeting-room booking calendar',
      desc: 'Double-bookings again. Clear stale recurring holds and re-share the booking link with the team.',
      dept: 'Admin', priority: 'medium', estimate: '30 min',
      createdBy: 'u_lina', createdAt: ago(3 * D),
      due: ago(6 * H), status: 'completed', requiresApproval: false,
      claimedBy: 'u_lina', claimedAt: ago(2 * D),
      completedBy: 'u_lina', completedAt: ago(1 * D),
      proof: 'note',
      completionNote: 'Cleared 4 dead holds, re-shared the link in #general.',
      comments: [],
      activity: [
        { type: 'created', by: 'u_lina', at: ago(3 * D) },
        { type: 'claimed', by: 'u_lina', at: ago(2 * D) },
        { type: 'completed', by: 'u_lina', at: ago(1 * D) },
      ],
    },
    {
      id: id(), title: 'Refill the front-desk welcome packets',
      desc: 'Down to the last 3. Print 20 more, assemble with the branded folders, and stock the front desk drawer.',
      dept: 'Facilities', priority: 'low', estimate: '35 min',
      createdBy: 'u_maya', createdAt: ago(5 * D),
      due: ago(2 * D), status: 'completed', requiresApproval: true,
      claimedBy: 'u_sam', claimedAt: ago(4 * D),
      completedBy: 'u_sam', completedAt: ago(3 * D),
      approvedBy: 'u_maya', approvedAt: ago(2 * D + 5 * H),
      proof: 'photo',
      completionNote: 'Made 25, stocked the drawer. Photo attached.',
      comments: [],
      activity: [
        { type: 'created', by: 'u_maya', at: ago(5 * D) },
        { type: 'claimed', by: 'u_sam', at: ago(4 * D) },
        { type: 'completed', by: 'u_sam', at: ago(3 * D) },
        { type: 'approved', by: 'u_maya', at: ago(2 * D + 5 * H) },
      ],
    },
  ];

  window.TASKFLOW_DATA = {
    NOW, USERS, DEPARTMENTS, PRIORITY,
    TASKS,
    newId: id,
    business: 'Brightside Studio',
  };
})();
