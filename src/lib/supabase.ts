import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mqktczeqkynqqgzkbrno.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xa3RjemVxa3lucXFnemticm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzI3MDUsImV4cCI6MjA5OTkwODcwNX0.vFo6S1aa1Uv2JsleRh50VkoL4aknzjepgUvqOI0frNY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});


