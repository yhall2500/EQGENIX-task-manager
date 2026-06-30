-- ============================================================
--  TaskFlow — feature update: Team chat + delete tasks + role mgmt
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
--  Safe to run on your existing project (uses IF NOT EXISTS /
--  DROP POLICY ... so it won't clash with what's already there).
-- ============================================================

-- ---------- 1. Team chat: messages table ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;
grant select, insert on public.messages to authenticated;

-- any signed-in teammate can read the channel and post as themselves
drop policy if exists "messages_read"   on public.messages;
drop policy if exists "messages_insert" on public.messages;
create policy "messages_read"   on public.messages for select to authenticated using (true);
create policy "messages_insert" on public.messages for insert to authenticated with check (user_id = auth.uid());

-- ---------- 2. Delete tasks (managers, or the task's creator) ----------
grant delete on public.tasks to authenticated;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- ---------- 2b. Assign a task to a specific teammate ----------
alter table public.tasks add column if not exists assigned_to uuid references auth.users;

-- ---------- 2d. Recurring tasks ----------
alter table public.tasks add column if not exists recurrence text;

-- ---------- 2f. Completion proof file (photo / file URL) ----------
alter table public.tasks add column if not exists proof_url text;

-- Storage bucket for uploaded proof photos/files
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true)
  on conflict (id) do nothing;
drop policy if exists "proofs_read"   on storage.objects;
drop policy if exists "proofs_upload" on storage.objects;
create policy "proofs_read"   on storage.objects for select using (bucket_id = 'proofs');
create policy "proofs_upload" on storage.objects for insert to authenticated with check (bucket_id = 'proofs');

-- ---------- 2e. Cross-user notifications ----------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  recipient   uuid not null references auth.users on delete cascade,
  kind        text not null,
  text        text not null,
  task_id     uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.notifications enable row level security;
grant select, insert, update on public.notifications to authenticated;
drop policy if exists "notifications_read"   on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
-- you can read & update only your own; any teammate may create one addressed to you
create policy "notifications_read"   on public.notifications for select to authenticated using (recipient = auth.uid());
create policy "notifications_insert" on public.notifications for insert to authenticated with check (true);
create policy "notifications_update" on public.notifications for update to authenticated using (recipient = auth.uid());

-- ---------- 2c. Private personal to-do list (owner-only) ----------
create table if not exists public.personal_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users on delete cascade,
  title       text not null,
  done        boolean not null default false,
  due         timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.personal_tasks enable row level security;
grant select, insert, update, delete on public.personal_tasks to authenticated;
drop policy if exists "personal_all" on public.personal_tasks;
create policy "personal_all" on public.personal_tasks for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------- 3. Managers can change anyone's role ----------
drop policy if exists "profiles_manager_update" on public.profiles;
create policy "profiles_manager_update" on public.profiles for update to authenticated
  using (public.is_manager());

-- ============================================================
--  Done. Reload the app — Team and Chat tabs are now live, and
--  managers can edit/delete tasks and promote/demote teammates.
-- ============================================================
