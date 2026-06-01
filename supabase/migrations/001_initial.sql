-- users: self-serve registration via Shortcut, gated by invite code
create table users (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  token              text unique not null default gen_random_uuid()::text,
  email              text,
  mode               text not null default 'curious', -- curious | active | performance
  opt_in             boolean not null default true,
  timezone           text,                            -- e.g. America/New_York
  charge_reminder    boolean not null default false,
  charge_reminder_at time,                            -- local time, e.g. 21:00
  wear_reminder      boolean not null default false,
  wear_reminder_at   time,                            -- local time, e.g. 07:00
  created_at         timestamptz not null default now()
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
