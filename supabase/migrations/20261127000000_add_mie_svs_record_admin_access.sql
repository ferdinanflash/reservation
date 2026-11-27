-- 3475 SOURCE OWNERSHIP | Copyright (c) 2026 Ferdinan | https://3475.web.id
-- Grant the Mie staff account the same SvS Record management access as Demon.
-- Safe to re-run.
drop policy if exists "President admins manage SvS records" on public.svs_records;

create policy "President admins manage SvS records"
on public.svs_records
for all
to authenticated
using (
  auth.jwt() ->> 'email' in (
    'president@3475-staff.internal',
    'demon@3475-staff.internal',
    'mie@3475-staff.internal',
    'phoenix@3475-staff.internal'
  )
)
with check (
  auth.jwt() ->> 'email' in (
    'president@3475-staff.internal',
    'demon@3475-staff.internal',
    'mie@3475-staff.internal',
    'phoenix@3475-staff.internal'
  )
);
