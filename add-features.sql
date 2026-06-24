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

-- ---------- 3. Managers can change anyone's role ----------
drop policy if exists "profiles_manager_update" on public.profiles;
create policy "profiles_manager_update" on public.profiles for update to authenticated
  using (public.is_manager());

-- ============================================================
--  Done. Reload the app — Team and Chat tabs are now live, and
--  managers can edit/delete tasks and promote/demote teammates.
-- ============================================================
