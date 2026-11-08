Reservation updates — ready to use
=================================

Copy into site root (keep folders):

  index.html
  style.css
  lang.js
  js/app-svs-enemies.js
  supabase/functions/wosatlas-states/index.ts
  supabase_migration_svs_enemies_menu_label.sql   (optional)

Steps
1. Replace the files above on the server.
2. Optional: run SQL migration in Supabase.
3. supabase functions deploy wosatlas-states
4. Hard refresh / clear PWA cache.

Included fixes
- WoS Atlas public API path (like TAL)
- Menu label switch: SvS Enemies ↔ TAL Enemies (President Panel)
- Queued State loading with delay when >1 enemy State
  (avoids parallel API bursts / blocks)
