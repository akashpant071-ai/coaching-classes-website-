-- ============================================================
-- Genius Coaching Classes — Supabase schema, RLS & policies
-- Paste this entire file into: Supabase Dashboard -> SQL Editor -> Run
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout.
-- ============================================================

-- If you are starting completely fresh and already have an old,
-- incompatible "attendance" table (text student_id, no auth link),
-- uncomment the next two lines to drop it first. This WILL delete
-- any existing rows in that table.
-- drop table if exists public.attendance cascade;
-- drop table if exists public.profiles cascade;

-- ------------------------------------------------------------
-- 1. PROFILES
-- One row per authenticated user (teacher or student), keyed to
-- Supabase's built-in auth.users table.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('teacher', 'student')),
  full_name     text not null,
  student_code  text unique,              -- only set for students, e.g. 'S101'
  class_name    text,                     -- e.g. '9th'  (students only)
  created_at    timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_student_code on public.profiles(student_code);

-- ------------------------------------------------------------
-- 2. ATTENDANCE
-- One row per student per date.
-- ------------------------------------------------------------
create table if not exists public.attendance (
  id           bigint generated always as identity primary key,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  date         date not null default current_date,
  status       text not null check (status in ('Present', 'Absent')),
  marked_by    uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_attendance_date on public.attendance(date);

-- ------------------------------------------------------------
-- 3. HELPER FUNCTION: is_teacher()
-- SECURITY DEFINER lets this check the profiles table without
-- re-triggering the profiles RLS policies on itself (which would
-- otherwise cause infinite recursion).
-- ------------------------------------------------------------
create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- ------------------------------------------------------------
-- 4. SECURITY TRIGGER: prevent role escalation
-- Stops a logged-in student from ever changing their own `role`
-- column to 'teacher' via a direct API update call (RLS alone is
-- row-level, not column-level, so this closes that gap).
-- ------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_teacher() then
    raise exception 'Only a teacher can change a profile role.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.attendance enable row level security;

-- ------------------------------------------------------------
-- 6. PROFILES POLICIES
-- ------------------------------------------------------------
drop policy if exists "profiles_select_own_or_teacher" on public.profiles;
create policy "profiles_select_own_or_teacher"
  on public.profiles for select
  using (id = auth.uid() or public.is_teacher());

-- A brand-new user may create ONLY their own row, and only as a
-- student. Teacher rows are never self-service (see setup steps).
drop policy if exists "profiles_insert_self_as_student" on public.profiles;
create policy "profiles_insert_self_as_student"
  on public.profiles for insert
  with check (id = auth.uid() and role = 'student');

drop policy if exists "profiles_update_own_or_teacher" on public.profiles;
create policy "profiles_update_own_or_teacher"
  on public.profiles for update
  using (id = auth.uid() or public.is_teacher())
  with check (id = auth.uid() or public.is_teacher());

drop policy if exists "profiles_delete_teacher_only" on public.profiles;
create policy "profiles_delete_teacher_only"
  on public.profiles for delete
  using (public.is_teacher());

-- ------------------------------------------------------------
-- 7. ATTENDANCE POLICIES
-- ------------------------------------------------------------
drop policy if exists "attendance_select_own_or_teacher" on public.attendance;
create policy "attendance_select_own_or_teacher"
  on public.attendance for select
  using (student_id = auth.uid() or public.is_teacher());

drop policy if exists "attendance_insert_teacher_only" on public.attendance;
create policy "attendance_insert_teacher_only"
  on public.attendance for insert
  with check (public.is_teacher());

drop policy if exists "attendance_update_teacher_only" on public.attendance;
create policy "attendance_update_teacher_only"
  on public.attendance for update
  using (public.is_teacher())
  with check (public.is_teacher());

drop policy if exists "attendance_delete_teacher_only" on public.attendance;
create policy "attendance_delete_teacher_only"
  on public.attendance for delete
  using (public.is_teacher());

-- ============================================================
-- Done. Next: create your first teacher account (see setup steps).
-- ============================================================
