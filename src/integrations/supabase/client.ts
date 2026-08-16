import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Vercel/Vite inject these at build time. The public Supabase values below are
// kept as a production fallback so a missing Vercel env variable cannot take
// the authentication UI completely offline. The publishable key is designed
// for browser use; never put a service_role key here.
const DEFAULT_SUPABASE_URL = "https://xeqijpgjxsagedhamzhe.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_WMaCSaelRFRfitPUznmSKg_h2KFprnZ";

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

function validateSupabaseConfig() {
  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      throw new Error("Invalid Supabase URL");
    }
  } catch {
    throw new Error("VITE_SUPABASE_URL is invalid");
  }

  if (!SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is invalid");
  }
}

validateSupabaseConfig();

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
