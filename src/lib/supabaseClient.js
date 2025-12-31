// lib/supabaseClient.js - UPDATED VERSION
import { createClient } from "@supabase/supabase-js";

// Vite uses import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log(
  "Supabase Anon Key (first 10 chars):",
  supabaseAnonKey?.substring(0, 10)
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables!");
}

// FIXED: Enable auth persistence and add proper headers
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // CHANGED: Enable session persistence
    autoRefreshToken: true, // CHANGED: Enable token refresh
    detectSessionInUrl: true, // CHANGED: Enable URL session detection
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  },
});
