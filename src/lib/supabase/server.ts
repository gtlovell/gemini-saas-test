import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers"; // Import cookies from next/headers
// import { Database } from "@/types/supabase";

// Define the factory function to create the server client instance
export const createClient = () => {
  // Get the cookie store from next/headers
  const cookieStore = cookies();

  // Create and return the Supabase client
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Define cookie methods using the Next.js cookie store
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};
