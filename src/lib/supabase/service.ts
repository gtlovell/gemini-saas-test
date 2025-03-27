// src/lib/supabase/service.ts

import { createClient } from "@supabase/supabase-js"; // Use the standard JS client
// import { Database } from "@/types/supabase";
const SBurl = "https://efabsoerrhusepckjtht.supabase.co";
const SBrole =
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYWJzb2Vycmh1c2VwY2tqdGh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzAxOTYyNCwiZXhwIjoyMDU4NTk1NjI0fQ.NxPppHCHrioaxSOAyqSluxGAe78Ef2GuTZ91ogPpO1o";
// Ensure environment variables are defined (this code runs server-side only)
const supabaseUrl = SBurl;
const serviceRoleKey = SBrole;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  // Provide a more helpful error message in development
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. This is required for service-level operations."
    );
    // Optionally throw anyway, or allow proceeding with limited functionality if applicable
    // throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  } else {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
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
