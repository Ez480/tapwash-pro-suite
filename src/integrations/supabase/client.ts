import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Vercel/production normally provides these through VITE_* environment variables.
// Keep safe public fallbacks so the browser does not crash with a blank page when
// the Vercel environment variables were not added yet. This is a Supabase
// publishable key, not a service-role/secret key.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  "https://xeqijpgjxsagedhamzhe.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "sb_publishable_WMaCSaelRFRfitPUznmSKg_h2KFprnZ";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage:
        typeof window !== "undefined" ? window.localStorage : undefined,
    },
  },
);
