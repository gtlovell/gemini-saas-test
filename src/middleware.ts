import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Create an unmodified response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create the Supabase client configured for middleware
  // It needs access to cookies (request and response) to manage the session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // Ensure these env vars are set!
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // Ensure these env vars are set!
    {
      cookies: {
        // A function to get a cookie from the request
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        // A function to set a cookie on the response
        set(name: string, value: string, options: CookieOptions) {
          // If the cookie is set, update the request cookies object
          // This is necessary for Server Components reading the updated session
          request.cookies.set({
            name,
            value,
            ...options,
          });
          // Update the response object with the new cookie
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        // A function to delete a cookie from the response
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request cookies object
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          // Update the response object to remove the cookie
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // IMPORTANT: Refresh the session cookie before continuing
  // This ensures the session is fresh for Server Components and API Routes
  // It also handles session expiry and refreshing tokens automatically
  await supabase.auth.getSession();

  // Return the potentially modified response object
  // (modified if the session cookie needed updating)
  return response;
}

// Configure the middleware matcher
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
