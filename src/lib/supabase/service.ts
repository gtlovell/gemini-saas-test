// src/lib/supabase/service.ts

import { createClient } from "@supabase/supabase-js";
// import { Database } from "@/types/supabase"; // Uncomment if you have generated types

// Ensure environment variables are defined (this code runs server-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  // The service role client cannot function without the key.
  throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
}

// Create the service role client
// Note: We use the standard 'createClient' from '@supabase/supabase-js' here,
// as the SSR cookie handling is irrelevant for the service role.
// The third argument object is where we specify auth options like persistSession.
const supabaseServiceRole = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    // Important: Disable session persistence for service roles
    // Service roles don't represent a user session.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Export the singleton instance
export default supabaseServiceRole;

// Optional: If you prefer a factory function pattern similar to server.ts
// export const createServiceRoleClient = () => {
//     if (!supabaseUrl || !serviceRoleKey) {
//         throw new Error("Missing Supabase URL or Service Role Key environment variables.");
//     }
//     return createClient<Database>(supabaseUrl, serviceRoleKey, {
//         auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
//     });
// };
