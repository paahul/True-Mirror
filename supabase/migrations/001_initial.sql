-- users: self-serve registration via Shortcut, gated by invite code
create table users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  token      text unique not null default gen_random_uuid()::text,
  email      text,
  opt_in     boolean not null default true,
  created_at timestamptz not null default now()
);

-- one row per analysis run
create table reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  raw_data   jsonb not null,
  analysis   text not null,
  created_at timestamptz not null default now()
);

create index reports_user_id_idx on reports (user_id, created_at desc);

alter table users enable row level security;
alter table reports enable row level security;
