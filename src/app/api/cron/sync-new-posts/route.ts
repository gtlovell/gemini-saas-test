import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/service"; // Service role needed to fetch all tracked subs
import { syncSubredditPosts } from "@/src/lib/tasks/syncSubredditPosts";
import { sleep } from "@/src/lib/utils"; // Reuse sleep utility

// Function to verify the cron secret
function verifyCronSecret(request: Request): boolean {
  const providedSecret = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "");
  return providedSecret === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.warn("[Cron Sync New Posts] Invalid or missing CRON_SECRET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Sync New Posts] Job starting...");
  const supabase = createClient();
  let subredditsProcessed = 0;
  let totalPostsSynced = 0;

  try {
    // 1. Fetch tracked subreddits
    const { data: trackedSubreddits, error: fetchError } = await supabase
      .from("subreddits")
      .select("name")
      .eq("is_tracked", true); // Fetch only subreddits marked for tracking

    if (fetchError) throw fetchError;
    if (!trackedSubreddits || trackedSubreddits.length === 0) {
      console.log("[Cron Sync New Posts] No tracked subreddits found.");
      return NextResponse.json({ message: "No tracked subreddits found." });
    }

    console.log(
      `[Cron Sync New Posts] Found ${trackedSubreddits.length} tracked subreddits.`
    );

    // 2. Loop and sync posts (with delays)
    for (const sub of trackedSubreddits) {
      try {
        console.log(`[Cron Sync New Posts] Syncing 'new' for r/${sub.name}...`);
        // Fetch only a small number, e.g., the latest 10-25 new posts
        const posts = await syncSubredditPosts(sub.name, "new", { limit: 25 });
        if (posts) {
          totalPostsSynced += posts.length;
          console.log(
            `[Cron Sync New Posts] Synced ${posts.length} posts for r/${sub.name}.`
          );
        }
        subredditsProcessed++;
        // Add a small delay between subreddits to spread out API calls
        await sleep(1500); // 1.5 second delay
      } catch (syncError: any) {
        console.error(
          `[Cron Sync New Posts] Failed to sync posts for r/${sub.name}:`,
          syncError.message
        );
        // Continue to the next subreddit even if one fails
      }
    }

    const message = `[Cron Sync New Posts] Job finished. Processed ${subredditsProcessed}/${trackedSubreddits.length} subreddits. Synced ${totalPostsSynced} posts.`;
    console.log(message);
    return NextResponse.json({ message });
  } catch (error: any) {
    console.error("[Cron Sync New Posts] Job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error.message },
      { status: 500 }
    );
  }
}

// Suggest using edge runtime for potentially longer runs or lower cost,
// but ensure dependencies are compatible. Standard runtime works too.
// export const runtime = 'edge';
export const dynamic = "force-dynamic"; // Ensure fresh execution
