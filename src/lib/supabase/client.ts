import { createBrowserClient } from "@supabase/ssr";

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or key is missing");
    throw new Error("Supabase environment variables are not set");
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
};

// Export a singleton instance
export const supabase = createClient();
