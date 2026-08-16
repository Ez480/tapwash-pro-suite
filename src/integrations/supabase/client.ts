import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      !SUPABASE_URL ? "VITE_SUPABASE_URL" : null,
      !SUPABASE_PUBLISHABLE_KEY ? "VITE_SUPABASE_PUBLISHABLE_KEY" : null,
    ].filter(Boolean).join(", ");

    throw new Error(`Supabase is not configured. Missing: ${missing}`);
  }

  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== "https:") {
      throw new Error("VITE_SUPABASE_URL must use HTTPS");
    }
  } catch {
    throw new Error("VITE_SUPABASE_URL is invalid");
  }
}

assertSupabaseConfig();

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
