## Problem

Opening the preview in a new tab (the published/preview URL) shows a blank page. Console: `Error: supabaseUrl is required`. Inside the Lovable editor it works because Vite dev server reads `.env` from the sandbox directly.

Root cause: this is a classic Vite stack. The Supabase client reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, which Vite inlines **at build time** from `.env`. But `.env` is listed in `.gitignore`, so it isn't included in the build that produces the preview/published bundle → both env vars are `undefined` → `createClient` throws `supabaseUrl is required`.

## Fix

Remove the `.env` entry from `.gitignore` so the managed Supabase env file (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) is included in builds. These are publishable (anon) values — safe to ship in the browser bundle; RLS is what protects the data.

### Steps
1. Edit `.gitignore`: remove the single `.env` line (keep `*.local` etc. as-is).
2. Ask the user to republish. The next build will bundle the env vars and the preview-in-new-tab / published site will load.

No code changes needed — `src/integrations/supabase/client.ts`, `.env` contents, and everything else stay untouched.