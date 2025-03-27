import { NextResponse } from "next/server";
import { backfillSubredditHistory } from "@/src/lib/tasks/backfill";

// Example only - secure this endpoint properly in a real application!
// (e.g., check if user is admin)
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    // Extremely basic security - replace with actual auth checks
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { subredditName, ...options } = body; // Extract subreddit name and other options

    if (!subredditName) {
      return NextResponse.json(
        { error: "Missing required parameter: subredditName" },
        { status: 400 }
      );
    }

    // Initiate the backfill (asynchronously - don't wait for it here in a serverless context)
    // Using setTimeout to allow the API response to return immediately.
    // For long-running jobs, consider a proper background job queue (e.g., Vercel Cron + Queue, Supabase Edge Functions + pg_cron).
    setTimeout(() => {
      backfillSubredditHistory(subredditName, options)
        .then((result) =>
          console.log(
            `[API Backfill Trigger] Finished: ${JSON.stringify(result)}`
          )
        )
        .catch((error) =>
          console.error(`[API Backfill Trigger] Error:`, error)
        );
    }, 0);

    // Return an immediate success response to the client
    return NextResponse.json(
      {
        message: `Backfill initiated for r/${subredditName}. Check server logs for progress.`,
        params: { subredditName, ...options },
      },
      { status: 202 }
    ); // 202 Accepted indicates request is processing
  } catch (error: any) {
    console.error(
      "[API Backfill Trigger] Failed to parse request or initiate backfill:",
      error
    );
    return NextResponse.json(
      { error: "Failed to initiate backfill", details: error.message },
      { status: 500 }
    );
  }
}

// Ensure this route isn't statically optimized if using background tasks implicitly
export const dynamic = "force-dynamic";
