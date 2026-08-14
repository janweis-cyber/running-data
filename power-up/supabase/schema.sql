-- Power Up — Supabase schema + RLS
-- Run in the Supabase SQL editor. Single-user app: every row is scoped to
-- auth.uid() via user_id, enforced by RLS.

create extension if not exists "pgcrypto";

-- Shared columns on every synced table:
--   id uuid primary key (client-generated)
--   user_id uuid → auth.users
--   updated_at timestamptz (client-stamped; last-write-wins)
--   device_id uuid
--   deleted smallint tombstone (0/1)

create table if not exists exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  name text not null,
  primary_muscle text not null,
  secondary_muscle text,
  folder text not null,
  equipment text not null,
  default_sets int not null,
  rep_min int not null,
  rep_max int not null,
  rest_sec int not null,
  increment_kg numeric not null,
  is_custom smallint not null default 0,
  deload_pending smallint not null default 0
);

create table if not exists session_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  label text not null,
  name text not null,
  sort_order int not null
);

create table if not exists template_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  template_id uuid not null,
  exercise_id uuid not null,
  position int not null,
  sets int not null,
  rep_min int not null,
  rep_max int not null,
  rest_sec int not null,
  superset_group text
);

create table if not exists rotation (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  template_id uuid not null,
  position int not null
);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  date date not null,
  template_id uuid not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  notes text not null default ''
);

create table if not exists sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  session_id uuid not null,
  exercise_id uuid not null,
  set_number int not null,
  weight_kg numeric not null,
  reps int not null
);

create table if not exists body_weight (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  date date not null,
  kg numeric not null
);

create table if not exists settings (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null,
  device_id uuid not null,
  deleted smallint not null default 0,
  rest_default int not null,
  plate_rounding numeric not null,
  sound_on smallint not null default 0,
  week_start text not null default 'monday'
);

-- Sync pull is "updated_at > cursor" per table
create index if not exists exercises_updated on exercises (user_id, updated_at);
create index if not exists session_templates_updated on session_templates (user_id, updated_at);
create index if not exists template_exercises_updated on template_exercises (user_id, updated_at);
create index if not exists rotation_updated on rotation (user_id, updated_at);
create index if not exists sessions_updated on sessions (user_id, updated_at);
create index if not exists sets_updated on sets (user_id, updated_at);
create index if not exists body_weight_updated on body_weight (user_id, updated_at);
create index if not exists settings_updated on settings (user_id, updated_at);

-- RLS: each user sees only their own rows
do $$
declare t text;
begin
  foreach t in array array[
    'exercises','session_templates','template_exercises','rotation',
    'sessions','sets','body_weight','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;
