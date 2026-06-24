-- ============================================================
--  TaskFlow — Supabase schema
--  Run this ONCE in your Supabase project:
--    Dashboard → SQL Editor → New query → paste → Run
--  Creates: profiles, tasks, invites + row-level security +
--  a trigger that gives the FIRST signup the Manager role and
--  honours invited roles.
-- ============================================================

-- ---------- tables ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  title       text,
  role        text not null default 'member' check (role in ('manager','member')),
  color       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.invites (
  token       uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null default 'member' check (role in ('manager','member')),
  accepted    boolean not null default false,
  created_by  uuid references auth.users,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  dept              text,
  priority          text default 'medium',
  estimate          text,
  due               timestamptz,
  status            text not null default 'open'
                    check (status in ('open','in_progress','pending_approval','completed')),
  requires_approval boolean default false,
  proof             text,
  assigned_to       uuid references auth.users,
  created_by        uuid references auth.users,
  created_at        timestamptz not null default now(),
  claimed_by        uuid references auth.users,
  claimed_at        timestamptz,
  completed_by      uuid references auth.users,
  completed_at      timestamptz,
  approved_by       uuid references auth.users,
  approved_at       timestamptz,
  completion_note   text,
  comments          jsonb not null default '[]'::jsonb,
  activity          jsonb not null default '[]'::jsonb
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------- helpers ----------
-- true if the current user is a manager
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- read a single invite by token (used on the accept screen, before login)
create or replace function public.get_invite(t uuid)
returns table (token uuid, email text, role text, accepted boolean)
language sql stable security definer set search_path = public as $$
  select token, email, role, accepted from public.invites where token = t;
$$;
grant execute on function public.get_invite(uuid) to anon, authenticated;

-- on signup: create the profile, assign role (first user = manager, else invited role or member)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  invite_role text;
  is_first    boolean;
  palette     text[] := array['#D9824F','#5B8DEF','#3FA779','#B06AB3','#E0A33E','#D96A6A','#5FB0A6','#C9655A'];
begin
  select role into invite_role from public.invites where email = new.email and accepted = false limit 1;
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, email, full_name, title, role, color)
  values (
    new.id,
    new.email,
    coalesce(nullif(meta->>'full_name',''), split_part(new.email,'@',1)),
    coalesce(nullif(meta->>'title',''), case when is_first then 'Manager' else 'Team member' end),
    coalesce(invite_role, case when is_first then 'manager' else 'member' end),
    palette[1 + (abs(hashtext(new.email)) % array_length(palette,1))]
  );

  update public.invites set accepted = true where email = new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.tasks    enable row level security;
alter table public.invites  enable row level security;
alter table public.messages enable row level security;

-- table-level privileges (RLS still controls which rows are visible)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks    to authenticated;
grant select, insert, update, delete on public.invites  to authenticated;
grant select, insert on public.messages to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- profiles: everyone on the team can see each other; you can edit only yourself
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated using (id = auth.uid());

-- managers can change anyone's role
drop policy if exists "profiles_manager_update" on public.profiles;
create policy "profiles_manager_update" on public.profiles for update to authenticated using (public.is_manager());

-- tasks: shared board — any signed-in teammate can read, add, and update tasks
drop policy if exists "tasks_read"   on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_read"   on public.tasks for select to authenticated using (true);
create policy "tasks_insert" on public.tasks for insert to authenticated with check (auth.uid() = created_by);
create policy "tasks_update" on public.tasks for update to authenticated using (true);

-- delete: managers, or whoever created the task
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- messages: any signed-in teammate reads the channel, posts as themselves
drop policy if exists "messages_read"   on public.messages;
drop policy if exists "messages_insert" on public.messages;
create policy "messages_read"   on public.messages for select to authenticated using (true);
create policy "messages_insert" on public.messages for insert to authenticated with check (user_id = auth.uid());

-- invites: only managers can create / see / change them (accept screen uses get_invite())
drop policy if exists "invites_read"   on public.invites;
drop policy if exists "invites_insert" on public.invites;
drop policy if exists "invites_update" on public.invites;
create policy "invites_read"   on public.invites for select to authenticated using (public.is_manager());
create policy "invites_insert" on public.invites for insert to authenticated with check (public.is_manager());
create policy "invites_update" on public.invites for update to authenticated using (public.is_manager());

-- ============================================================
--  Done. Next: paste your Project URL + anon key into config.js
--  (Project Settings → API). The first person to sign up becomes
--  the Manager. Optional: Authentication → Providers → Email →
--  turn OFF "Confirm email" for instant access while testing.
-- ============================================================
