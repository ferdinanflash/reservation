-- SvS Record: President-managed match history
create table if not exists public.svs_records (
  id uuid primary key default gen_random_uuid(),
  server_id text not null,
  side text not null default 'ATK' check (side in ('ATK','DEF')),
  result text not null check (result in ('Conquered','Defended','Repelled','Castle lost')),
  opponent text not null default '',
  prep_score bigint not null default 0,
  prep_delta bigint not null default 0,
  battle_score bigint not null default 0,
  battle_delta bigint not null default 0,
  played_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists svs_records_played_at_idx on public.svs_records (played_at desc, created_at desc);
alter table public.svs_records enable row level security;
drop policy if exists "SvS records are visible to everyone" on public.svs_records;
create policy "SvS records are visible to everyone" on public.svs_records for select using (true);
drop policy if exists "Authenticated users manage SvS records" on public.svs_records;
create policy "President admins manage SvS records" on public.svs_records for all to authenticated
  using (auth.jwt() ->> 'email' in ('president@3475-staff.internal', 'demon@3475-staff.internal', 'phoenix@3475-staff.internal'))
  with check (auth.jwt() ->> 'email' in ('president@3475-staff.internal', 'demon@3475-staff.internal', 'phoenix@3475-staff.internal'));
grant select on public.svs_records to anon, authenticated;
grant insert, update, delete on public.svs_records to authenticated;
