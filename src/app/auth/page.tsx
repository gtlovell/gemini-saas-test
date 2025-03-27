"use client"; // Needs to be a client component for interaction

import { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createClient } from "@/src/lib/supabase/client"; // Use browser client
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Session check error:", err);
        setError("Failed to check authentication status");
      }
    };
    checkSession();

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <div style={{ maxWidth: "420px", margin: "96px auto" }}>
      {error && (
        <div style={{ color: "red", marginBottom: "16px" }}>{error}</div>
      )}
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={["github", "google"]}
        redirectTo={`${
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        }/auth/callback`}
      />
    </div>
  );
}
