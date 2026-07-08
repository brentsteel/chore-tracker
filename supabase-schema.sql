-- Chore Tracker — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query)

create extension if not exists pgcrypto;

-- Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Chores
create table if not exists chores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

-- Completions (one row per time a chore was ticked done on a given date)
create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  date date not null,
  completed_by_name text not null,
  completed_by_email text not null,
  completed_at timestamptz not null default now()
);

-- Indexes for common lookups
create index if not exists idx_chores_room_id on chores(room_id);
create index if not exists idx_completions_chore_id on completions(chore_id);
create index if not exists idx_completions_date on completions(date);

-- Row Level Security
-- This is a single shared household list: anyone who is logged in
-- (i.e. any family member who has signed up) can read and write everything.
-- Individual logins are still required — signed-out visitors see nothing.

alter table rooms enable row level security;
alter table chores enable row level security;
alter table completions enable row level security;

create policy "Authenticated users can read rooms"
  on rooms for select
  using (auth.role() = 'authenticated');
create policy "Authenticated users can write rooms"
  on rooms for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated users can update rooms"
  on rooms for update
  using (auth.role() = 'authenticated');
create policy "Authenticated users can delete rooms"
  on rooms for delete
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read chores"
  on chores for select
  using (auth.role() = 'authenticated');
create policy "Authenticated users can write chores"
  on chores for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated users can update chores"
  on chores for update
  using (auth.role() = 'authenticated');
create policy "Authenticated users can delete chores"
  on chores for delete
  using (auth.role() = 'authenticated');

create policy "Authenticated users can read completions"
  on completions for select
  using (auth.role() = 'authenticated');
create policy "Authenticated users can write completions"
  on completions for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated users can delete completions"
  on completions for delete
  using (auth.role() = 'authenticated');

-- Enable realtime updates so all family members' devices stay in sync live
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table completions;
