import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// TapWash production Supabase project: El.EZZ CAR WASH.
const SUPABASE_URL = "https://aualcmbftzymhkgqfojw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_PKyGTmUBRBajj3J5mOzfRg_ecOJu5Bd";

// Keep each browser tab signed in independently. localStorage is shared by all
// tabs, so logging in as a manager in one tab could otherwise replace the
// employee/customer session in another tab. sessionStorage is isolated per tab.
const tabAuthStorage: Storage = typeof window !== "undefined" ? window.sessionStorage : {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: tabAuthStorage,
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
