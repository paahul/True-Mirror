-- token-based user identity — no account, no email required
create table users (
  token        text primary key default gen_random_uuid()::text,
  created_at   timestamptz not null default now(),
  save_history boolean not null default true
);

-- one row per analysis run
create table reports (
  id           uuid primary key default gen_random_uuid(),
  user_token   text not null references users(token) on delete cascade,
  analysis     text not null,
  metrics      jsonb,          -- key metric snapshot for trend queries
  created_at   timestamptz not null default now()
);

create index reports_user_token_idx on reports (user_token, created_at desc);

-- enable RLS; server uses service role key so policy enforcement is on the app layer
alter table users enable row level security;
alter table reports enable row level security;
