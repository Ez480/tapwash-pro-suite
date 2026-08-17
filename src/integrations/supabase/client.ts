import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// TapWash production Supabase project: El.EZZ CAR WASH.
// Publishable browser key only; never use a service_role key here.
const DEFAULT_SUPABASE_URL = "https://aualcmbftzymhkgqfojw.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_PKyGTmUBRBajj3J5mOzfRg_ecOJu5Bd";

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
