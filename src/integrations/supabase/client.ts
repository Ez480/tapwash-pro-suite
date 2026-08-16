import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Browser builds must use Vite's public environment variables. Do not fall
// back to server-only process.env values here; that can produce a misleading
// "Failed to fetch" error when the app is deployed to Vercel.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!SUPABASE_URL) {
  throw new Error(
    "TapWash configuration error: VITE_SUPABASE_URL is missing. Add it to the Vercel environment variables.",
  );
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "TapWash configuration error: VITE_SUPABASE_PUBLISHABLE_KEY is missing. Add it to the Vercel environment variables.",
  );
}

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
