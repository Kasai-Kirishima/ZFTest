# Zero Football v60

## Supabase foundation
- Added the user's Supabase project URL and public publishable key to `js/supabase-config.js`.
- Added Supabase JS v2 browser client.
- Added email/password registration, sign-in and sign-out in Settings.
- Added manual cloud save upload/download for the local club database.
- Added SQL migration `supabase/001_cloud_saves.sql` with per-user RLS policies.
- Kept the single-player/local save path available without an account or connection.
- Added setup instructions in `SUPABASE_SETUP_RU.md`.

Cloud synchronization is intentionally manual in this first integration. The SQL migration must be run in the Supabase SQL Editor before cloud saves can work.
