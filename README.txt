Reservation updates — ready to use
=================================

Copy these files into the site root (keep folders):

  index.html
  style.css
  lang.js
  js/app-svs-enemies.js
  supabase/functions/wosatlas-states/index.ts
  supabase_migration_svs_enemies_menu_label.sql   (optional)

Steps
-----
1. Upload / replace ALL files above (especially lang.js — without it
   the settings modal shows raw keys like svs_enemies_menu_label_title).
2. Optional — run the SQL migration in Supabase SQL Editor.
3. Deploy edge function:
     supabase functions deploy wosatlas-states
4. Hard refresh the site (clear PWA / browser cache if needed).

What you get
------------
- Alliance / State load via public WoS Atlas (same approach as TAL)
- President Panel can switch menu button name: SvS Enemies ↔ TAL Enemies
