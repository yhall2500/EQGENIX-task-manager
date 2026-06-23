-- ============================================================
--  TaskFlow — GRANT fix
--  Run this in Supabase → SQL Editor if signup/login "does
--  nothing" or you see "permission denied for table ...".
--  It gives the logged-in (authenticated) role table access.
--  Row-Level Security still controls WHICH rows they see.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks    to authenticated;
grant select, insert, update, delete on public.invites  to authenticated;

-- make future tables auto-grant too
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ============================================================
--  Done. Go back to the app and create your account again.
-- ============================================================
