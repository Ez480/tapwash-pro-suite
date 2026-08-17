import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// TapWash production Supabase project: El.EZZ CAR WASH.
// Authentication must always use this production project; do not allow a stale
// Vercel/Lovable environment variable to redirect the app to another project.
const SUPABASE_URL = "https://aualcmbftzymhkgqfojw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_PKyGTmUBRBajj3J5mOzfRg_ecOJu5Bd";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        "X-Client-Info": "tapwash-web",
      },
    },
  },
);
